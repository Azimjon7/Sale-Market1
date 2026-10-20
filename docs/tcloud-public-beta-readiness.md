# TCloud public beta readiness — 2026-10-20

Status: **not publicly launched**. DNS still points to Railway. Public writes remain
disabled and every payment provider remains UI-only. Never report a payment as
successful without a real verified provider transaction.

## Catalog decision

The read-only audit compared `Dodoola-backup-2026-10-09.zip` with the current local
catalog and the verified local checkpoint. Both contain 1,164 unique product IDs,
35 categories, 218 variant values and 3,453 image references. No products were
added or removed; prices, original prices, categories, variants and images match.
The current catalog adds all 1,164 SKUs and has newer made-to-order/availability
settings for 1,142 products. **Use the current catalog, not the older ZIP.**

The clean export excludes all historical test customers, sessions, auth tokens,
orders, payments, reviews and promotions. It reconciles only the known disposable
test-order stock movements against the original inventory ledger. Ledger balances
do not establish supplier availability: made-to-order confirmation remains required.
Original archives, local data, Neon and Railway are preserved.

## Actual PostgreSQL validation

- PostgreSQL 15.19 isolated import: full preservation verification passed.
- Separate empty restore database: transactionally restored the clean custom dump,
  without ignoring SQL errors. Row counts, constraints, sequences and source
  preservation checks passed.
- Separate new beta database: restored the same verified clean dump; 1,164 products,
  35 categories, 218 variants, zero historical customers/orders/payment attempts.
- Existing `dodola_db` was not replaced, dropped or imported into.
- Clean archive SHA-256:
  `510187b9830f21049e1796b42fe64a6862771ec30590758e6fbdecd55098e80e`.

Real PG15 isolated workflow checks passed for registration/login, profile/address,
catalog, persisted order items/contact/delivery/payment preference, price authority,
concurrent idempotency, admin authorization/confirmation, customer tracking,
cancellation, Tashkent-city boundaries and payment safety. Test email and admin
notification transports in that workflow are explicitly stubbed.

A separate real Resend send from the custom domain to the configured owner test
recipient was accepted. Delivery is **not verified**: the sending-only API key
cannot read message status. No broader API key or OAuth access was granted.

Private production-mode staging binds loopback only, serves all ten checked customer
pages, reads the real catalog/R2 images and blocks public registration/orders with
503. `.env` is inaccessible over HTTP. Cyrillic and Latin searches now use the same
shared engine; actual PG15 searches and literal wildcard handling passed.

Local focused regression: 173 Node tests, 172 passed, zero failed, one optional
local real-PostgreSQL test skipped. Actual TCloud PG15 workflow tests cover the
concurrent submission separately. The legacy `npm test` Jest suite is **not green**:
backup folders cause module-name collisions; limiting discovery to `test/` reveals
outdated direct-app imports (`app.address is not a function`) and older standalone
order assertions/process exits. These legacy harness issues are not silently
counted as passing. The current catalog/categories/inventory were checked against
the pre-test checkpoint afterward and are unchanged.

## Backup and recovery

Daily 03:17 Asia/Tashkent cron dumps the dedicated beta database using PG15 tools,
encrypts it with AES-256-GCM, uploads to the separately verified private R2 bucket,
then downloads, authenticates, decrypts and compares hashes. It retains encrypted
artifacts and never removes original source backups. The recovery key has a private
off-server copy. Independent off-server download/decryption reproduced the exact
archive that passed the actual PG15 restore test.

The current implementation refuses dumps larger than 64 MiB; add streaming before
that limit is reached. Backup failures produce a nonzero exit and private log;
external failure alerting is not yet configured. Do not assume cron execution alone
proves future backups will remain healthy.

## Launch gates still open

1. Rotate the exposed/reused database and site-admin passwords, update private
   configuration/pgpass files, then recheck database, backup and admin connections.
   Do not paste credentials into chat or shell command history.
2. Resolve SSL installation: a genuine Cloudflare Origin CA certificate passed
   local chain, hostname and private-key verification, but ISPmanager rejected its
   import. The active host certificate is still self-signed. The exact panel cause
   is not confirmed. Origin CA requires Cloudflare proxy + Full (strict); it is not
   directly browser-trusted. Never bypass certificate validation for customers.
3. Promote the app through the hosting Node handler and verify automatic restart,
   correct proxy/PORT binding, production secure cookies and HTTPS browser flows.
   Loopback staging is not the public hosting handler.
4. Confirm real owner notification/email delivery, fulfillment and cancellation
   behavior. Online providers remain unavailable; do not bypass paid-state gates
   or pretend UI-only payment preferences are completed payments.
5. Complete mobile/desktop production-mode browser QA after HTTPS is available.
6. Only after critical backend/security/HTTPS checks pass may public writes be
   enabled for the controlled beta. Obtain explicit user confirmation immediately
   before DNS cutover; preserve the Railway target for rollback.

No Neon deletion, Railway change, public asset modification, paid service activation
or live payment activation was performed.
