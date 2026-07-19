module.exports = {
  apps: [
    {
      name: 'milk-can-mes-api',
      script: './src/app.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: '/opt/milk-can-mes/server',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: ['./src'],
      watch_options: {
        usePolling: true,
        interval: 1000,
        binaryInterval: 1000,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
      },
      ignore_watch: ['node_modules', 'logs', 'uploads', 'data', 'dist'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        DB_DIALECT: 'mysql',
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_NAME: 'milk_can_mes',
        DB_USER: 'milk_can_mes',
        DB_PASSWORD: 'milk-can-2026',
        JWT_SECRET: 'milk-can-mes-jwt-secret-key-2026',
        UPLOAD_DIR: '/opt/milk-can-mes/uploads'
      },
      error_file: '/opt/milk-can-mes/logs/pm2-api-error.log',
      out_file: '/opt/milk-can-mes/logs/pm2-api-out.log',
      time: true
    },
    {
      name: 'milk-can-mes-web',
      script: './node_modules/.bin/vite',
      interpreter: 'node',
      cwd: '/opt/milk-can-mes',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '/opt/milk-can-mes/logs/pm2-web-error.log',
      out_file: '/opt/milk-can-mes/logs/pm2-web-out.log',
      time: true
    }
  ]
}
