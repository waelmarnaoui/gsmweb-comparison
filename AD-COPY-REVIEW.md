# Bounded ad-copy preparation and actual Google review feedback

## Implemented in this stage

Each stock-qualified repair draft now contains up to three factual headline/description alternatives: recorded model, store visit, and recorded part type. Text limits, verified compatibility, stable variant identities, source fingerprints and explicit NOT_SUBMITTED status are preserved. Historical stock snapshots remain readable without the new optional variants field; the next successful stock collection prepares new variants. There are no invented conversion, eligibility or performance results.

The /ai-ads screen reads the existing account's actual responsive-search-ad policy status through /api/ai-ads/policy. On opening the screen it performs a read-only collection, reusing a successfully saved review for up to five minutes. The owner can refresh manually. The API reads approval status, review status, policy topics, paused/enabled status and the actual copy. It uses only GoogleAdsService.Search; no create, update, remove, exemption, appeal or mutation is called. Pagination is bounded, resource ownership and duplicate identities are checked, and malformed/partial responses fail closed. Empty results do not imply that other ad formats are absent.

Successful results are retained in the existing ga_audit table under entity google_ads_policy and action observed. Its RLS was verified enabled with authenticated admin-read policy; the API itself requires ga_admins and validates the request origin for collection. No new migration, scope or secret is introduced. A stored or current ad approval applies to that exact reviewed ad, not a new draft or the business generally. A paused ad's policy review can take longer; paused parent campaigns can delay review. No campaign is enabled just to accelerate a review.

The next-step planner distinguishes owner authorization, stock freshness, internal policy risk, pending Google review, an approved particular ad, known editorial feedback and restricted/unknown issues. Three variants is the maximum preparation/correction attempt budget. Restricted-service, misrepresentation, counterfeit and circumvention feedback stops the plan; unknown or limited feedback requires review. Recognized editorial feedback may produce a correction proposal within the approved scope. This is planning logic only: there is no live retry worker or variant-submission executor in this stage.

## Actual stock failure found

At inspection the live stock-history table contained 13 failed reads and no successful snapshot. Recorded failures only said inventory_read_failed. The new code records a sanitized diagnostic in the existing ga_audit table for each newly logged failed slot: connection, missing table, missing column, denied access, timeout or unknown. Only known table names and static corrective messages are retained. Provider messages, credentials, response bodies and tokens are excluded. The stock screen shows the diagnostic without presenting stale stock as current. No stock schema or data is changed.

The CRM project is still inaccessible through this session's connected Supabase MCP accounts. Actual root cause must be confirmed by the first deployed diagnostic; this code must not claim that the live stock connection is repaired already.

## Remaining account-control blockers

Live campaign execution, persistent action approvals, Google-resource mappings, rollback and independent ten-minute pause recovery remain unimplemented. Their deployment checks cannot be passed by changing a readiness flag.

There is one distinct seven-day report window, zero saved verified CRM customer links and one conversion draft in the attribution database. A conversion draft is not proof of a paying customer. Paid-customer CPA and profit thresholds cannot be inferred from those counts. The owner-approved 3 RON CPC goal, fixed 4.74 RON/USD and prior-day receipts spending rule remain intact. Visibility thresholds need longitudinal evidence and an owner-approved proposal; do not silently choose them to enable control.

The stated third-party consumer hardware repair offer remains blocked by the internal official-policy review. Legitimate Google clarification/review and a verified destination are required before submission. Do not rewrite the offer to conceal that it is repair. Existing approved ads do not establish a blanket exception for new ads. Owner permission does not override policy. No live ad changes have been made.

## Deploy and verify

Merge and deploy the source using the owner's manual workflow. No Chrome or Vercel account access is required for this source preparation. Open /ai-ads: inspect the stock diagnostic and actual Google review results. Fix the verified inventory connection/schema issue before relying on stock variants. No live provider status or successful stock collection was confirmed from this local coding session.

Official references:

- https://support.google.com/adspolicy/answer/13527027?hl=en
- https://developers.google.com/google-ads/api/reference/rpc/v26/AdGroupAdPolicySummary
- https://support.google.com/google-ads/answer/1722129?hl=en-GB
- https://developers.google.com/google-ads/api/docs/mutating/bulk-mutate (validate_only checks are not a guarantee of final Google ad approval).
