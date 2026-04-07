CREATE SCHEMA IF NOT EXISTS pulse;
CREATE TABLE IF NOT EXISTS pulse.alert_resolutions (
  id SERIAL PRIMARY KEY,
  alert_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('resolved', 'dismissed')),
  resolved_by TEXT,
  notes TEXT,
  insight_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_resolutions_alert_id ON pulse.alert_resolutions(alert_id);
