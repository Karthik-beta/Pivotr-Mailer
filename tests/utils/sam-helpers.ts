/**
 * SAM CLI Test Helpers
 *
 * Utilities for invoking Lambda functions via AWS SAM CLI.
 * Used for the Lambda runtime test layer.
 */

import { spawn, execFile, type ChildProcess } from 'child_process';
import { writeFile, unlink, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { platform } from 'os';

// =============================================================================
// SAM CLI Path Detection
// =============================================================================

/**
 * Get the SAM CLI command based on platform
 * On Windows, SAM is installed as sam.cmd and may not be in PATH for Node.js
 * Uses path.join to build path safely
 */
function getSAMCommand(): string {
    if (platform() === 'win32') {
        return join('C:', 'Program Files', 'Amazon', 'AWSSAMCLI', 'bin', 'sam.cmd');
    }
    return 'sam';
}

// =============================================================================
// Types
// =============================================================================

export interface SAMInvokeOptions {
    /** Function name from template.yaml */
    functionName: string;
    /** Event payload */
    event: object;
    /** Additional environment variables */
    envVars?: Record<string, string>;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Docker network for LocalStack access */
    dockerNetwork?: string;
}

export interface SAMInvokeResult {
    /** Exit code from SAM CLI */
    exitCode: number;
    /** Parsed function response */
    response: unknown;
    /** Raw stdout */
    stdout: string;
    /** Raw stderr (includes logs) */
    stderr: string;
    /** Function logs extracted from stderr */
    logs: string[];
}

export interface SAMLocalAPIOptions {
    /** Port to run on */
    port?: number;
    /** Host to bind to */
    host?: string;
    /** Docker network for LocalStack access */
    dockerNetwork?: string;
}

// =============================================================================
// SAM Local Invoke
// =============================================================================

/**
 * Invoke a Lambda function using SAM CLI
 */
export async function samLocalInvoke(options: SAMInvokeOptions): Promise<SAMInvokeResult> {
    const {
        functionName,
        event,
        envVars,
        timeout = 120000,
        dockerNetwork = 'pivotr-localstack-network',
    } = options;

    // Write event to temp file
    const tempDir = join(process.cwd(), '.sam-temp');
    await mkdir(tempDir, { recursive: true });

    const eventFile = join(tempDir, `event-${randomUUID()}.json`);
    await writeFile(eventFile, JSON.stringify(event));

    // Write env vars file if provided
    let envFile: string | undefined;
    if (envVars) {
        envFile = join(tempDir, `env-${randomUUID()}.json`);
        await writeFile(envFile, JSON.stringify({ [functionName]: envVars }));
    }

    try {
        const args = [
            'local',
            'invoke',
            functionName,
            '--event',
            eventFile,
            '--docker-network',
            dockerNetwork,
            '--env-vars',
            envFile || 'tests/env/sam-local.json',
            '--skip-pull-image',
        ];

        const result = await runCommand(getSAMCommand(), args, timeout);

        // Parse response from stdout
        let response: unknown;
        try {
            // SAM outputs the response as JSON on stdout
            const responseMatch = result.stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (responseMatch) {
                response = JSON.parse(responseMatch[0]);
            }
        } catch {
            response = result.stdout;
        }

        // Extract logs from stderr
        const logs = result.stderr
            .split('\n')
            .filter((line) => line.includes('[INFO]') || line.includes('[ERROR]') || line.includes('[WARN]'));

        // Determine effective exit code
        // SAM CLI may return exit code 1 due to various runtime lifecycle issues
        // even when the Lambda function executed successfully.
        // We consider the invocation successful if:
        // 1. The REPORT line appears in stderr (Lambda completed its execution)
        // 2. No actual Lambda error was thrown (no "errorMessage" in response)
        let effectiveExitCode = result.exitCode;
        const hasReportLine = result.stderr.includes('REPORT RequestId:');
        const hasLambdaError =
            typeof response === 'object' &&
            response !== null &&
            'errorMessage' in response;

        if (effectiveExitCode === 1 && hasReportLine && !hasLambdaError) {
            // Lambda succeeded but SAM CLI reported exit code 1 due to runtime lifecycle
            effectiveExitCode = 0;
        }

        return {
            exitCode: effectiveExitCode,
            response,
            stdout: result.stdout,
            stderr: result.stderr,
            logs,
        };
    } finally {
        // Cleanup temp files
        await unlink(eventFile).catch(() => {});
        if (envFile) {
            await unlink(envFile).catch(() => {});
        }
    }
}

// =============================================================================
// SAM Local API
// =============================================================================

let apiProcess: ChildProcess | null = null;

/**
 * Start SAM local API Gateway
 */
export async function startSAMLocalAPI(options: SAMLocalAPIOptions = {}): Promise<string> {
    const { port = 3000, host = '127.0.0.1', dockerNetwork = 'pivotr-localstack-network' } = options;

    if (apiProcess) {
        throw new Error('SAM local API already running');
    }

    const args = [
        'local',
        'start-api',
        '--port',
        String(port),
        '--host',
        host,
        '--docker-network',
        dockerNetwork,
        '--env-vars',
        'tests/env/sam-local.json',
        '--skip-pull-image',
        '--warm-containers',
        'EAGER',
    ];

    if (platform() === 'win32') {
        // On Windows, run .cmd files through cmd.exe
        const fullArgs = ['/c', getSAMCommand(), ...args];
        apiProcess = spawn('cmd.exe', fullArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
        });
    } else {
        apiProcess = spawn(getSAMCommand(), args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
        });
    }

    // Wait for API to be ready
    const baseUrl = `http://${host}:${port}`;
    await waitForAPI(baseUrl, 30000);

    return baseUrl;
}

