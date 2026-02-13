/**
 * PM2 Ecosystem Configuration - Optional Services
 *
 * These services are NOT started with `bun dev`.
 * Start individually with: bun run dev:ses-watch
 *
 * See ecosystem.config.cjs header for why interpreter: "none" is used.
 */

const path = require("path");

const ROOT_DIR = __dirname;
const LOG_DIR = path.join(ROOT_DIR, ".pm2", "logs");

const HOME = process.env.USERPROFILE || process.env.HOME || "";
const BUN_BIN = path.join(HOME, ".bun", "bin");
const BUN_EXE = path.join(BUN_BIN, process.platform === "win32" ? "bun.exe" : "bun");

module.exports = {
    apps: [
        // ─────────────────────────────────────────────────────────────────────────
        // SES Watch: Email Monitor
        // Monitors LocalStack SES for sent emails
        // ─────────────────────────────────────────────────────────────────────────
        {
            name: "ses-watch",
            script: BUN_EXE,
            args: "tests/localstack/email-viewer.ts --watch",
            cwd: ROOT_DIR,
            interpreter: "none",

            // Logging
            out_file: path.join(LOG_DIR, "ses-watch-out.log"),
            error_file: path.join(LOG_DIR, "ses-watch-error.log"),
            merge_logs: true,
            time: true,

            // Lifecycle
            autorestart: false,
            watch: false,
            kill_timeout: 3000,

            // Environment
            env: {
                PATH: `${BUN_BIN}${path.delimiter}${process.env.PATH}`,
                FORCE_COLOR: "1",
            },
        },
    ],
};
