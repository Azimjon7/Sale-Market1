CREATE TABLE IF NOT EXISTS storefront_events_daily (
  event_day date NOT NULL DEFAULT CURRENT_DATE,
  event_name text NOT NULL,
  subject_id text NOT NULL DEFAULT '',
  event_count bigint NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_day, event_name, subject_id)
);

CREATE INDEX IF NOT EXISTS storefront_events_daily_event_idx
  ON storefront_events_daily (event_name, event_day DESC);
