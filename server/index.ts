import "./env.js"; // Load .env before anything else (must be first import)
import express from "express";
import cors from "cors";
import { metricsRouter } from "./routes/metrics.js";
import { alertsRouter } from "./routes/alerts.js";
import { merchantHealthRouter } from "./routes/merchantHealth.js";
import { webhookAlertsRouter } from "./routes/webhookAlerts.js";
import { partnerRiskRouter } from "./routes/partnerRisk.js";
import { notificationFailuresRouter } from "./routes/notificationFailures.js";
import { linearRouter } from "./routes/linear.js";
import { amigoRouter } from "./routes/amigo.js";
import { portfolioDigestRouter } from "./routes/portfolioDigest.js";
import { predictiveAlertsRouter } from "./routes/predictiveAlerts.js";
import { alertActionsRouter } from "./routes/alertActions.js";
import { settingsRecommendationsRouter } from "./routes/settingsRecommendations.js";
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { slackRouter } from "./routes/slack.js";
import { pool } from "./db.js";

const app = express();
const PORT = process.env.API_PORT || 3001;

async function ensureSchema() {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS pulse`);
    await pool.query(`CREATE TABLE IF NOT EXISTS pulse.alert_resolutions (
      id SERIAL PRIMARY KEY,
      alert_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('resolved', 'dismissed')),
      resolved_by TEXT,
      notes TEXT,
      insight_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alert_resolutions_alert_id ON pulse.alert_resolutions(alert_id)`);
    console.log("Schema ensured: pulse.alert_resolutions");
  } catch (err: any) {
    console.warn("Schema setup skipped:", err.message);
  }
}

app.use(cors());
app.use(express.json());

app.use("/api/metrics", metricsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/merchant-health", merchantHealthRouter);
app.use("/api/alerts/webhooks", webhookAlertsRouter);
app.use("/api/partner-risk", partnerRiskRouter);
app.use("/api/notification-failures", notificationFailuresRouter);
app.use("/api/linear", linearRouter);
app.use("/api/amigo", amigoRouter);
app.use("/api/portfolio-digest", portfolioDigestRouter);
app.use("/api/alerts/predictive", predictiveAlertsRouter);
app.use("/api/alerts", alertActionsRouter);
app.use("/api/settings/recommendations", settingsRecommendationsRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/slack", slackRouter);

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: result.rows[0].ok === 1 });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

ensureSchema().then(() => {
  app.listen(PORT, () => {
    console.log(`Pulse API server running on http://localhost:${PORT}`);
  });
});
