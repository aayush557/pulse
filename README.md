# Pulse

Payment operations intelligence platform for Payabli. Real-time monitoring, alerting, and AI-powered analysis across the merchant portfolio.

## What it does

**Metrics Dashboard** — Pay In/Out volume, transaction counts, customer/vendor trends with 7-day forecasting

**Alert Center (Pulse Center)** — Failed payouts, chargebacks, high decline rates, merchant inactivity, and ML-driven predictive signals. Supports time range filtering (24h / 7d / 30d), keyboard navigation (j/k/Enter/Esc), CSV export, and persistent alert resolution tracking.

**Amigo Intelligence** — AI-powered portfolio command center. Clicking the notification bell or navigating to Amigo Intelligence opens a unified view with portfolio digest, predictive alert summaries, and a live chat interface powered by Claude. Ask Amigo anything about the portfolio — trends, anomalies, merchant status.

**Merchant Health** — Top merchants scored into healthy/monitoring/at-risk tiers with trend sparklines

**Notification Failures** — Webhook delivery errors grouped by endpoint, analyzed by Claude AI with root cause, impact, and auto-generated Linear tickets. Robust JSON parsing with 3-tier fallback for reliable AI responses.

**Partner Risk** — ML pipeline proxy for beta-binomial risk scoring, peer z-scores, and time-series anomaly detection

**Alert Actions** — Resolve or dismiss alerts with persistence, test webhooks with real HTTP calls, trigger AI-generated resolution insights per alert, and create Linear issues directly from the UI.

**Settings & Recommendations** — Statistical threshold recommendations (p50/p75/p90) derived from real portfolio data. Alert subscription toggles per category.

**Contact Support** — Three support channels: Email, Phone, and Slack (posts directly to a configurable Slack webhook with structured Block Kit messages).

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts, TanStack Query |
| Backend | Express 5, Node.js, TypeScript (tsx, ESM) |
| Database | PostgreSQL (Payabli read-replica via Tailscale VPN) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) — webhook analysis, portfolio digest, alert insights, Amigo chat |
| ML | Python — beta-binomial models, peer z-scores, CUSUM time-series |
| Integrations | Linear SDK (issue creation), Slack Incoming Webhooks, Vite (build) |
| Testing | Vitest, Testing Library, Supertest — 116 tests (56 backend, 60 frontend) |

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, ANTHROPIC_API_KEY
# Optional: LINEAR_API_KEY, SLACK_WEBHOOK_URL

# Connect Tailscale VPN (required to reach the PostgreSQL read-replica)

