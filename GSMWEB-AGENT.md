# GSMWEB conversational Ads agent

## Confirmed product behavior

Start in monitor-and-advise mode. The owner can chat with the advisor and inspect concise evidence, recommendations, expected impact, uncertainty and risks before granting account control. These explanations are decision summaries, not private internal model reasoning. The advisor must never imply it has changed an account when it has only suggested a change.

Targets: 3 RON CPC; 4,000 RON daily total customer payments. Total payments include cash, card and transfer. They are not contribution profit, and not necessarily caused by Google Ads.

The daily ad allowance is `min(400 RON, 10% × yesterday's confirmed customer payments)`, rounded down to bani. A 4,000 lei day permits up to 400 lei the following day; a 2,000 lei day permits 200 lei. Larger receipts never lift the 400 lei cap. Missing prior-day confirmation blocks activation; zero prior-day payments permit zero spend. Today's receipts do not increase today's allowance. Never authorize ad spend using forecast receipts. Existing campaigns are not paused or rebudgeted by the current advisory implementation.

At 19:00 Europe/Bucharest, ask “How was today?” and request the day's customer payments. While the dashboard is open, show the prompt and speak it when voice warnings are enabled. If the app opens after 19:00, show an unanswered check-in then. Boundary convention avoids overlapping ranges:

| Customer payments | Daily rating |
|---|---|
| 0 to below 500 lei | Very bad |
| 500 to below 1,000 lei | Bad |
| 1,000 to below 2,000 lei | Good |
| 2,000 lei and above | Very good |

Track progress toward 4,000 separately: a “very good” day at 2,000 has not reached the goal. Owner-confirmed totals are recorded with actor and time and can be corrected by a new immutable record. They are explicitly distinct from automatic CRM reconciliation, which is still required for profit/CPA attribution.

## Implemented in this draft

- Separate Google Ads reporting OAuth and read-only Search campaign reporting.
- Today's account-wide reported spend/clicks, alongside seven completed days of Search cost and visibility metrics. Current-day spend covers all account campaign types through a customer-level query.
- Five-minute idempotent snapshot slots. Configure an external five-minute scheduler using the existing secured cron endpoint; no schedule was activated by source changes.
- Administrator chat backed by the OpenAI Responses API, structured advisory replies and stored per-admin history. Context is assembled server-side from source observations and payment confirmations. It excludes customer identity, OAuth credentials and campaign names. The model has no Ads action tools. Set server-only OPENAI_API_KEY and OPENAI_ADVISOR_MODEL; no fake replies appear when they are absent.
- Advisory analysis on demand, plus an opt-in to analyze new saved reports while the dashboard is open. Pending claims, request IDs and an hourly per-admin ceiling limit repeated AI calls. Automatic analyses use the same limit as user chat and are disclosed as requests; this is not a full background reasoning worker yet.
- Owner-confirmed daily payment totals, date-aware 19:00 prompts and prior-day spending allowance calculation.
- Text and optional computer-generated browser voice alerts for stale data, currency mismatch, reported daily-spend-limit crossings and sudden arrivals of reported spend. Voice stays within the open dashboard; no phone or external messaging is used. Audio must be enabled by a user gesture and is subject to browser/background restrictions.
- “Give account control” opens a readiness review. Activation remains disabled because live execution, independent recovery and reconciled CPA/visibility safeguards are not yet verified. The button never silently activates a nonfunctional executor. Neither model output nor chat text grants permissions.

## Ten-minute maximum pause contract

This means the maximum duration of a temporary agent-induced pause for fixes, not a ten-minute window for judging CPA. Conversion and reporting delays make that performance judgment unreliable.

Before enabling control, implement and verify a separately scheduled recovery worker, independent of the AI and browser:

