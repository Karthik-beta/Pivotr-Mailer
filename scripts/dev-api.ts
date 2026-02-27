/**
 * PM2 entry script for the local API server.
 *
 * Waits for infrastructure to be ready, then builds all Lambda functions,
 * runs SAM build, and starts the SAM local API Gateway on port 3001.
 *
 * Handles graceful shutdown on Windows via PM2 'shutdown' message.
 */
import { $ } from "bun";
import { spawn, spawnSync } from "child_process";

$.cwd(import.meta.dir + "/..");

// Keep track of spawned SAM process for cleanup
let samProcess: ReturnType<typeof spawn> | null = null;

/**
 * Check if port is free (not bound to any process)
 */
function waitForPortFree(port: number, retries = 5, intervalMs = 2000): boolean {
    for (let i = 0; i < retries; i++) {
        const result = spawnSync(
            'cmd',
            ['/c', `netstat -aon | findstr :${port}`],
            { shell: true, encoding: 'utf8', stdio: 'pipe' }
        );
        if (!result.stdout.trim()) {
            console.log(`Port ${port} is free. Proceeding...`);
            return true;
        }
        console.log(`Port ${port} still in use, waiting... (${i + 1}/${retries})`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
    }
    console.error(`Port ${port} did not free up after ${retries} attempts. Aborting.`);
    return false;
}

/**
 * Clean up any existing SAM processes on port 3001 before starting.
 * This prevents zombie process accumulation.
 * 
 * IMPORTANT: Docker containers must be cleaned up BEFORE killing the SAM process,
 * as containers are owned by the SAM process.
 */
function cleanupExistingProcesses() {
    console.log("Cleaning up existing SAM processes...");

    // Step 1 - Kill all running SAM Lambda containers FIRST (before sam.exe)
    // Containers must be stopped before the process that owns them
    // Filter by image name since container names are random
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -q --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker kill 2>nul"
        ], 
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors if no containers found
    }

    // Step 2 - Remove stopped SAM containers so they don't accumulate
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -aq --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker rm 2>nul"
        ],
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors if no containers found
    }

    // Step 3 - Short wait for Docker to release resources
    const waitTime = 1000;
    const end = Date.now() + waitTime;
    while (Date.now() < end) {
        // Busy wait
    }

    // Step 4 - Kill any process on port 3001
    try {
        spawnSync("cmd", [
            "/c",
            "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %a"
        ],
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors if no processes found
    }

    // Step 5 - Kill any sam.exe processes by name
    try {
        spawnSync("taskkill", ["/F", "/IM", "sam.exe", "/T"], {
            stdio: "ignore"
        });
    } catch {
        // Ignore errors if no processes found
    }

    // Wait for port to be released (5 seconds for Docker/OS to fully release resources)
    console.log("Waiting for port 3001 to be released...");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);

    console.log("Cleanup complete.");
}

// Graceful shutdown handler for Windows (PM2 sends 'shutdown' message)
process.on("message", (msg: string) => {
    if (msg === "shutdown") {
        console.log("API server received shutdown signal");
        
        // Clean up Docker containers first (owned by SAM process)
        // Filter by image name since container names are random
        console.log("Cleaning up Docker containers...");
        try {
            spawnSync("cmd", [
                "/c",
                "docker ps -q --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker kill 2>nul"
            ], 
            { shell: true, stdio: "ignore" });
        } catch {
            // Ignore errors
        }
        try {
            spawnSync("cmd", [
                "/c",
                "docker ps -aq --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker rm 2>nul"
            ],
            { shell: true, stdio: "ignore" });
        } catch {
            // Ignore errors
        }
        
        // Kill the SAM child process
        if (samProcess) {
            console.log("Terminating SAM process...");
            try {
                spawnSync("taskkill", ["/F", "/IM", "sam.exe", "/T"], {
                    stdio: "ignore"
                });
            } catch {
                // Ignore if already dead
            }
        }
        process.exit(0);
    }
});

// Also handle SIGINT and SIGTERM for when PM2 sends signals
process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up...");
    
    // Clean up Docker containers first
    // Filter by image name since container names are random
    console.log("Cleaning up Docker containers...");
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -q --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker kill 2>nul"
        ], 
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors
    }
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -aq --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker rm 2>nul"
        ],
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors
    }
    
    if (samProcess) {
        try {
            spawnSync("taskkill", ["/F", "/IM", "sam.exe", "/T"], {
                stdio: "ignore"
            });
        } catch {
            // Ignore if already dead
        }
    }
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("Received SIGTERM, cleaning up...");
    
    // Clean up Docker containers first
    // Filter by image name since container names are random
    console.log("Cleaning up Docker containers...");
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -q --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker kill 2>nul"
        ], 
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors
    }
    try {
        spawnSync("cmd", [
            "/c",
            "docker ps -aq --filter \"ancestor=samcli/lambda-nodejs*\" | xargs docker rm 2>nul"
        ],
        { shell: true, stdio: "ignore" });
    } catch {
        // Ignore errors
    }
    
    if (samProcess) {
        try {
            spawnSync("taskkill", ["/F", "/IM", "sam.exe", "/T"], {
                stdio: "ignore"
            });
        } catch {
            // Ignore if already dead
        }
    }
    process.exit(0);
});

// Wait for LocalStack to be ready (poll health endpoint)
const LOCALSTACK_URL = "http://localhost:4566/_localstack/health";
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

console.log("Waiting for LocalStack to be ready...");

// Clean up existing SAM processes before starting
cleanupExistingProcesses();

for (let i = 0; i < MAX_RETRIES; i++) {
    try {
        const response = await fetch(LOCALSTACK_URL);
        if (response.ok) {
            console.log("LocalStack is ready!");
            break;
        }
    } catch {
        // LocalStack not ready yet
    }
    if (i === MAX_RETRIES - 1) {
        console.error("LocalStack did not become ready in time");
        process.exit(1);
    }
    await Bun.sleep(RETRY_DELAY);
}

await $`bun run scripts/build-lambdas.ts`;
await $`sam build`;

// Clean up any processes that might have started during build
cleanupExistingProcesses();

// Verify port 3001 is actually free before spawning SAM
if (!waitForPortFree(3001)) {
    process.exit(1);
}

// Start SAM local API Gateway and keep track of the process
console.log("Starting SAM Local API Gateway on port 3001...");
samProcess = spawn("sam", ["local", "start-api", "--port", "3001", "--docker-network", "pivotr-localstack-network", "--env-vars", "tests/env/sam-local.json", "--parameter-overrides", "CorsAllowedOrigin=\"http://localhost:3000\""], {
    stdio: "inherit",
    shell: true
});

// Handle process exit
samProcess.on("exit", (code) => {
    console.log(`SAM Local exited with code ${code}`);
    process.exit(code ?? 0);
});
