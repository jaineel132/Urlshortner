CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  short_code TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS analytics_events_short_code_clicked_at_idx
  ON analytics_events (short_code, clicked_at DESC);
