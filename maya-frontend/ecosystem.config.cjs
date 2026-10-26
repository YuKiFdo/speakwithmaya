module.exports = {
  apps: [
    {
      name: 'maya-frontend',
      script: './web-server/server.js',
      cwd: '/home/speakwithmaya/apps/maya-frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        STATIC_ROOT: '/home/speakwithmaya/apps/maya-frontend/dist',
      },
    },
  ],
};
