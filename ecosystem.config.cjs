module.exports = {
  apps: [
    {
      name: 'milk-can-mes-server',
      script: './server/src/app.js',
      cwd: '/opt/milk-can-mes',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_NAME: 'milk_can_mes',
        DB_USER: 'milk_can_mes',
        DB_PASSWORD: 'milk-can-2026',
        JWT_SECRET: 'milk-can-mes-jwt-secret-key-2026',
        UPLOAD_DIR: './uploads'
      },
      error_file: '/opt/backups/pm2-error.log',
      out_file: '/opt/backups/pm2-out.log',
      log_file: '/opt/backups/pm2-combined.log',
      time: true
    }
  ]
}
