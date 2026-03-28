module.exports = {
  apps: [{
    name: '911-marketing-hub',
    script: 'npx',
    args: 'vite --port 3000 --host 0.0.0.0',
    cwd: '/home/user/webapp',
    env: {
      NODE_ENV: 'development'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000
  }]
}
