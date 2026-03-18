module.exports = {
  apps: [
    // Ingestion — every 6 hours
    { name: 'intel-rss', script: 'dist/ingest-rss.js', cron_restart: '0 */6 * * *', autorestart: false, env: { NODE_ENV: 'production' } },
    { name: 'intel-federal-register', script: 'dist/ingest-federal-register.js', cron_restart: '0 6 * * *', autorestart: false },
    { name: 'intel-congress', script: 'dist/ingest-congress.js', cron_restart: '0 7 * * *', autorestart: false },
    { name: 'intel-regulations', script: 'dist/ingest-regulations.js', cron_restart: '0 8 * * *', autorestart: false },
    { name: 'intel-score', script: 'dist/score-relevance.js', cron_restart: '0 9 * * *', autorestart: false },

    // Analysis
    { name: 'intel-briefing', script: 'dist/generate-briefing.js', cron_restart: '0 5 * * 1', autorestart: false },
    { name: 'intel-monthly', script: 'dist/monthly-summary.js', cron_restart: '0 6 1 * *', autorestart: false },
    { name: 'intel-reliability', script: 'dist/reliability-scoring.js', cron_restart: '0 3 * * 0', autorestart: false },
    { name: 'intel-health-check', script: 'dist/soul-health-check.js', cron_restart: '0 7 1 * *', autorestart: false },

    // Maintenance
    { name: 'intel-memory', script: 'dist/consolidate-memory.js', cron_restart: '0 4 * * 6', autorestart: false },
    { name: 'intel-calendar', script: 'dist/update-calendar-status.js', cron_restart: '0 0 * * *', autorestart: false },
    { name: 'intel-archive', script: 'dist/archive-conversations.js', cron_restart: '0 2 * * 6', autorestart: false },

    // Continuous
    { name: 'intel-embed', script: 'dist/embed-content.js', autorestart: true, max_restarts: 10 },
  ],
};
