module.exports = {
  apps: [
    {
      name: 'maya-frontend',
      script: 'serve',
      cwd: '/home/speakwithmaya/apps/maya-frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 8080,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: './dist/index.html',
      },
    },
  ],
};
