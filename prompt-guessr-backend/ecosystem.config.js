/**
 * PM2 Ecosystem Configuration
 * Production process management for Node.js backend
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'prompt-guessr-backend',
      script: './dist/index.js',
      
      // Single instance (free tier EC2 is single-core)
      instances: 1,
      exec_mode: 'fork', // Use 'cluster' for multi-core with multiple instances
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Auto-restart configuration
      autorestart: true,
      watch: false, // Don't watch files in production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      
      // Restart delays
      min_uptime: '10s', // Consider app crashed if doesn't stay up for 10s
      max_restarts: 10, // Max restart attempts before giving up
      restart_delay: 4000, // Wait 4s before restarting
      
      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Log rotation (prevent logs from growing too large)
      max_size: '10M',
      retain: 5, // Keep last 5 rotated logs
      
      // Graceful shutdown
      kill_timeout: 5000, // Wait 5s for graceful shutdown before SIGKILL
      wait_ready: true, // Wait for process.send('ready') signal
      listen_timeout: 3000,
      
      // Source map support for better error traces
      source_map_support: true,
      
      // Process signals
      shutdown_with_message: true,
    },
  ],
  
  /**
   * Deployment configuration (optional, for PM2 deploy command)
   */
  deploy: {
    production: {
      user: 'ec2-user',
      host: process.env.EC2_HOST || 'your-ec2-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/prompt-guessr.git',
      path: '/home/ec2-user/prompt-guessr',
      
      // Pre-deploy commands (run on server)
      'pre-deploy-local': "echo 'Deploying to production...'",
      
      // Post-deploy commands (run on server after git pull)
      'post-deploy': [
        'cd prompt-guessr-backend',
        'npm ci --production',
        'npm run build',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save',
      ].join(' && '),
      
      // Pre-setup commands (run once on first deployment)
      'pre-setup': '',
    },
  },
};