# Start dev server (frontend on :8080, API on :3001)
npm run dev
```

## ML pipeline (optional)

```bash
cd ml
pip install -r requirements.txt
python -m uvicorn api:app --port 8100
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| PGHOST | Yes | PostgreSQL host (use private IP, e.g. 10.0.102.104) |
| PGPORT | Yes | PostgreSQL port (default 5432) |
| PGDATABASE | Yes | Database name |
| PGUSER | Yes | Database user |
| PGPASSWORD | Yes | Database password |
| PGSSLMODE | Yes | SSL mode (use `require`) |
| ANTHROPIC_API_KEY | Yes | Claude API key — powers Amigo chat, portfolio digest, alert insights, webhook analysis |
| LINEAR_API_KEY | No | Linear API key — enables issue creation from notification failures |
| SLACK_WEBHOOK_URL | No | Slack incoming webhook — enables support messages via Contact Support dialog |
| API_PORT | No | Backend port (default 3001) |
| ML_API_URL | No | ML service URL (default http://localhost:8100) |

## API routes

| Method | Route | Description |
|---|---|---|
| GET | /api/health | DB connectivity check |
| GET | /api/metrics/summary | Monthly metrics with trends and forecasts |
| GET | /api/alerts | Live alerts with optional `?days=` time range filter |
| GET | /api/merchant-health | Top 20 merchants with health tiers |
| GET | /api/alerts/webhooks | Webhook failure alerts by endpoint |
| GET | /api/notification-failures | AI-analyzed webhook failures with ticket generation |
| POST | /api/notification-failures/refresh | Clear AI analysis cache |
| GET | /api/partner-risk | ML risk scores (supports `?tier=` and `?limit=`) |
| GET | /api/portfolio-digest | AI-generated portfolio summary with merchant breakdown |
| GET | /api/predictive-alerts | Linear regression on 14-day decline trends |
| POST | /api/alerts/:id/action | Resolve, dismiss, test webhook, retry payout, rotate token |
| POST | /api/alerts/:id/insight | Claude-generated resolution insight for a specific alert |
| GET | /api/alert-resolutions | Fetch all persisted alert resolutions |
| POST | /api/amigo/chat | Amigo Intelligence chat endpoint (Claude with portfolio context) |
| GET | /api/settings/recommendations | Statistical threshold recommendations from portfolio data |
| GET | /api/subscriptions | Alert subscription preferences |
| POST | /api/subscriptions | Update alert subscription preferences |
| GET | /api/linear/config | Linear connection status and available teams |
| POST | /api/linear/issues | Create a Linear issue |
| POST | /api/slack/support | Send a support message to Slack |

## Scripts

```bash
npm run dev          # Run frontend + backend concurrently
npm run dev:client   # Vite dev server only (:8080)
npm run dev:server   # Express API only (:3001, hot reload)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run once, 116 tests)
npm run test:watch   # Vitest (watch mode)
```

## Project structure

```
pulse/
  server/
    index.ts                    # Express app entry point + schema setup
    db.ts                       # PostgreSQL connection pool
    env.ts                      # dotenv loader (override mode for Node v24+)
    routes/
      metrics.ts                # Pay In/Out aggregation + forecasting
      alerts.ts                 # Chargeback, payout, decline, inactivity alerts
      merchantHealth.ts         # Merchant health scoring
      webhookAlerts.ts          # Webhook failure grouping
      notificationFailures.ts   # Claude-powered failure analysis (3-tier JSON parsing)
      alertActions.ts           # Alert resolve/dismiss/test/insight actions
      amigo.ts                  # Amigo Intelligence chat (Claude + portfolio context)
      portfolioDigest.ts        # AI portfolio digest with merchant breakdown
      predictiveAlerts.ts       # Linear regression trend detection
      settingsRecommendations.ts# Statistical p50/p75/p90 recommendations
      subscriptions.ts          # Alert subscription preferences
      slack.ts                  # Slack support message delivery
      linear.ts                 # Linear issue creation
      partnerRisk.ts            # ML pipeline proxy
    migrations/
      001_alert_resolutions.sql # Alert resolution persistence schema
    templates/
      webhookReplies.ts         # Email templates by failure type
    __tests__/
      routes.test.ts            # 56 backend route tests (supertest + mocked DB)
  src/
    pages/Index.tsx             # Main page with view routing
    components/
      PulseCenterView.tsx       # Alert center with keyboard nav, filters, CSV export
      AmigoIntelligenceView.tsx # AI intelligence hub with portfolio digest + chat
      AmigoPanel.tsx            # Claude chat interface
      AlertDetailPanel.tsx      # Alert detail with actions + AI insight
      DashboardView.tsx         # Metrics dashboard
      MerchantHealthCards.tsx   # Merchant health tiers
      NotificationFailuresView.tsx
      PartnerRiskView.tsx
      PortfolioDigest.tsx       # AI portfolio summary component
      PulseSettingsView.tsx     # Settings + recommendations + subscriptions
      ContactSupportDialog.tsx  # Email / Phone / Slack support
      TopBar.tsx                # Bell badge + navigation
      AppSidebar.tsx            # Nav with dynamic alert badge
      __tests__/                # 60 frontend component tests
    hooks/useDashboardData.ts   # TanStack Query hooks for all endpoints
    types/api.ts                # TypeScript interfaces
    data/                       # Fallback data for predictive alerts and insights
  ml/
    api.py                      # FastAPI service
    pipeline.py                 # Risk scoring orchestrator
    export_data.py              # PostgreSQL → Parquet export for ML pipeline
    models/                     # Beta-binomial, z-score, time-series models
```
