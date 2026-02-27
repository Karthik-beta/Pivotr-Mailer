const path = require("path");

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const LOG_DIR = path.join(ROOT_DIR, ".pm2", "logs");

const baseApp = {
  script: "bun",
  interpreter: "none",
  exec_mode: "fork",
  instances: 1,
  merge_logs: true,
  time: true,
  env: {
    NODE_ENV: "development",
    FORCE_COLOR: "1",
  },
  env_production: {
    NODE_ENV: "production",
    FORCE_COLOR: "1",
  },
};

module.exports = {
  apps: [
    {
      ...baseApp,
      name: "infra",
      cwd: ROOT_DIR,
      args: "scripts/dev-infra.ts",
      out_file: path.join(LOG_DIR, "infra-out.log"),
      error_file: path.join(LOG_DIR, "infra-error.log"),

      // One-shot: do not restart on success, restart on failure
      stop_exit_codes: [0],
      restart_delay: 2000,
      min_uptime: "5s",
      max_restarts: 5,

      kill_timeout: 15000,
      shutdown_with_message: true,
    },
    {
      ...baseApp,
      name: "api",
      cwd: ROOT_DIR,
      args: "scripts/dev-api.ts",
      out_file: path.join(LOG_DIR, "api-out.log"),
      error_file: path.join(LOG_DIR, "api-error.log"),

      restart_delay: 2000,
      min_uptime: "10s",
      max_restarts: 10,

      kill_timeout: 10000,
      shutdown_with_message: true,
    },
    {
      ...baseApp,
      name: "frontend",
      cwd: FRONTEND_DIR,
      args: "run dev",
      out_file: path.join(LOG_DIR, "frontend-out.log"),
      error_file: path.join(LOG_DIR, "frontend-error.log"),

      restart_delay: 2000,
      min_uptime: "10s",
      max_restarts: 10,

      kill_timeout: 8000,
    },
  ],
};
