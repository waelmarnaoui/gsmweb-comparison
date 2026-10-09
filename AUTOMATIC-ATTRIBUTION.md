# Visible calls and automatic attribution

Calls before 9 October 2026 00:00 Europe/Bucharest are hidden from live call history, dashboard statistics, collector count and conversion exports. The inclusive UTC boundary is 2026-10-08T21:00:00Z. Existing stored call records are retained. The phone's recording/upload behavior is unchanged.

Review and approve supabase/AUTO-MATCH-PROPOSED.sql before installing it in the original attribution project. It adds confirmation_method to the app-owned ga_matches table and creates an administrator-only matching RPC. It does not change CRM tables. Until installed, the app shows automatic matching as pending, never falsely reports a candidate as automatically confirmed.

## Matching rule

The existing ga_candidates view supplies eligible incoming calls/clicks using the saved delay window. Automatic confirmation requires both:

- Exactly one eligible unmatched click for the call.
- Exactly one eligible visible unmatched call for that click.

Many-to-one and one-to-many cases remain ambiguous; the system does not choose arbitrarily. Manual review remains available for these unresolved cases. Existing confirmed matches are excluded. Database uniqueness constraints on call_id and click_id remain in force. A serialized transaction protects competing attribution operations. Automatic inserts are audited by the existing match trigger and tagged confirmation_method='automatic'. Prior/manual matches retain 'manual'.

## Execution

An import runs matching after storing clicks. The live dashboard runs a protected POST matching request on opening/refreshing and every 30 seconds while the tab is visible. Merely issuing the dashboard GET does not mutate attribution. There is no unattended scheduler in this update; matching newly uploaded calls while no dashboard is open requires a separately configured server scheduler/ingest hook. No Google Ads upload is triggered.

The batch limit is 500 unique pairs per execution. Additional pairs are processed by subsequent refreshes. Changing the window affects future candidates, not existing confirmed attributions. Hiding historical calls does not free their already-attributed clicks for reuse.

## Database verification after approval

The migrations and matching rules were executed in an isolated local PostgreSQL engine using PGlite: unique pairs, midnight inclusion, ambiguous/shared/old/future/outgoing/used-click exclusions, repeat-run idempotency, audit creation, administrator permissions, connection RLS and audited disconnect all passed. Run `pnpm test:sql` to reproduce. Unit tests also cover RPC parameters and pending/failure behavior. Provider consent, token refresh and actual Supabase integration still need staging verification after approved registration/migration; local tests do not establish live provider connectivity. Do not use production CRM rows for tests.
