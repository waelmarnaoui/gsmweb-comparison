# Profit-valued conversions

Google Ads Conversion Value is recorded gross profit, not customer price or payment revenue. The dashboard and CSV keep customer charge, actual recorded payment, allocated cost and profit separate.

- Repair cost: Repair.repairCost. Customer charge: Repair.customerPrice.
- Sale cost: AccessorySale.productCost multiplied by quantity. Customer charge: salePrice multiplied by quantity.
- Only active PaymentTransaction rows linked through the correct settlement are counted.
- Each settlement's total cost is allocated pro rata across its active payments using exact cents and deterministic largest-remainder rounding. Cash/card splits never deduct the cost twice.
- Gross profit is actual payment minus allocated cost. General overhead, tax and expenses are not allocated to individual conversions.
- Missing costs and zero/negative profit block export; quoted prices do not fabricate paid revenue.

## Conversion time

Website-paired rows use the exact saved call-button click timestamp, as requested. This denotes the website interaction later qualified by payment, not when the payment occurred. An actual active payment and the existing 14-day visit eligibility rule are still mandatory.

Phone-only rows use the first time the app verifies an eligible paid customer. Install supabase/CONVERSION-FIRST-MATCH-PROPOSED.sql in the attribution project only. The new app-owned table has RLS, admin-only reads, server-only insert permission, immutable timestamps, unique project/payment IDs and an insert audit trigger. Repeated requests cannot replace an observation. A changed call assignment or recorded payment date blocks the row rather than rewriting its history.

The old 23:59:59 fallback is removed. Missing timestamp storage disables phone-only exports, not verified website-paired rows. GET/export requests never create observations; authenticated same-origin admin preparation POSTs do so. This is not an unattended scheduler.

Existing conversion drafts retain actual recorded payment amounts for validation. Conversion Value is derived separately from the current recorded cost. Preparation updates only the time of still-prepared matching drafts, through the existing audited table; exported and void drafts are never updated. A changed payment amount or match requires review.

CSV times use yyyy-MM-dd HH:mm:ss with Europe/Bucharest configured in Data Manager. Map Conversion Value to the profit column, not Recorded Payment or Customer Charge. Extra bookkeeping columns may remain unmapped. No Google Ads uploads are performed by this change. Previously uploaded values require a separate reviewed adjustment process.

