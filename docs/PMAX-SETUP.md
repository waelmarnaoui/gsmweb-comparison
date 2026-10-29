# Performance Max workspace

Route: `/ai-ads/performance-max`, linked from AI Marketing.

## Setup

The owner approved separate app-owned Performance Max storage. Run
`supabase/PMAX-WORKSPACE-PROPOSED.sql` only in attribution project
`razskzqcijosftvyuipi`. The separate CRM is untouched. Storage is server-only,
RLS-enabled, audited and uses versioned immutable publication intents.

Use the existing Google Ads management OAuth connection and existing protected
Ollama gateway. No Gemini fallback is used. The Google account must be USD.
Load Google location boundaries and image assets explicitly. No account polling
or campaign changes happen on page load. If Drumul Tabarei isn't returned as a
supported boundary, there is no automatic country/city/radius fallback. Choosing
Sector 6 explicitly covers the whole sector, not just Drumul Taberei.

## Generate and publish

Select valid landscape, square and square-logo assets from the Google account.
Existing images are reused, not generated or falsely represented as shop photos.
Select repairs and describe the supported brands/models. Seven categories are
available: displays, front glass, back glass, batteries, charging ports, cameras
and other faults. Model compatibility and stock are not assumed.

Generation runs as a durable saved job using the existing Ollama gateway's
30-minute allowance. Check generation manually. The job is never automatically
resubmitted. Invalid model output becomes failed; it is not silently replaced by
template copy. Edit generated text, save it, then approve the exact saved draft.

Publishing creates a NEW ENABLED Performance Max campaign, nonshared USD budget,
CRM-only custom conversion goal, Presence location targeting, Romanian language,
campaign-level brand assets and enabled repair asset groups in one atomic mutate.
Final URL expansion is disabled. Search themes are broad signals, not keywords.
Google can automatically create videos; custom video upload is not included in
this version. Google policy review still determines whether ads may serve.

The budget is an average daily budget, not a strict daily cap. US$52 is a proposed
starting budget, not a live exchange-rate conversion or an increase to existing
campaigns. The publish checkbox explicitly approves the selected USD amount.

Google validates assets, conversion action and the complete mutation before any
campaign is created. A versioned claim and shared account lease prevent duplicate
publication. Submitted, submitting and uncertain records cannot be resent. A lost
receipt or uncertain network result requires inspection in Google Ads, not retry.
The app's global account-pause switch still blocks enabled publication.

## Enabled defaults elsewhere

New reviewed bulk Search groups are enabled. The bulk copy version changed so
previous paused previews require saving/reviewing again. Parent campaign status
is never changed. New automatic publication plans and editorial replacement
plans record an enabled initial status and run activation guards before creation.
Historical plans without this field retain their original paused semantics.
Monitoring can still pause for policy, stock, allowance or schedule safeguards.
New keyword publication defaults to enabled; explicit Pause/Remove actions remain
unchanged. Editing an existing record does not automatically unpause unrelated ads.

No Google campaign was created during local tests. Live publishing requires the
approved storage migration, real OAuth access, valid image assets, Google location
availability, working Ollama and final owner approval in the app.
