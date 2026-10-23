# Website-linked conversion review

## Database setup (approval required)

Run `supabase/MANUAL-CLICK-LINK-PROPOSED.sql` once in the attribution project
`razskzqcijosftvyuipi`, after approving the change. Do not run it in the CRM project.
It adds an app-owned evidence table, an admin-only linking function and an
RLS-protected verification view. It does not rewrite existing matches, calls,
conversions, uploads or CRM records. The app remains usable without this setup;
manual linking returns a setup-required message until it is installed.

## Daily review

Conversion Review loads the current Bucharest day from the authenticated server.
Date ranges remain selectable. Only verified website-linked conversions are
included in the Google upload manifest and CSV export. Phone-only conversions
remain visible but cannot be uploaded.

For an unlinked, unsubmitted customer, expand **Link website click**, select the
click search dates and choose **Find clicks**. Select the original interaction or
a later call/WhatsApp interaction for the same number, then the preceding click.
Record the independent evidence and confirm the association before saving.

The association is customer-level: it links the first-interaction record and its
eligible CRM repairs/sales, retaining the selected follow-up as evidence. A new
conversion is not created for each callback. Repair profit, consent, attribution
dates and upload-history checks still apply. Conversion time remains the original
website-click time; GCLID and captured braid identifiers are not fabricated.

Existing matches cannot be overwritten. A click/GCLID source cannot be assigned
to a second customer. Customers with any reserved or submitted upload are blocked
from relinking. The linking transaction is audited and does not send to Google.
The normal reviewed Send action remains a separate step.

## Verification

- Full unit/integration suite, including isolated PostgreSQL-compatible tests.
- Production Next.js build.
- Isolated desktop/mobile browser checks for today defaults, cross-day follow-up
  selection, evidence confirmation, refresh and absence of automatic uploads.
- Production database and Google Ads submissions are deliberately not used by tests.