/**
 * Stop SAM local API Gateway
 */
export async function stopSAMLocalAPI(): Promise<void> {
    if (apiProcess) {
        apiProcess.kill('SIGTERM');
        apiProcess = null;

        // Give it time to cleanup containers
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
}

/**
 * Wait for SAM local API to be ready
 */
async function waitForAPI(baseUrl: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/`, {
                signal: AbortSignal.timeout(1000),
            });
            // Any response means the API is running
            if (response.status !== 0) {
                return;
            }
        } catch {
            // API not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`SAM local API not ready after ${timeoutMs}ms`);
}

// =============================================================================
// HTTP Client for SAM Local API
// =============================================================================

export interface APIResponse<T = unknown> {
    status: number;
    headers: Headers;
    body: T;
}

/**
 * Make HTTP request to SAM local API
 */
export async function callLocalAPI<T = unknown>(
    baseUrl: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
        body?: object;
        headers?: Record<string, string>;
    } = {}
): Promise<APIResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let body: T;
    try {
        body = (await response.json()) as T;
    } catch {
        body = (await response.text()) as unknown as T;
    }

    return {
        status: response.status,
        headers: response.headers,
        body,
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

interface CommandResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

/**
 * Run a command and capture output
 * On Windows, uses shell mode to handle paths with spaces properly
 */
async function runCommand(command: string, args: string[], timeout: number): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        let proc: ReturnType<typeof spawn>;

        if (platform() === 'win32') {
            // On Windows, use shell mode which handles command path quoting properly
            // Both the command and any arguments with spaces need to be quoted
            const quoteIfNeeded = (s: string) => s.includes(' ') ? `"${s}"` : s;
            const quotedCommand = quoteIfNeeded(command);
            const quotedArgs = args.map(quoteIfNeeded);
            const fullCommand = [quotedCommand, ...quotedArgs].join(' ');
            proc = spawn(fullCommand, [], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
            });
        } else {
            proc = spawn(command, args, {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        }

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                exitCode: code ?? 1,
                stdout,
                stderr,
            });
        });

        proc.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

/**
 * Check if SAM CLI is available
 */
export async function isSAMAvailable(): Promise<boolean> {
    try {
        const result = await runCommand(getSAMCommand(), ['--version'], 5000);
        return result.exitCode === 0;
    } catch {
        return false;
    }
}
