# Health and Policy-Only Review

The saved owner restriction `intervene_only_on_ineligible_ads` is a server-enforced restriction, not an authorization. When it exists, existing publication groups are read-only (including eligible paused groups), ordinary new publication is blocked, and existing-resource stock/budget/campaign execution is blocked. An unreadable preference store fails closed. Recovery of previously authorized temporary campaign pauses is not disabled.

The existing, separately authorized correction path remains limited to one factual editorial replacement of an agent-owned, reviewed, disapproved ad. It rechecks the exact parent's current feedback before submission. A replacement starts in a paused new group; policy-only mode does not enable it. Eligible, limited, pending-review, changed-copy, original-ad and business-policy cases are not rewritten. Business restrictions require owner review or Google's appeal process; never hide the real service.

## Current Status Versus History

Successful inspection writes `observedAt` inside the app-owned feedback JSON. An attempted or failed read does not renew that timestamp. Existing rows without this timestamp are historical/unknown until inspected successfully. The dashboard and agent expose freshness separately from the last attempt.

`Check Google status` uses an authenticated, same-origin, account-locked, read-only inspection of up to six publication records. It cannot publish, enable, pause or edit ads. Periodic dashboard refresh still reads saved status only. This manual check does not require the laptop or Gemini.

## Quota Handling

Google Ads HTTP 429 stops the publishing cycle after recording the safe code. A 15-minute account cooldown is stored using existing control fields, shared by subsequent worker invocations. The worker respects `Retry-After` and backs off on other repeated failures. Reporting failure does not claim queued control jobs. Uncertain actions are not replayed.

The 15-minute delay is our retry interval, NOT a claim about Google's reset time. Google may enforce daily or resource-specific quotas. If the limit persists, inspect the OAuth project's Google Ads API quotas/access; changing ad copy cannot repair an API quota limit. Gemini quotas are independent and cannot be fixed by restarting the Ads worker.

## Laptop Activation

Deploy the reviewed app update before restarting the worker: older server code does not enforce the new restriction. Use the updated checkout's existing `Install-GsmwebRecovery.ps1` with the already paired Windows user and encrypted runtime file, or pair again through Account control if moving checkouts. Never copy credentials into chat or source control.

The installer starts the hidden worker and registers sign-in plus five-minute watchdog triggers. The launcher checks the PID's start time so a reused Node PID cannot suppress restart. Keep Windows awake, online and signed in. Verify fresh recovery/monitor heartbeats in Account control; a running process alone is not a healthy worker. Quota-blocked heartbeats remain explicitly unhealthy.

`scripts/ads-health-readonly.ts` accepts the existing encrypted worker file path for a local, one-off OAuth/Ads diagnostic. It performs no database writes or Ads mutations and prints only sanitized status/error fields. It never prints credentials.

No database migration or CRM change is required.
