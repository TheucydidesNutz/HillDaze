module.exports = {
  apps: [
    // Job runner — polls every 5 seconds for pending analysis jobs (research, fact sheet, voice)
    {
      name: 'analysis-job-runner',
      script: 'job-runner.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    // Research pipeline — polls every 5 minutes for pending profiles (legacy, kept for backward compat)
    { name: 'analysis-research', script: 'dist/research-pipeline.js', cron_restart: '*/5 * * * *', autorestart: false, env: { NODE_ENV: 'production' } },
    // Monitoring — polls every 5 minutes for due monitoring configs
    { name: 'analysis-monitoring', script: 'dist/monitoring-worker.js', cron_restart: '*/5 * * * *', autorestart: false, env: { NODE_ENV: 'production' } },
    // Soul document proposals — weekly
    { name: 'analysis-soul-proposals', script: 'dist/soul-proposals.js', cron_restart: '0 6 * * 1', autorestart: false, env: { NODE_ENV: 'production' } },
  ],
};
