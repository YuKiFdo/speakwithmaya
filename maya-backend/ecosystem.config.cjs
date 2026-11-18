module.exports = {
  apps: [
    {
      name: 'maya-backend',
      script: 'dist/main.js',
      cwd: '/home/speakwithmaya/apps/maya-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Zero-downtime reload: the old process keeps serving until the new one calls
      // process.send('ready') after app.listen() (see src/main.ts). Without this, PM2
      // stopped the old process immediately and the API returned 502s for the whole boot.
      wait_ready: true,
      // Max wait for the new process's 'ready' before PM2 assumes it is up and stops the old one.
      // 5 min was exceeded when the boot was CPU-starved (apt + parallel deploy), killing the old
      // process before the new one listened. 15 min keeps the old one serving in that case.
      listen_timeout: 900000,
      kill_timeout: 10000, // let in-flight requests finish before the old process is killed
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
