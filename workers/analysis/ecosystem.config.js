module.exports = {
  apps: [
    // Research pipeline — polls every 5 minutes for pending profiles
    { name: 'analysis-research', script: 'dist/research-pipeline.js', cron_restart: '*/5 * * * *', autorestart: false, env: { NODE_ENV: 'production' } },
    // Monitoring — polls every 5 minutes for due monitoring configs
    { name: 'analysis-monitoring', script: 'dist/monitoring-worker.js', cron_restart: '*/5 * * * *', autorestart: false, env: { NODE_ENV: 'production' } },
    // Soul document proposals — weekly
    { name: 'analysis-soul-proposals', script: 'dist/soul-proposals.js', cron_restart: '0 6 * * 1', autorestart: false, env: { NODE_ENV: 'production' } },
  ],
};
