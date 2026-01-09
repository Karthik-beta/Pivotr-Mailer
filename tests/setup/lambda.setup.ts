/**
 * Lambda Runtime Test Setup
 *
 * Runs before Lambda tests.
 * Ensures SAM CLI and Docker are available.
 */

import { beforeAll, afterAll } from 'vitest';
import { isSAMAvailable, stopSAMLocalAPI } from '../utils/sam-helpers.js';
import { waitForLocalStack } from '../config/test-config.js';
import { bootstrapLocalStack } from '../localstack/bootstrap.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Get the SAM CLI command based on platform
 * Uses path.join to build path safely
 */
function getSAMCommand(): string {
    if (platform() === 'win32') {
        return join('C:', 'Program Files', 'Amazon', 'AWSSAMCLI', 'bin', 'sam.cmd');
    }
    return 'sam';
}

/**
 * Run SAM build command
 * On Windows, uses cmd.exe /c for .cmd files
 */
async function runSAMBuild(): Promise<void> {
    return new Promise((resolve, reject) => {
        const samCmd = getSAMCommand();
        let proc: ReturnType<typeof spawn>;

        if (platform() === 'win32') {
            // No extra quotes needed - spawn handles arguments properly
            proc = spawn('cmd.exe', ['/c', samCmd, 'build'], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } else {
            proc = spawn(samCmd, ['build'], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        }

        let stderr = '';
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`SAM build failed with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', (error) => {
            reject(error);
        });

        // Timeout after 2 minutes
        setTimeout(() => {
            proc.kill();
            reject(new Error('SAM build timed out'));
        }, 120000);
    });
}

// Track if setup has run
let isSetup = false;

// =============================================================================
// Lambda Test Setup
// =============================================================================

beforeAll(async () => {
    console.log('');
    console.log('==========================================');
    console.log('Lambda Runtime Test Setup');
    console.log('==========================================');

    // Check SAM CLI availability
    const samAvailable = await isSAMAvailable();
    if (!samAvailable) {
        throw new Error(
            'SAM CLI is not available. Please install it: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html'
        );
    }
    console.log('✓ SAM CLI is available');

    // Check Docker availability
    try {
        await execAsync('docker info');
        console.log('✓ Docker is available');
    } catch {
        throw new Error(
            'Docker is not available. Please ensure Docker Desktop is running.'
        );
    }

    // Check LocalStack
    console.log('Waiting for LocalStack...');
    await waitForLocalStack(60000);
    console.log('✓ LocalStack is ready');

    // Bootstrap LocalStack if needed
    if (!isSetup) {
        console.log('Bootstrapping LocalStack resources...');
        await bootstrapLocalStack();
        isSetup = true;
    }

    // Build Lambda artifacts
    console.log('Building Lambda functions...');
    try {
        await runSAMBuild();
        console.log('✓ Lambda functions built');
    } catch (error) {
        console.error('Failed to build Lambda functions:', error);
        throw error;
    }

    console.log('==========================================');
    console.log('');
});

afterAll(async () => {
    // Stop SAM local API if running
    await stopSAMLocalAPI();
});
