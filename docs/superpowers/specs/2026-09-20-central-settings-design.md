# Central settings and personal companion context

Approved by the owner on 2026-09-20 after three interactive visual iterations.
Driver: `mezo-txunr`. Visual reference: [approved prototype](assets/2026-09-20-central-settings/prototype.html).
Prototype values are illustrative; production must use stored data and existing engines.

## Goal

Replace the header daypart switch with one settings entry point. Consolidate persistent
preferences across Fuel, Train, Mezo, Én and Nap. The common landing page highlights the
originating domain and retains access to every domain and general settings.

## Navigation and ownership

Canonical root `/settings`, domain roots `/settings/fuel`, `/settings/train`,
`/settings/mezo`, `/settings/me`, `/settings/nap`. Preserve the originating pathname in route
state so close/back returns there; nested pages return to their parent. Existing settings
URLs redirect to their equivalent canonical routes. Remove the Fuel cog, the Én settings tile,
Train schedule chips and the Tudástár communication-profile entry. Keep ordinary logging,
exercise/mesocycle editing, routines, prescriptions and knowledge exploration in their domain.
Setup/repair CTAs may link to the canonical editor; never duplicate its implementation.
Settings are global and do not arbitrarily select another domain in the bottom navigation.

## Visual contract

Use the existing light-first Mozaik/Clay tokens, Geist/Fraunces typography, clay symbols and
Boop domain figures. Sage Fuel, coral Train, lavender Mezo, rose Én, gold Nap. Asymmetric
wash surfaces, compact unboxed rows and domain-colored illustration; no generic uniform
settings boxes. Mobile 320px through desktop phone frame, existing dark theme, keyboard access.
The approved HTML captures the visual target, not an alternate production data model.

## Existing domain settings

Fuel retains real goal-engine calorie/macro preview, all five presets, custom-sum validation,
protein tier, day-type shift, cadence/caffeine and all three slot templates. Water and fiber
are compact rows, not large tiles. Reuse existing hooks and write flows; real mode never
calculates replacement nutrition targets in the browser.
Train consolidates the recurring seven-day gym schedule and multi-slot sport schedule.
Én exposes the existing biometric and sleep editors plus weight-goal management. Goal weight
and remaining pace determine an estimated target date; no independent date input. Preserve
stored goal history and guards when mapping edits to the existing upsert/feasibility API.
Show the existing server feasibility result before saving, with explicit current-weight and
calculation baseline. Maintenance has no invented weight-arrival date.
Nap links to the shared sleep anchors, cadence and notification settings rather than storing
parallel values. General settings preserve theme, notification preferences, account, password,
logout, tutorial reset and owner-only admin destinations. Account correction updates the real
account source; never introduce a second name in companion preferences.

## Personal companion context

Mezo has three surfaces: Rólam, Így beszélj velem, Ezt kapja meg Mezo.
Rólam shows source-linked canonical personal facts and a user-written introduction/priorities.
Communication contains explicit custom instructions and independent learned-profile inclusion.
The user's text is never rewritten by background learning. Explicit communication instructions
win over learned tone; personal facts and biography remain contextual data, not privileged
system commands. General application rules retain priority.

Persist owner-scoped preferences: `aboutMe` string (0..4000), `customInstructions` string
(0..4000), `useLearnedProfile` boolean (default true). Empty strings deliberately clear values.
GET/PUT `/api/companion/preferences` return `CompanionPreferencesResponse` with those fields.
PUT body `CompanionPreferencesRequest` requires all three fields.
GET `/api/companion/personal-context` returns `CompanionPersonalContextResponse`:
`renderedText` string and `sections` array of `CompanionPersonalContextSection` with required
`id`, `title`, `text`, `source`, `included`; optional `editPath` for canonical source correction.
Stable section IDs: `core`, `about`, `instructions`, `learned`. Preview and chat use the SAME
assembler; show the actual bounded text, absent/excluded status and sources. Describe scope
honestly: the personal blocks are not the complete system prompt or per-turn retrieved memory.
Apply the shared personal blocks to sync, streaming, conversation-first and rollback chat
paths, without duplicating the existing baseline/learned block. Pref changes apply next turn.

Account source: PUT `/api/auth/me` accepts `UpdateAccountRequest` (`name`, `email`), returns
existing `MeResponse`. Preserve identity, roles/status and token ownership; normalize/check
email with existing registration rules, reject duplicates. Update UI caches and prompt sources.

## Reliability and verification

Loading, missing profiles, no goal, failures and saves are explicit. Preserve local edits
against late reads, surface failed writes, and guard navigation from unsaved full-page forms.
Mock mode simulates persistent edits honestly; no seed fallback in real mode.
Contract-first backend integration tests cover anonymous access, two-user isolation, text
limits/clearing, persistence, preview/chat equivalence, learned exclusion and both chat paths.
Frontend tests cover route migration, origin highlighting, edits/dirty state, API wiring,
preview source corrections, goal date derivation and existing Fuel preview behavior in both
modes. Run full FE gates/build, focused backend gates (broaden for shared prompt changes),
layout checks at 320/393px, docs lint and generator drift checks.
