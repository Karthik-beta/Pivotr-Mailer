const path = require("path");

const ROOT_DIR = __dirname;
const LOG_DIR = path.join(ROOT_DIR, ".pm2", "logs");

module.exports = {
  apps: [
    {
      name: "ses-watch",
      script: "bun",
      args: "tests/localstack/email-viewer.ts --watch",
      cwd: ROOT_DIR,
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,

      out_file: path.join(LOG_DIR, "ses-watch-out.log"),
      error_file: path.join(LOG_DIR, "ses-watch-error.log"),
      merge_logs: true,
      time: true,

      restart_delay: 2000,
      min_uptime: "5s",
      max_restarts: 10,

      env: {
        NODE_ENV: "development",
        FORCE_COLOR: "1",
      },
      env_production: {
        NODE_ENV: "production",
        FORCE_COLOR: "1",
      },
    },
  ],
};
