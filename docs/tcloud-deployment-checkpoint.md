# Dodola — TCloud source checkpoint

This branch contains the complete current application source and public assets.
It is a clean snapshot with no inherited local Git history. The existing remote
main branch and its archive are unchanged.

No deployment, DNS update, production database write, migration, import, R2
operation or payment activation is authorized by this checkpoint.

Use Node.js 22. Environment reference templates are
`docs/environment.example` and `docs/payment-environment.example`. They contain
placeholders only. Actual `.env` files, credentials, `data/`, `uploads/`, local
backups, dependency folders and test output are deliberately excluded.
Keep `PUBLIC_WRITES_ENABLED=false` and payments disabled. Do not replace an
existing environment file or database with these templates or test fixtures.

Clone to a **new directory**, separate from any existing production checkout:

```sh
git clone --single-branch --branch deploy/tcloud-2026-10-20 https://github.com/Azimjon7/Sale-Market1.git dodola-tcloud-20261020
cd dodola-tcloud-20261020
git rev-parse HEAD
```

These commands only download source. Do not start the application, run database
migrations, import JSON, synchronize storage or modify DNS until the next
explicit deployment approval. The catalog, customer/order records and product
uploads remain in their existing storage; none are bundled in this branch.

Validation uses synthetic isolated storage. The migration regression fixture is
generated rather than copied from private shop data. Browser fixtures can also
run from a clean checkout without shipping a private catalog or uploads.
Real PostgreSQL concurrency and merchant acceptance require separately
authorized environments. Payme, Click, Uzum and bank card remain UI-only.