1. Write a durable pause lease BEFORE sending any pause: account, exact campaign, prior status, approved fix, original snapshot, owner grant, start time, immutable deadline no later than start + 600 seconds, and recovery payload. Do not pause an already manually paused campaign; never extend a deadline by another pause request.
2. Run an independent watchdog at least every minute with authenticated scheduling, account/resource locks and fencing tokens. Begin rollback/recovery early enough to attempt completion by the deadline. Alert if the watchdog's heartbeat is missing. No new pause is allowed when recovery health is uncertain.
3. If a fix does not verify, restore the last known safe configuration and prior enabled state before deadline, provided resource fingerprints still match agent ownership and the result stays within the granted budget. Normal bid/target edits should not require pausing at all.
4. Revoke future action permissions and issue a critical spoken/text alert if recovery fails. Do not blindly resume with broken settings, overwrite a human's intervening edit or exceed the spending mandate. These conflicts need a human recovery decision, explicitly recording why the maximum-pause objective could not be met.
5. Keep recovery operating when normal autonomy is switched off so an existing agent-induced pause is not abandoned. Revocation cancels future optimizations; safe recovery is a separately defined responsibility.

Google outages, suspended accounts and conflicting manual edits can prevent restoration. The UI must distinguish the ten-minute operating limit from an impossible universal uptime guarantee. This draft includes tested deadline calculation, but no deployed pause/watchdog executor.

## Account-control activation gates

The owner wants a future full-control button. Activation must be an explicit authenticated action against a visible permission summary, not a chat phrase. Show account, allowed resources/actions, prior-day spending allowance, search visibility floors, CPA warning threshold, max change size, learning cooldown, pause limit and expiry/revocation controls. Bind the grant to an immutable policy version and account.

Before activation: verified Google account/currency, complete and timely reporting, confirmed yesterday receipts, reconciled customer CPA/profit, agreed CPA and visibility thresholds, tested bounded executor, successful rollback and pause-recovery drills, healthy independent watchdog, audit retention and configured kill switch. Current API exposes advice mode only and has no enable endpoint. A full-control grant should permit only policy-bounded decisions; it must not bypass financial limits. Expanding allowed actions needs renewed approval.

Budget controls must account for already reported spend, other campaigns, manual edits and outstanding changes. Google daily budgets are average settings, not hard intraday billing caps. Account-wide reporting is delayed. Prefer conservative headroom and preapproved account-level spending controls where supported, verify them explicitly, and never describe the system as “no risk.” A non-RON account needs an agreed conversion policy before applying RON limits. If account calendar differs from the Bucharest business day, reconcile day boundaries before calculating spending controls.

High-CPA alerts require an actual paying-customer denominator, mature cohorts and an agreed maximum CPA. Until those are configured, display “unavailable” and never substitute CPC or Google's raw conversions for actual-customer CPA. Warnings do not authorize pauses in advice mode.

## Deployment and current limitations

Apply neither proposed migration to production without review. After ADS-OBSERVATION-PROPOSED.sql, review ADS-AGENT-PROPOSED.sql in staging. It assumes ga_admins is the trusted owner/admin roster. Restrict who can edit that roster. Browser roles have no direct access to chat/check-in tables. Server service-role credentials remain privileged and must stay secret. The current app is single-account; multi-account grants require account-specific membership controls.

Configure API access, OAuth and model credentials on the actual deployment. Verify provider access with a real read and a single authorized model request; the local tests use fixtures only. Add external scheduler/health monitoring, rate limiting at the ingress, log retention, backups and alert tests. New report collection doesn't make Google data instantaneous. Surface source timestamps, detect stale data, and never make emergency decisions from missing source data.

Remaining: live credential/deployment verification, automatic CRM daily payment reconciliation, high-CPA/visibility alert thresholds, continuous background advisory jobs, production audit exports, actual bounded mutation executor, account-control grants/revocation and independent pause recovery. This change is a functional advisory application when configured, not a completed autonomous production Ads manager.

Official implementation references: [Responses text generation](https://developers.openai.com/api/docs/guides/text), [structured advisory output](https://developers.openai.com/api/docs/guides/structured-outputs). Spoken warnings currently use browser speech synthesis rather than a paid speech API.
