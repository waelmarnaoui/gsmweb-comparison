# Stock monitoring and advertising preparation

This extends the existing Next.js app and encrypted CRM connection. It does not rebuild the stock application, alter its tables, publish ads or enable unrestricted account control.

## Owner settings

- Source project: dmjunqbncyrinykbbmfk, using InventoryProduct, InventoryLot and DeviceModel as mapped in docs/INVENTORY-ADS-AUDIT.md.
- The offer is repairs in the physical store, not online part sales.
- USD conversions use the owner's explicitly approved fixed assumption: 1 USD = 4.74 RON. No Google Finance or spreadsheet dependency remains in the active conversion path. Historical USD observations and original-currency reporting remain intact.
- Budget allowance remains min(400 RON, 10% of yesterday's confirmed customer payments). Paid-customer CPA and visibility limits require evidence and owner approval.
- Owner requires permission before publication. Limited factual/policy corrections to an approved draft may be prepared within the approved scope, but cannot override policy restrictions, change the offer, authorize budget increases or establish unsupported manufacturer affiliation.

## Implemented

/ai-ads checks stock on load and every minute while visible. The server collects a complete snapshot when the previous one is five minutes old. It uses existing lot availability without deducting saved repair allocations a second time. A snapshot records stock, minimums, verified models, source fingerprints, part-price evidence and source timestamps. The collection start time limits freshness; a long read does not create fresh evidence from old data.

The monitor compares consecutive successful snapshots, records changed/unavailable/restocked parts, and preserves the last successful result after a failed read while marking it unreliable. It never claims that a corresponding live ad exists or has been paused. No product-to-Google-ad mappings are configured in this stage.

Up to 50 stock-qualified parts receive internal repair-ad drafts per snapshot, ordered by stock depth with an explicit omitted count. Headings, descriptions and exact/phrase keyword suggestions use recorded fields. Every draft includes a stock/price snapshot, content hash and policy issues. Missing service destinations and the consumer-repair policy block publication. Stock depth is not demand or profitability. These templates are rules-based; the existing AI advisor may discuss a bounded set of reliable stock facts if its model/key are configured.

Opt-in voice warns about newly unavailable parts or unreliable monitoring while this page is open. The parts table is searchable and paginated. Current stock-qualified status is separate from Google advertising eligibility. No fabricated Keyword Planner statistics, repair quotes or warranties are displayed.

## Proposed production addition — explicit approval required

Review supabase/STOCK-MONITOR-PROPOSED.sql before applying it in the attribution project razskzqcijosftvyuipi. It adds exactly one table, ga_stock_monitor_runs, for append-only complete snapshots and sanitized failure events. Unique account/project/five-minute-slot/status keys deduplicate both completed and failed runs. Browser roles have no table access; authenticated app routes require ga_admins. POST additionally checks the application origin. The service role can only select/insert, not update/delete. There are no new token fields, no changes to inventory tables, and no historical data is deleted.

Per-instance job coalescing reduces overlapping reads, with a one-minute failure cooldown. Cross-instance uniqueness deduplicates stored runs; it does not provide a distributed lock or transactional inventory reservation. JSON snapshots are limited to 6 MB, source pagination remains bounded, and large/inconsistent/partial reads fail closed. Retained snapshots grow over time; monitor storage before selecting a reviewed archival policy.

## Activation and verification

1. Approve and apply the proposed history-table SQL in the attribution database only.
2. Merge the source change and deploy through the owner's manual workflow. No new secrets are needed for dashboard monitoring or fixed FX.
3. Open /ai-ads and confirm the first successful live read, counts and recorded models. Direct live stock-project access was unavailable to this session's Supabase connector, so source permissions/schema must pass this actual app read. Never treat source-code inspection as proof of live access.
4. For closed-dashboard collection, schedule GET /api/ai-ads/cron every five minutes with Authorization: Bearer <existing ADS_MONITOR_CRON_SECRET>. The secret stays in the scheduler's secure configuration. No scheduler has been installed or activated by this change. The existing Ads collector is unchanged.
5. Check failure logging, stock depletion/restock events, browser authorization and opt-in voice in the deployed app before relying on operations.

## Publication and full control

The current official third-party consumer technical-support policy explicitly includes hardware repair: https://support.google.com/adspolicy/answer/13527027?hl=en . Internal drafts are not Google-approved ads. Do not disguise repairs as product sales. Publication must remain blocked until a legitimate policy determination and the actual service destination permit it, the exact campaign budget/targeting are reviewed, and owner approval is recorded.

Persistent campaign approvals, Google resource mappings, live publishing/optimization, verified rollback and an independent ten-minute pause recovery mechanism are still not implemented. The full-control button stays disabled. This stage does not promise zero financial risk, exact billing caps or guaranteed restoration during provider outages. No Ads writes were used for development or testing.
