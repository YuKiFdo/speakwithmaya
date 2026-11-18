const fs = require('fs');
const path = require('path');

// dist/main.js is the single-file bundle (scripts/bundle.mjs): loading one pre-linked file
// instead of thousands of node_modules files makes the boot much cheaper on the 2-vCPU VMs.
// Emergency fallback to the plain tsc output: BACKEND_BUNDLE=0 in the shell that runs
// `pm2 delete maya-backend && pm2 start ecosystem.config.cjs` (a reload keeps the old path).
const useUnbundled =
  process.env.BACKEND_BUNDLE === '0' && fs.existsSync(path.join(__dirname, 'dist', 'main.unbundled.js'));

module.exports = {
  apps: [
    {
      name: 'maya-backend',
      script: useUnbundled ? 'dist/main.unbundled.js' : 'dist/main.js',
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
