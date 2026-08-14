// PM2 process config for production (cPanel / AlmaLinux host).
// Runs `next start` bound to loopback; Apache reverse-proxies the subdomain to it.
// `next start` loads .env from this directory, so secrets stay in ./.env only.
//
// Port: defaults to 3001 (3000 is used by another app on this host). Override by
// exporting PORT before `pm2 start`/`pm2 reload`, and keep the Apache proxy target
// (deploy/*.conf) in sync.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

module.exports = {
  apps: [
    {
      name: "ads-dashboard",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -H 127.0.0.1 -p ${PORT}`,
      instances: 1, // keep 1: the in-process daily cron must not run in parallel
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production", PORT: String(PORT) },
      time: true,
    },
  ],
};
