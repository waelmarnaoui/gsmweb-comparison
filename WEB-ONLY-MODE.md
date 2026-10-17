# Temporary Web-Only Mode

The owner's request is to minimize Google Ads requests and remove the paired laptop dependency until a long-term host is chosen. `ADS_WEB_ONLY` is enabled in source. This is manual monitoring, not unattended account control.

## Effective Behavior

- Page loads, saved-status refreshes and chat context read saved Ads reports; they do not collect Google reports automatically.
- Campaign report, ad-policy and search collection require an explicit owner action. Shared account locking and pre-call receipts in existing server-only audit storage enforce at most one attempt per read type every six hours, including failures. Policy and campaign-resource views share one collection and one cache. Google pagination can still require more than one API request per collection.
- Any detected Ads quota error blocks all three collection types for 24 hours. This is a conservative application cooldown, not a claim about Google's reset time. Other applications sharing the Cloud project can still consume its quota.
- Repeated browser tabs or separate server instances share the durable gate. Storage or lock errors fail closed. Successful saved results retain their actual observation time; old reports are not labeled live.
- Automatic Ads publishing, editorial correction, stock pauses, campaign/budget actions and laptop pairing are disabled server-side. Existing authorizations remain in storage but cannot override web-only mode. Eligible ads are not modified. Account settings may still be managed directly in Google Ads.
- The old laptop tick endpoint stops without claiming jobs or making Ads calls. Ads/reporting scheduler endpoints return skipped. No new schedule or paid service is provisioned.
- The control-cycle chat tool now collects a manual report synchronously on the web server, subject to the same gate. It does not queue an Ads control job. Old queued control jobs are preserved, not replayed.
- New source-change requests run only their own job on the web server; deployment still needs review/approval and checks. Ambiguous jobs are not automatically retried. Historical queued source jobs do not drain in the background.
- Automatic Gemini report analysis is disabled. Explicit chat/voice messages still use Gemini and its independent quotas.
- Call/WhatsApp ingestion, Sheets click import, CRM comparison, consent review, manual conversion upload and upload deduplication are unchanged. Conversion sending is not rate-limited by the reporting gate.

## Laptop

The existing `GSMWEB Ads Recovery` scheduled task was disabled at the owner's request. No matching paired worker processes or pending temporary campaign recovery records were found during the stop check. Encrypted pairing files were retained; no credentials were printed or deleted. Do not install/restart the older worker while using this mode.

## Deployment

This update includes the eligible-ad/stale-feedback protections proposed in PR #52 and supersedes that standalone change. Merge and deploy this PR to activate the web behavior; local worker startup is already disabled. The branding/legal change in PR #53 is separate.

No new database schema, CRM update, Vercel plan change, or environment variable is needed. The existing app-owned control-lock functions and audit table must be installed. Server integrations and admin checks remain required. Before restoring automatic Ads actions, choose an independent recovery/scheduler design, verify quotas and account state, and obtain fresh authorization. Re-enabling old permissions is not sufficient.
