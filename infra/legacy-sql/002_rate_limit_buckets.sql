-- Shared rate limiting for several API instances (RATE_LIMIT_STORE=postgres).
-- bucket_key is a SHA-256 of limiter name + key, so IPs and nicknames are not stored.
CREATE TABLE rate_limit_buckets (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 1 CHECK (hits > 0),
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX rate_limit_buckets_expires_at_idx ON rate_limit_buckets(expires_at);
