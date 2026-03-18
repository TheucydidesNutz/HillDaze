# Intel Workers — Mac Mini Background Infrastructure

Standalone Node.js scripts for Covaled Intelligence background processing.
Run on Mac Mini via PM2 on scheduled cron jobs.

## Setup

```bash
cd workers/intel
npm install
cp .env.example .env  # Fill in credentials
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on reboot
```

## Workers

### Ingestion (every 6 hours)
- **ingest-rss** — RSS feeds + competitive sources
- **ingest-federal-register** — Federal Register API (daily)
- **ingest-congress** — Congress.gov API (daily)
- **ingest-regulations** — Regulations.gov API (daily)
- **score-relevance** — Claude-based relevance scoring + calendar/stakeholder extraction + research target matching

### Analysis
- **generate-briefing** — Weekly executive briefing (Monday 5am)
- **monthly-summary** — Monthly intelligence summary (1st of month)
- **reliability-scoring** — Team member reliability assessment (Sunday 3am)
- **soul-health-check** — Soul document alignment analysis (1st of month)

### Maintenance
- **consolidate-memory** — Decay/archive stale agent memories (Saturday 4am)
- **update-calendar-status** — Mark imminent/passed calendar events (daily midnight)
- **archive-conversations** — Summarize + archive 90-day old conversations (Saturday 2am)

### Continuous
- **embed-content** — Ollama embedding worker, polls queue every 5 seconds

## Ollama Setup

```bash
brew install ollama
ollama pull nomic-embed-text
# Verify: curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}'
```

## Monitoring

```bash
pm2 monit    # Terminal dashboard
pm2 logs     # All logs
pm2 status   # Process list
```
