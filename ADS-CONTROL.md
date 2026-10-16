# GSMWEB account control and laptop recovery

This release adds real, bounded Google Ads mutations to the existing app. It does not enable unrestricted account optimization or publish the currently policy-blocked consumer-repair drafts. All controls start disabled and paused.

## What is implemented

- `/ai-ads/control`: product-to-ad links, dashboard monitoring, scoped stock-control permission, exact-action proposals, approve/cancel/execute, read-back verification, rollback proposals, worker health and an audit timeline.
- Automatic stock control may only pause a specifically linked live ad. Displays, batteries and charging ports are the allowed inventory types. Missing/below-minimum stock, a condition/model/type change or a price change of at least 10% triggers a pause. Ordinary stock reductions above the minimum do not.
- A restocked ad stays paused until an owner reviews the current facts and approves restoration. Update its product link to accept a new condition/model/price baseline first. Restoration reads the inventory source again before and after Google validation; it requires the exact approved stock fingerprint, the exact reviewed Google ad content, APPROVED/REVIEWED policy status without topics, a current report and unused allowance.
- Owner-approved reductions of unshared campaign average daily budgets. No automatic budget increases, bid changes, targeting changes or new publication.
- Owner-approved temporary campaign pauses, only when the independent recovery worker is healthy. A recovery deadline is recorded before the live request. Recovery starts eight minutes after execution starts and runs even when automation is globally paused. At most one temporary campaign lease is active per account.
- Action states distinguish proposals, approvals, executing, confirmed, uncertain, failed, conflicted, expired, cancelled and recovered. The database serializes account actions and fences expired locks. A provider timeout is not blindly retried. Reconciliation only reads the actual state. Changes are confirmed only after Google read-back.
- Existing advisor voice warnings include uncertain changes, stale stock-worker health and overdue campaign recovery. Voice requires the advisor dashboard to remain open with voice enabled.

The 3 lei CPC goal, fixed 1 USD = 4.74 RON assumption and allowance `min(400 lei, 10% of yesterday's confirmed customer payments)` are preserved. Ad restoration checks that reported current-day spend has not reached the allowance. Reporting delays and Google overdelivery mean this is not an exact daily billing cap or a zero-risk promise. Decreases can be approved even when receipts are unconfirmed; they cannot increase spending. Budget rollback would increase spending and is deliberately unsupported in this release.

## Database additions

The attribution database is `razskzqcijosftvyuipi`. Inventory remains read-only in `dmjunqbncyrinykbbmfk`. The additive schema is `supabase/ADS-CONTROL-PROPOSED.sql`; it is not an inventory migration and contains no destructive data operation.

| Table | Purpose |
| --- | --- |
| ga_ads_control | Disabled-by-default stock permissions, global pause, assigned recovery worker and fenced account lease |
| ga_ads_product_ads | Owner-reviewed live ad → inventory product link and stock facts used as a baseline |
| ga_ads_actions | Exact before/after intent, source, approvals, fingerprints, expiry, execution and recovery evidence |
| ga_ads_control_workers | Versioned successful/failed worker checks and timestamps |
| ga_ads_action_events | Append-only action/settings/mapping/pairing audit |
| ga_ads_worker_pairings | Hashed single-use setup codes and claimed worker capabilities, approving administrator, campaign canary and setup expiry; no provider credentials |

All six tables have RLS enabled with browser roles denied. Only the existing server service role can use them. Browser admin requests pass `requireAdmin()` and same-origin validation. The external scheduler has a separate strong bearer secret. The laptop pairing redemption endpoint uses a 256-bit, single-use, ten-minute capability and returns only a hybrid RSA-OAEP/AES-GCM envelope encrypted for the laptop's key. The authenticated administrator alone can issue a setup code. Do not run the schema twice manually; use a tracked migration and inspect existing tables first.

## Use this laptop now

1. Release the app and install the reviewed additive schema in the attribution database.
2. Open `/ai-ads/control`, load live ads/campaigns, select a campaign in **Laptop recovery agent**, and create a one-time setup code. The setup check validates write access without changing that campaign.
3. Run `scripts/Install-GsmwebRecovery.ps1` on this Windows laptop and paste that code into its local setup prompt. Dependencies must already be installed. The supplied user launcher points to the prepared local checkout.
4. The app sends the required server credentials directly to the laptop worker, encrypted for its ephemeral RSA key. The laptop saves only DPAPI-encrypted configuration for the signed-in Windows user, under `work/ads-laptop-runtime/worker.dpapi`; the directory is ignored by Git. No provider secret is returned to browser UI, command arguments, logs or chat.
5. The installer starts hidden recovery and stock workers and registers **GSMWEB Ads Recovery** to start at this Windows user's sign-in. It uses the existing Google Ads management OAuth, developer token and verified customer account. A separate server purchase is unnecessary for this temporary setup.
6. Wait for **Recovery ready** and a recent successful recovery heartbeat in the dashboard. It expires after 90 seconds without a successful check. A health check proves current read/validation access, not a live pause/resume test.
7. Start dashboard checks, link only product-specific ads to their real inventory parts, review the stock-control checkbox and enable stock control. No campaign is created or enabled by that switch. Stock checks run every minute while the control page is visible, reusing stock snapshots for at most five minutes. Without a paired background worker, closing/suspending the page stops new stock checks. After pairing, the laptop also starts a stock/report worker that continues these checks in the background. Its separate runtime bearer capability is hashed in pairing history, bound to the assigned laptop and accepted only by the stock tick endpoint. No app environment change is required for this laptop mode.

