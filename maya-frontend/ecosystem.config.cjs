module.exports = {
  apps: [
    {
      name: 'maya-frontend',
      script: './web-server/server.js',
      cwd: '/home/speakwithmaya/apps/maya-frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      // Zero-downtime reload: server.js calls process.send('ready') once listening
      wait_ready: true,
      listen_timeout: 60000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        STATIC_ROOT: '/home/speakwithmaya/apps/maya-frontend/dist',
      },
    },
  ],
};
