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
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
