/** PM2 process list — paths are relative to this file's parent (repo root on the VPS). */
const path = require("node:path");

const root = path.join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "taxi-api",
      cwd: root,
      script: "npm",
      args: "run start -w @taxi/api",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 15,
      restart_delay: 3000,
    },
    {
      name: "taxi-bot",
      cwd: root,
      script: "npm",
      args: "run start -w @taxi/bot",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 15,
      restart_delay: 3000,
    },
  ],
};
