// PM2 process config for production (cPanel / AlmaLinux host).
// Runs `next start` bound to loopback; Apache reverse-proxies the subdomain to it.
// `next start` loads .env from this directory, so secrets stay in ./.env only.
const path = require("path");

module.exports = {
  apps: [
    {
      name: "ads-dashboard",
      cwd: __dirname,
      script: path.join("node_modules", "next", "dist", "bin", "next"),
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1, // keep 1: the in-process daily cron must not run in parallel
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production", PORT: "3000" },
      time: true,
    },
  ],
};