The laptop must stay awake, signed in and online. Closing its lid, Windows sleep, reboot/logoff, power or network failure, Google failures or lost database access can delay recovery beyond ten minutes. The software requests recovery early and blocks new temporary pauses when health is stale; no implementation can guarantee recovery while all required infrastructure is unavailable. Keep a manual Google Ads fallback. The installer does not silently change power settings.

The laptop holds server-level database and OAuth privileges, like the current backend. Pair only a trusted Windows user on a trusted device. DPAPI prevents plaintext credential files; it does not protect against compromise of that signed-in user. If the laptop is lost, revoke its Google authorization and rotate the transferred server credentials. Stop the worker and remove its scheduled task before decommissioning the laptop. Credentials are not embedded in this repository or launcher.

The local runtime logs contain generic health messages only. Task Manager/Task Scheduler can stop or restart **GSMWEB Ads Recovery**. A global automation pause stops new changes and leaves existing campaign recovery running. Disconnecting Google management prevents further provider operations and therefore also prevents automatic recovery.

## Move to a server later

The portable `scripts/ads-recovery-worker.ts` runs independently of Next.js. Supply its environment from a private server secret store and run it under a service supervisor. It polls every 30 seconds after completion; the dashboard displays its real successful/failed checks.

Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID`, `GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET`, `ADS_CONTROL_RECOVERY_DEPLOYMENT_ID`, `ADS_CONTROL_RECOVERY_CANARY_CAMPAIGN_ID`, and either `CONNECTION_ENCRYPTION_KEY` (to read the existing saved OAuth) or the securely provisioned `ADS_CONTROL_WORKER_REFRESH_TOKEN`. Optional manager ID: `GOOGLE_ADS_LOGIN_CUSTOMER_ID`. Never paste these values into chat or public config.

For unattended stock/report checks, configure `ADS_CONTROL_CRON_SECRET` (at least 32 random characters) and `ADS_CONTROL_MONITOR_DEPLOYMENT_ID` in the app's server environment. Run `scripts/ads-stock-worker.ts` with `APP_URL` and that bearer secret. It calls authenticated `POST /api/ai-ads/control/tick` about once a minute with no overlapping requests in that process. The independent recovery process talks directly to Google and Supabase, so app downtime does not itself prevent recovery. No scheduler or Vercel account configuration is silently claimed as installed.

## Policy and broader optimization limits

Existing Google-approved ads are treated as actual approved ads. New inventory drafts retain the existing high-risk consumer hardware-repair publication block; exact-ad approval does not grant a blanket exception. No automated wording cycling or concealment is added. See [Google's policy](https://support.google.com/adspolicy/answer/13527027?hl=en).

Full CPA/profit-based optimization still requires defensible payment attribution, enough data to propose CPA and search-visibility thresholds, owner approval of those thresholds, and separately implemented bounded bid/targeting operations. This release does not manufacture those measurements or disable their gates. It provides the real control foundation and stock safeguard capability that can be tested now.

Google mutation behavior follows [change objects](https://developers.google.com/google-ads/api/docs/concepts/changing-objects) and [mutate best practices](https://developers.google.com/google-ads/api/docs/mutating/best-practices). The UI distinguishes [average daily budgets and overdelivery](https://support.google.com/google-ads/answer/1704443?hl=en) from billing caps. Official sources were checked on 2026-10-16.

## Validation

Run the full regression tests, TypeScript and production build. `tests/ads-control-sql.mjs` executes the actual schema in local PostgreSQL and tests role access, RLS, immutable audit permissions, one-time pairing, exclusive fenced locks, approval constraints, duplicate live intent and budget increase rejection. `tests/ads-worker-pairing.test.ts` verifies envelope tamper resistance and real Windows DPAPI round trips using a non-secret sentinel. `tests/ads-control-http.mjs` tests production HTTP access denial with dummy local-only configuration after a production build.

Google mutations in tests are mocked. No real-money ad mutation, real pause/resume canary or unattended production worker test is claimed until those operations are explicitly exercised and their provider state is confirmed. A successful software build is not proof that a paired laptop is already running.

Developer-token compatibility update: Google retired developer tokens on 2026-09-09. Cloud-project OAuth access is authoritative; GOOGLE_ADS_DEVELOPER_TOKEN is optional throughout the app, laptop pairing and recovery worker. Google still enforces Cloud-project approval and account write permissions. See https://developers.google.com/google-ads/api/docs/api-policy/developer-token .
