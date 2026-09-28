---
title: Central settings and personal context
type: feature-platform
status: done
updated: 2026-09-28
tags: [frontend, platform, ai]
key_files:
  - frontend/src/features/settings
  - frontend/src/data/companion/preferencesApi.ts
  - frontend/src/data/companion/preferencesHooks.ts
  - frontend/src/app/AppHeader.tsx
related: [_platform-design-system, companion, me, fuel, train, insights, _platform-auth-security]
---

# Central settings

> **2026-09-23 — Üveg U3 (`mezo-me75u.3`).** The header notification panel's chip and row icons are the 3D set (call-site: forecast → t-orb, experiment → t-flask, habit formation → t-harvest, and since `mezo-a9bo7.13` the esti kiadás' Mezo glyph → t-chat); the deprecated notification `emoji` field is gone. Behavior unchanged. Look: [`uveg-style-bible`](../design_2.0/2026-09-23-uveg-style-bible.md), parity reference [`uveg-nap.html`](../design_2.0/prototypes/uveg-nap.html).

> **2026-09-23 (`mezo-me75u.1`):** the app is locked to dark (üveg style bible §8). The
> Téma picker on `/settings` is hidden while `THEME_LOCK` holds; its code and the stored
> preference are kept so light can return. The header's controls are unchanged in content and
> wear glass (see [design system](_platform-design-system.md) §3 *Üveg foundation*).
>
> **2026-09-27 (`mezo-zn01o`, `mezo-wqzx8`, `mezo-mcb44`):** the outranked pre-üveg rules were dropped
> from `features/settings/settings.css` (the light washes, Fraunces heroes, domain grid, rows, week strip)
> and `personal-settings.css` (the `.personal-*` editor/core/context/raw blocks and `.settings-account`
> inputs) — the glass layer in `prototype.css` already outranked them. What stays: the per-domain
> `--settings-tone`/`--settings-ink` variables, the Téma picker's scene art (parked with light mode),
> focus rings, and a few layout rules.

> **2026-09-24 (`mezo-yjzhw.4`):** the header's day orb (`AppHeader.tsx`, the filling coral
> `nap-avatar` button) now opens `/nap/napom/<today>` — A napom, the day's own reading — instead
> of the retired `/me/week/napok/<today>` single-day route. Everything else about the header
> (badges, the gear, the "boop" wordmark) is unchanged. See [ritual.md](ritual.md) and
> [today.md](today.md).

## 1. Summary

The header cog opens `/settings`; the previous daypart picker is removed. Preferences are
grouped by Fuel, Train, Mezo, Én and Nap, plus notifications, appearance and account.
[ADR 0046](../decisions/0046-central-settings-personal-context.md) explains ownership.

## 2. User-facing behavior

The originating domain is highlighted. Links preserve validated internal origin state; the
root back link returns there. Domain pages return to the settings parent. The global settings
surface suppresses the domain dock and quick-log FAB. Legacy URLs redirect.

Fuel preserves its nutrition preview, five presets, custom split, protein tiers, day shift,
cadence and three slot templates; water/fiber are compact. Train edits the existing recurring
gym/sport schedules. Én edits biometrics, sleep anchors and the existing weight goal. Nap links
to shared preferences. General settings retains all theme/password/tutorial/owner actions.

Mezo separates Rólam, Így beszélj velem and Ezt kapja meg Mezo. Own prose is never learned over.
The context page shows exact server sections, inclusion, source and correction links, plus
verbatim assembled text. It explicitly excludes global rules and retrieved turn memory.

## 3. Architecture & data flow

`settingsRoutes.tsx` composes existing domain pages/sheets. `SettingsFrame` owns origin handling
and common visual framing. New companion reads use `useDualQuery`; mutations update canonical
caches. Real-mode preview comes only from the shared backend assembler. Mock preview is clearly
labelled simulation; edits persist in the session QueryClient.

**Styling (since `mezo-zn01o`, U11 cleanup, 2026-09-27).** The look is owned by the üveg block
in `frontend/src/styles/prototype.css` (`/* ── uveg en2 beallitasok (mezo-me75u.7) ── */`,
`:25113` — `SettingsFrame`, `SettingsRow`, goal/account/Mezo pages). The pre-üveg light-world
rules that block outranked were deleted after a computed-style A/B crawl proved them inert:
`settings.css` keeps only the per-domain `--settings-tone`/`--settings-ink` skins, live geometry
(`.settings-page` width/padding, breadcrumb, current-area card, theme-picker scenes), focus/
disabled states and the logout colour — its page gradient, hero, domain-grid, row, wash, week
and stats paint are gone; `personal-settings.css` is down to the `.personal-switch input` size
and accent. New settings styling goes into the prototype.css üveg block, not these files.

## 4. Data model & API

GET/PUT `/api/companion/preferences`: `aboutMe`, `customInstructions` (0–4000 chars),
`useLearnedProfile` (default true). GET `/api/companion/personal-context`: exact rendered text
and core/about/instructions/learned sections. PUT `/api/auth/me` corrects canonical name/email.
See [companion](companion.md) and [auth](_platform-auth-security.md) for server details.

## 5. Integrations

Existing domain hooks remain the data owners. Account corrections invalidate personal context.
Biometric/sleep/schedule forms await successful saves and keep drafts on failure. Full-page
prose/Fuel/goal forms guard unsaved navigation and browser close. Goal date derives from current
weight and desired remaining pace; preserved start history means the server engine's full-window
average may differ, explicitly explained and previewed before saving.

## 6. How to use it

Open the header cog from any domain. Choose the highlighted current area or another group.
Use source links on the personal context page to correct canonical data; write priorities and
communication requests only in the corresponding user-owned text fields.

## 7. How to extend it

Add a domain route and SettingsRow (it requires an `icon` — a Titanium 3D name drawn in a lit well; `domain` only tints it, and Boop stays on the hero and the hub's domain tiles, owner decision 2026-09-24, U7 `mezo-me75u.7`), reusing its canonical hooks. Preserve origin state and
loading/error states. Add routes to the page inventory. Do not introduce a second store of a
profile fact or reconstruct real prompt text in the frontend.

## 8. Testing

Colocated settings tests cover origin, domain links, actual schedule PUTs, preferences/account
API writes, exact server preview, late-read protection and unsaved discard/stay behavior.
Shell/navigation tests cover global entry and redirects. Backend context tests compare the
preview with real sync/SSE chat input across conversation-first and rollback paths.

## 9. Decisions & limits

There is no independent editable goal date. Maintenance has no invented arrival date. The
personal preview is not the whole system prompt. Context edits apply on the next chat turn.

## 10. Key files

- `frontend/src/features/settings/settingsRoutes.tsx`: domain routes; personal pages mounted in app router.
- `frontend/src/features/settings/components/SettingsFrame.tsx`: common frame and validated origin.
- `frontend/src/features/settings/components/UnsavedChangesGuard.tsx`: navigation/reload protection.
- `frontend/src/features/settings/pages/MezoPersonalPage.tsx`: introduction, instructions and preview.
- `frontend/src/features/settings/pages/AccountSettingsPage.tsx`: canonical account correction.
- `frontend/src/styles/prototype.css` (`:25113`, uveg en2 beallitasok): the live settings look; `settings.css`/`personal-settings.css` hold only residual skins and geometry.
- `frontend/src/data/companion/preferencesHooks.ts`: dual-mode queries and writes.
