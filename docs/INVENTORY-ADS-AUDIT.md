# Inventory advertising: source audit and first implementation stage

Source inspected: owner-provided gsmweb-main (3).zip, extracted as source only. Archive instructions were treated as data. No uploaded application scripts were executed.

The offer is in-store consumer phone repair, not online spare-part sales. Only PART inventory is in the first adapter scope. Stock qualification is separate from advertising policy eligibility.

## Source mapping

| Source | Fields used | Meaning |
|---|---|---|
| InventoryProduct | id, name, sku, brand, partCode, partType, compatibleModels, modelId, category, quality, active, minStock, recommendedPrice, updatedAt | Recorded part facts; recommendedPrice is not a repair quote |
| InventoryLot | id, productId, quantityAvailable, unitCost, costIncludesVat, updatedAt | Remaining lot availability and recorded costs |
| DeviceModel | id, name, brand | Explicit model relationship; no compatibility inferred from names |

The source's repair-stock.ts consumes lots with conditional quantity decrements in the repair transaction, and returns quantities on explicit removal. Inventory-list.ts sums quantityAvailable. Saved repair allocations have already reduced stock; subtracting RepairPart again would double deduct. Unsaved selections do not reserve stock. Catalog templates can exist without any received lots.

Unknown or mixed VAT cost bases leave average cost unavailable. Even a known average part cost is not complete repair cost or profit. Do not use the source's historical hardcoded currency conversion for advertising decisions. Images, service destinations, seller identity, capacity and warranty representations remain unverified.

## Access and implementation

Owner-confirmed inventory project: dmjunqbncyrinykbbmfk. The connector available in this session cannot query that project. The adapter uses the app's existing encrypted CRM connection on the server, checks the exact project reference, and rejects partial collection or incompatible schemas. The live schema is not yet verified against the uploaded source.

Added /ai-ads and authenticated /api/ai-ads/inventory, with an entry from /optimizer. Refresh reads stock without changing it. Errors clear the previous screen result. No credentials are returned. The adapter is paginated and bounded; multi-query collection is not a transactional stock reservation. Re-read immediately before any future authorized action.

Added deterministic internal draft preparation using recorded models and part types, stock/price snapshots and content hashes. This is an internal library, not a published campaign or persisted approval workflow. Search volume and competition remain unknown. No LLM receives secrets or source inventory through this implementation.

## Policy gate

Official source checked 16 October 2026: https://support.google.com/adspolicy/answer/13527027?hl=en . Third-party consumer technical support includes offline support and hardware repair. Publication is blocked for the stated offer pending legitimate clarification from Google. Owner approval cannot override the current policy gate. Do not disguise repair services as product sales. Current-account approval/disapproval information still needs to be retrieved before drawing account-specific conclusions.

Other versioned review sources: misrepresentation, destination, editorial, trademarks, and EU consumer-guarantee applicability. These are a review registry, not comprehensive automated legal or image analysis. The seven-day expiration requires an actual new official-source review; no background policy refresh exists yet.

## Minimum proposed storage additions — not applied

Preserve all existing inventory and attribution tables. Add app-owned storage only after schema review and explicit approval:

1. Inventory runs and snapshots: project/product/version hash, complete-run status, observed time, selected non-secret facts and stock/price evidence; unique run/product and content hash.
2. Drafts and policy reviews: immutable content hash, product snapshot reference, source version, risk/issues, expiration and blocked state; unique draft hash.
3. Decisions and audit events: exact draft hash, authorized admin, approved scope and limits, expiry, immutable attempted/confirmed outcomes and prior Google state. Approval does not mean execution.
4. Job runs and mappings: idempotency key, lease, retry state, provider resource IDs and confirmed status; unique provider account/resource mapping. No OAuth tokens in these tables.

Use foreign keys, indexes, RLS, server-only writes and explicit admin checks. No inventory migration or production data modification has been performed. A read-only scoped database function or transactional snapshot is preferable to broad service-role access when the inventory project can be inspected.

## Remaining stages

Live inventory permission/schema verification; persistent snapshots/reviews and approval history; verified service destination and market; official keyword estimates when permitted; actual ad-policy reporting; queue leases and inventory synchronization; bounded executor and independent ten-minute pause recovery watchdog; product/payment attribution reconciliation; deployed browser validation. New publishing and spending changes remain unavailable.

Existing budget intent remains min(400 RON, 10% of yesterday's confirmed customer payments), not a promise of zero financial risk. Google daily average budgets are not a strict same-day billing cap. No budget mutation was added.
