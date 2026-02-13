/**
 * PM2 entry script for the local API server.
 *
 * Waits for infrastructure to be ready, then builds all Lambda functions,
 * runs SAM build, and starts the SAM local API Gateway on port 3001.
 *
 * Handles graceful shutdown on Windows via PM2 'shutdown' message.
 */
import { $ } from "bun";

$.cwd(import.meta.dir + "/..");

// Graceful shutdown handler for Windows (PM2 sends 'shutdown' message)
process.on("message", (msg: string) => {
    if (msg === "shutdown") {
        console.log("API server received shutdown signal");
        process.exit(0);
    }
});

// Wait for LocalStack to be ready (poll health endpoint)
const LOCALSTACK_URL = "http://localhost:4566/_localstack/health";
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

console.log("Waiting for LocalStack to be ready...");

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
await $`sam local start-api --port 3001 --docker-network pivotr-localstack-network --env-vars tests/env/sam-local.json --parameter-overrides CorsAllowedOrigins="*"`;
