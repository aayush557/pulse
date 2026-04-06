# Pulse

Payment operations intelligence platform for Payabli. Real-time monitoring, alerting, and AI-powered analysis across the merchant portfolio.

## What it does

- **Metrics Dashboard** -- Pay In/Out volume, transaction counts, customer/vendor trends with 7-day forecasting
- **Alert Center** -- Failed payouts, chargebacks, high decline rates, merchant inactivity, and ML-driven predictive signals
- **Merchant Health** -- Top merchants scored into healthy/monitoring/at-risk tiers with trend sparklines
- **Notification Failures** -- Webhook delivery errors grouped by endpoint, analyzed by Claude AI with root cause, impact, and auto-generated Linear tickets
- **Partner Risk** -- ML pipeline proxy for beta-binomial risk scoring, peer z-scores, and time-series anomaly detection

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts, TanStack Query |
| Backend | Express 5, Node.js, TypeScript |
| Database | PostgreSQL (Payabli read-replica) |
| AI | Anthropic Claude API (webhook failure analysis) |
| ML | Python -- beta-binomial models, peer z-scores, CUSUM time-series |
| Integrations | Linear (ticket creation), Vite (build) |

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, ANTHROPIC_API_KEY
# Optional: LINEAR_API_KEY (enables direct ticket creation)

# Start dev server (frontend on :8080, API on :3001)
npm run dev
```

### ML pipeline (optional)

```bash
cd ml
pip install -r requirements.txt
python -m uvicorn api:app --port 8100
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PGHOST` | Yes | PostgreSQL host |
| `PGPORT` | Yes | PostgreSQL port (default 5432) |
| `PGDATABASE` | Yes | Database name |
| `PGUSER` | Yes | Database user |
| `PGPASSWORD` | Yes | Database password |
| `PGSSLMODE` | Yes | SSL mode (use `require`) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for webhook failure analysis |
| `LINEAR_API_KEY` | No | Linear API key -- enables "Create in Linear" from notification failures |
| `API_PORT` | No | Backend port (default 3001) |
| `ML_API_URL` | No | ML service URL (default `http://localhost:8100`) |

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | DB connectivity check |
| GET | `/api/metrics/summary` | Monthly metrics with trends and forecasts |
| GET | `/api/alerts` | Live alerts (payouts, chargebacks, declines, inactivity) |
| GET | `/api/merchant-health` | Top 20 merchants with health tiers |
| GET | `/api/alerts/webhooks` | Webhook failure alerts by endpoint |
| GET | `/api/notification-failures` | AI-analyzed webhook failures with ticket generation |
| POST | `/api/notification-failures/refresh` | Clear AI analysis cache |
| GET | `/api/partner-risk` | ML risk scores (supports `?tier=` and `?limit=`) |
| GET | `/api/linear/config` | Linear connection status and available teams |
| POST | `/api/linear/issues` | Create a Linear issue as draft |

## Scripts

```bash
npm run dev          # Run frontend + backend concurrently
npm run dev:client   # Vite dev server only (:8080)
npm run dev:server   # Express API only (:3001)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

## Project structure

```
pulse/
  server/
    index.ts                  # Express app entry point
    db.ts                     # PostgreSQL connection pool
    routes/
      metrics.ts              # Pay In/Out aggregation + forecasting
      alerts.ts               # Chargeback, payout, decline, inactivity alerts
      merchantHealth.ts       # Merchant health scoring
      webhookAlerts.ts        # Webhook failure grouping
      notificationFailures.ts # Claude-powered failure analysis
      linear.ts               # Linear ticket creation
      partnerRisk.ts          # ML pipeline proxy
    templates/
      webhookReplies.ts       # Email templates by failure type
  src/
    pages/Index.tsx            # Main page with tabbed views
    components/                # React UI components
    hooks/useDashboardData.ts  # TanStack Query hooks for all endpoints
    types/api.ts               # TypeScript interfaces
    data/                      # Mock/seed data for predictive alerts
  ml/
    api.py                     # FastAPI service
    pipeline.py                # Risk scoring orchestrator
    models/                    # Beta-binomial, z-score, time-series models
```
