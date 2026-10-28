# Dodola production source checkpoint — 28 October 2026

Recommended deployment branch: `deploy/tcloud-production-2026-10-28`.
This synchronization does not deploy or restart production.

## Source provenance

The production release is `dodola-17f7a78`, with two verified file patches:

| File | Source commit | Production SHA-256 |
| --- | --- | --- |
| `product-details.html` | `75ebccee87816396afaeaed2dcf08401bcd5b9b6` | `675f9197f2d2cd69f46a94ec6d8ad3396c8618baf9670f4ef470318891ca4bd9` |
| `utils/postgres/orderInventoryRepository.js` | `a7e20b2f39973c46bbb12fe139b2c73b0d5c5f13` | `f2e24245ed8d380d5dab5f6d227bca052b14f69858709f30ae61909d142bdf42` |

The owner ran a read-only recursive comparison on TCloud against the immutable
GitHub archive at `a7e20b2`. All application source files matched. The only
differences were these repository-only verification additions:

- `scripts/audit-handover-catalog.cjs`
- `scripts/stage-missing-product-images.cjs`
- `test/product-route-browser.cjs`
- `test/storefront-seo.test.cjs`
- `test/postgres-migration.test.cjs`
- `test/postgres-express-integration.test.cjs`

The comparison intentionally excluded dependencies, `.git`, environment files,
runtime data, uploads, artifacts, local test directories and rollback copies.
It does not assert equality of those excluded items or of the external hosting
launcher. The release directory has no Git repository. Its production version
is therefore identified by the release plus the file hashes above, rather than
by a running Git HEAD.

The hosting launcher is outside this release. It uses Node.js 22, loads the
private environment outside the repository and starts `createApp` with PostgreSQL
and external runtime directories. Preserve this hosting configuration during
handover; do not replace it with an old GitHub checkout. Environment credentials
and recovery keys must be handed over separately through the owner's secure
channel. Payment mode remains disabled in the production launcher previously
inspected. No environment or hosting settings were changed by this sync.

## Preserved history and recovered work

Local checkpoint: `checkpoint/pre-production-sync-20261028` at `a7e20b2`.
The new branch retains the existing history, including all 13 commits newer than
`deploy/tcloud-2026-10-20`, the product hotfix, the read-only audit additions
(`7793805`), and the settled-order deletion fix (`a7e20b2`).

The local `9827195` work was reviewed. Its safe environment default already exists
in `docs/environment.example`. Its additional launch-lock tests were recovered
and adapted to that template path and the current delivery payload. No older
runtime code was merged over production. Other valid local checkouts were clean;
`sale-market-public-lock` has an invalid HEAD and no default refs, and was left
untouched.

Browser tests now wait for product rendering before inspecting variant counts,
accept the supported `search` and `q` query parameters, and wait for the checkout
submit handler to initialize. Checkout failures save a screenshot and diagnostic
details from isolated synthetic data. These changes affect tests only.

## Validation

- Node.js 22.23.4 core suite: **189 passed, 0 failed, 1 skipped** (190 total).
  The skipped case requires an isolated real PostgreSQL instance and checks
  concurrent promo/payment attempts. PostgreSQL behavior covered by the default
  suite uses its isolated test fixtures; production was not used for writes.
- Product browser suite: **24 checks passed**, no page errors or failed JS/CSS
  assets, at 1440, 390 and 360 pixels. Includes nested and query-string product
  routes, prices, images, variants, cart, refresh, dependency failure, homepage,
  catalog, search and buy-now navigation to checkout.
- Public HTTPS smoke test: **18 GET-only checks passed**, including ten product
  URLs, homepage, catalog, cart, checkout, admin page and health endpoint. Public
  helper/store source matches after normalizing line endings. These HTTP checks
  are not a substitute for authenticated live browser testing.
- The full checkout browser suite **did not pass**: at 320 pixels, clicking the
  submit button did not reach the payment confirmation page. This reproduced in
  an isolated single-width run. No production runtime fix was made. The cause
  remains unconfirmed; do not describe this as a verified production regression
  or claim all browser tests passed.
- A separate isolated run at 1440 and 390 pixels completed **24 checks** with
  no page errors, including checkout submission, failed-request cart retention,
  customer profile and admin promo/payment views. This is partial-width coverage,
  not a pass of the full suite that includes 320 pixels.

No production orders were created/deleted, no payment was activated, and no
production database, R2 objects, backup or rollback files were modified.

## Secrets and historical archive review

Gitleaks 8.30.1 was downloaded from its official release and checksum verified.
The scan covered all available Git refs, current source, and the old `main` ZIP
with archive traversal enabled. The 40 history findings and 23 current-tree
findings were generic-key detections in isolated test fixtures; review identified
synthetic test credentials and token-handling test code, not deployment secrets.
The old ZIP produced no detected credential findings. No actual `.env`, private
key, database dump, customer runtime data or backup archive is tracked in this
production branch or its reachable history. Automated scanning is not a proof
that no unknown secret can exist.

The unrelated `main` commit `a44880c` contains only
`Sale-Market-Catalog-Gallery-Upgrade.zip`. That ZIP contains eight historical
order records with contact fields. The owner confirmed on 28 October that all
eight are test orders and permitted their removal. The ZIP and those records
are absent from the production branch; the old main/history was preserved.

## Default branch and transfer

Do not merge the unrelated `main` ZIP history into this branch. With owner
approval, `deploy/tcloud-production-2026-10-28` became the GitHub default branch
on 28 October 2026. Git remote `HEAD` and the GitHub API both verified the change.
The old `main` and all other branches remain intact. At verification time the
repository had no workflow files, Actions runs, deployments, environments,
webhooks or GitHub Pages site, so the default-branch change and this report update
did not initiate an automatic production deployment. Repository ownership was
not changed.

Before final functional acceptance, investigate the 320-pixel checkout result
and run the isolated real-PostgreSQL concurrency test if that assurance is
required. The existing production security findings (including shared-host
PostgreSQL exposure and owner-managed 2FA) remain separate work; this source sync
does not resolve them. Preserve the verified October 27 encrypted backup and
transfer its recovery materials securely, outside Git.
