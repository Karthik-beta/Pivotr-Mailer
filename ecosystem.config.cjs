/**
 * PM2 Ecosystem Configuration
 *
 * Runs Bun scripts via PM2 for local development orchestration.
 *
 * NOTE: We use `interpreter: "none"` with the absolute path to bun.exe
 * instead of `interpreter: "bun"` because PM2's ProcessContainerForkBun.js
 * uses require() to load scripts, which fails for ESM / top-level-await
 * modules (Bun Shell scripts, Vite, etc.). Using interpreter: "none"
 * bypasses PM2's broken Bun container and spawns bun directly.
 *
 * WINDOWS-SPECIFIC NOTES:
 * - `shutdown_with_message: true` is required for graceful shutdown on Windows
 *   because signals (SIGINT/SIGTERM) are not reliably delivered.
 * - Processes listen for 'shutdown' message via process.on('message')
 * - Increased kill_timeout to allow proper cleanup
 *
 * Usage:
 *   bun run dev         - Start all services
 *   bun run dev:stop    - Stop all services
 *   bun run dev:logs    - View all logs
 *   bun run dev:status  - Check process status
 */

const path = require("path");

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const LOG_DIR = path.join(ROOT_DIR, ".pm2", "logs");

// Resolve absolute path to bun executable for reliable Windows execution.
const HOME = process.env.USERPROFILE || process.env.HOME || "";
const BUN_BIN = path.join(HOME, ".bun", "bin");
const BUN_EXE = path.join(BUN_BIN, process.platform === "win32" ? "bun.exe" : "bun");

module.exports = {
    apps: [
        // ─────────────────────────────────────────────────────────────────────────
        // Infrastructure: LocalStack (DynamoDB, SES, SQS, SNS, S3)
        // ─────────────────────────────────────────────────────────────────────────
        {
            name: "infra",
            script: BUN_EXE,
            args: "scripts/dev-infra.ts",
            cwd: ROOT_DIR,
            interpreter: "none",

            // Logging
            out_file: path.join(LOG_DIR, "infra-out.log"),
            error_file: path.join(LOG_DIR, "infra-error.log"),
            merge_logs: true,
            time: true,

            // Lifecycle - one-shot script that exits after Docker + bootstrap
            autorestart: false,
            watch: false,
            kill_timeout: 15000, // 15s for Docker cleanup

            // Windows graceful shutdown
            shutdown_with_message: true,

            // Environment
            env: {
                PATH: `${BUN_BIN}${path.delimiter}${process.env.PATH}`,
                FORCE_COLOR: "1",
            },
        },

        // ─────────────────────────────────────────────────────────────────────────
        // API: SAM Local (Lambda functions via API Gateway)
        // ─────────────────────────────────────────────────────────────────────────
        {
            name: "api",
            script: BUN_EXE,
            args: "scripts/dev-api.ts",
            cwd: ROOT_DIR,
            interpreter: "none",

            // Logging
            out_file: path.join(LOG_DIR, "api-out.log"),
            error_file: path.join(LOG_DIR, "api-error.log"),
            merge_logs: true,
            time: true,

            // Lifecycle
            autorestart: false,
            watch: false,
            kill_timeout: 10000, // 10s for SAM cleanup

            // Windows graceful shutdown
            shutdown_with_message: true,

            // Environment
            env: {
                PATH: `${BUN_BIN}${path.delimiter}${process.env.PATH}`,
                FORCE_COLOR: "1",
            },
        },

        // ─────────────────────────────────────────────────────────────────────────
        // Frontend: Vite Dev Server (TanStack Start)
        // ─────────────────────────────────────────────────────────────────────────
        {
            name: "frontend",
            script: BUN_EXE,
            args: "run dev",
            cwd: FRONTEND_DIR,
            interpreter: "none",

            // Logging
            out_file: path.join(LOG_DIR, "frontend-out.log"),
            error_file: path.join(LOG_DIR, "frontend-error.log"),
            merge_logs: true,
            time: true,

            // Lifecycle
            autorestart: false,
            watch: false,
            kill_timeout: 8000, // 8s for Vite cleanup

            // Windows graceful shutdown
            shutdown_with_message: true,

            // Environment
            env: {
                PATH: `${BUN_BIN}${path.delimiter}${process.env.PATH}`,
                FORCE_COLOR: "1",
            },
        },
    ],
};
