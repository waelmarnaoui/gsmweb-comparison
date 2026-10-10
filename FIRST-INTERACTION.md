# First client interaction

Each normalized number has one main interaction: its earliest incoming or
missed call since 24 September 2026, Romanian midnight. Later answered/missed
calls and outgoing callbacks remain stored, but are not separate leads.
Outgoing-only numbers remain visible as unmatched history and are not eligible
for website attribution or payment conversion. Call lists select the first
interaction before applying a narrower date filter. Timestamp ties use call ID
ordering consistently in JavaScript and PostgreSQL.

Only main incoming/missed interactions participate in CRM payment comparison
and conversion exports. Actual active payments and the existing 14-day visit
rule still apply. This means returning visits beyond that window are excluded
under the owner's requested first-only rule, rather than resetting the lead.

Existing matches, drafts and raw call records are never deleted or reassigned.
An existing draft attributed to a later call stays stored and reserves its
payment; it is withheld from new exports until reviewed. No Google correction
or new upload is performed automatically by this change.

Apply FIRST-INTERACTION-PROPOSED.sql only to the attribution project after
explicit approval. It includes the missed-call fix, preserves admin checks,
RLS/security_invoker, unique call/click constraints, the configurable directional
time window and existing audit triggers. No CRM tables are modified. Deploy
the web update with it to keep database and displayed behavior aligned.
