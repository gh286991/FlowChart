module.exports = {
  apps: [
    {
      name: "flowchart",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: Number(process.env.WEB_CONCURRENCY || 2),
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "750M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
