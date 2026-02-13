/**
 * PM2 entry script for local infrastructure setup.
 *
 * Starts LocalStack containers and bootstraps AWS resources
 * (DynamoDB tables, SES identities, SQS queues, etc.).
 *
 * Handles graceful shutdown on Windows via PM2 'shutdown' message.
 */
import { $ } from "bun";

$.cwd(import.meta.dir + "/..");

// Graceful shutdown handler for Windows (PM2 sends 'shutdown' message)
process.on("message", (msg: string) => {
    if (msg === "shutdown") {
        console.log("Infrastructure script received shutdown signal");
        process.exit(0);
    }
});

await $`docker compose -f tests/localstack/docker-compose.yml up -d`;
await $`bun run tests/localstack/bootstrap.ts`;
