-- Apply only to an isolated database until an approved, restore-verified live backup exists.
BEGIN;
CREATE TABLE IF NOT EXISTS payment_attempts (
 id text PRIMARY KEY,
 sequence_id bigserial UNIQUE,
 order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK(provider IN ('payme','click','uzum')),
 mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 idempotency_key text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 currency text NOT NULL DEFAULT 'UZS' CHECK(currency='UZS'),
 status text NOT NULL CHECK(status IN ('created','pending','paid','failed','cancelled','refunded','partially_refunded','review')),
 provider_id text,
 provider_doc_id text,
 checkout_url text,
 provider_time bigint,
 created_at bigint NOT NULL,
 paid_at bigint,
 cancelled_at bigint,
 cancel_reason integer,
 refunded_minor bigint NOT NULL DEFAULT 0 CHECK(refunded_minor>=0 AND refunded_minor<=amount_minor),
 updated_at bigint NOT NULL,
 UNIQUE(order_id,idempotency_key),
 UNIQUE(provider,mode,provider_id),
 UNIQUE(provider,mode,provider_doc_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_open_order ON payment_attempts(order_id) WHERE status IN ('created','pending','paid','review','partially_refunded');
CREATE INDEX IF NOT EXISTS payment_attempts_order ON payment_attempts(order_id,created_at);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending_confirmation','confirmed','payment_pending','awaiting_payment','paid','production','shipped','delivered','rejected','cancelled'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK(payment_status IN ('pending','collected','failed','refunded','partially_refunded'));
ALTER TABLE order_payments DROP CONSTRAINT IF EXISTS order_payments_status_check;
ALTER TABLE order_payments ADD CONSTRAINT order_payments_status_check CHECK(status IN ('pending','collected','failed','refunded','partially_refunded'));
COMMIT;
