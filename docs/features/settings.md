---
title: Central settings and personal context
type: feature-platform
status: done
updated: 2026-10-11
tags: [frontend, platform, ai]
key_files:
  - frontend/src/features/settings
  - frontend/src/data/companion/preferencesApi.ts
  - frontend/src/data/companion/preferencesHooks.ts
  - frontend/src/app/TitleBar.tsx
  - frontend/src/shared/i18n/messages/settings.hu.ts
  - frontend/src/features/me/pages/BeallitasokPage.tsx
related: [_platform-design-system, _platform-language, companion, me, fuel, train, insights, _platform-auth-security]
---

# Central settings

> **2026-10-11 — two languages (`mezo-n4wf5.11`, slice N1).** Every Settings page (hub, Train / Me / Mezo / Nap, account, the
> personal-context editors, `/settings/general`, `/settings/notifications`) reads its words from the `settings` area of the
> message catalog (`frontend/src/shared/i18n/messages/settings.hu.ts` is the source, `settings.en.ts` the typed twin; the
> English wording is the owner-approved prototype `vilagos/en.js`). The mechanism, the resolution order and the guards are in
> [`_platform-language.md`](_platform-language.md). Hungarian is unchanged word for word, with **two approved copy changes**
> (the prototype is the build target): the hub row for `/settings/general` now says „Nyelv, kalauzok, fiók, jelszó" and that
> page's intro says „Ugyanaz a világ. A saját nyelveden és szokásaiddal." The new **„Nyelv" block** is the first section of
> `/settings/general` (`BeallitasokPage.tsx`, heading + `section.settings-lang.glass`): a `role="group"` pair of buttons
> (*Magyar* / *English*, `aria-pressed`, ≥ 44 px, one row at 320 px) that calls `useLanguageSetting().setLanguage` (optimistic,
> stored with the account, rolled back with the save-failed toast; choosing the active language does nothing; the control stays
> usable while the save is pending), a body sentence and the „English is in progress" note (removed in F9). Its rules
> (`.settings-lang`, `-options`, `-choice`, `-body`, `-note`) live in the `uveg en2 beallitasok` block of
> `frontend/src/styles/prototype.css` (search the marker, not a line number). Notification category names live in the catalog
> (`settings.notifications.categories`); `NOTIFICATION_CATEGORY_META` keeps only section / lead-chip data for rendering.
> **Still Hungarian in English mode** (other slices own them): Fuel settings, the goal settings page, the gym / sport /
> biometric / energy-breakdown / sleep-goal / change-password sheets, the learned-profile card, and server-provided text
> (the assembled context, what the user wrote).

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

> **2026-09-29 (`mezo-xojq8`, `mezo-d5y2m`):** the Mezo personal-context textarea (`MezoPersonalPage`, about-me / custom instructions) is wrapped in the shared `VoiceField` (mic tile, dictation appended within the 4000-char cap). Tapping a row in the header's notification panel now marks that item read (`markItemRead`, only if still unread) before following its deeplink; the panel and the full feed both show the live `readAt`.
>
> **2026-09-24 (`mezo-yjzhw.4`):** the header's day orb (`AppHeader.tsx` — the `TitleBar` day orb since Folyadék F1, `mezo-n4wf5.1`, level only — the filling coral
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
in `frontend/src/styles/prototype.css` (the block opened by `/* ── uveg en2 beallitasok (mezo-me75u.7) ── */` and closed by
`/* ── /uveg en2 beallitasok ── */` — `SettingsFrame`, `SettingsRow`, goal/account/Mezo pages, the Nyelv block; search the
markers, the file keeps growing and a line number rots). The pre-üveg light-world
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

Add a domain route and SettingsRow (it requires an `icon` — an `Icon3DName`, i.e. a `t-*` id of the Folyadék-jel sprite (outlined glyph, half-filled with the domain liquid; the ids kept their Titanium-era names), drawn in a lit well; `domain` only tints it, and Boop stays on the hero and the hub's domain tiles, owner decision 2026-09-24, U7 `mezo-me75u.7`), reusing its canonical hooks. Preserve origin state and
loading/error states. Add routes to the page inventory. Do not introduce a second store of a
profile fact or reconstruct real prompt text in the frontend.

## 8. Testing

Colocated settings tests cover origin, domain links, actual schedule PUTs, preferences/account
API writes, exact server preview, late-read protection and unsaved discard/stay behavior.
Shell/navigation tests cover global entry and redirects. Backend context tests compare the
preview with real sync/SSE chat input across conversation-first and rollback paths.
Language: `SettingsPages.en.test.tsx` (every page in English, a runtime switch on one DOM node), `BeallitasokPage.language.test.tsx` (the Nyelv block: default, switch, rollback), `NotificationsPage.en.test.tsx`, and the layout specs `tests/layout/settings-language.spec.ts` / `language-en.spec.ts` at 390 and 320 px.

## 9. Decisions & limits

- **Chrome (Folyadék F1, `mezo-n4wf5.1`).** `/settings/*` hides the bottom bar; the `TitleBar` is the only shell chrome. The settings button lives on the hubs' title bar only (sub-pages are back · title · „?" · bell), so deep pages reach `/settings` via a hub. The settings sub-pages keep their fixed `navigate('/settings…', { state })` back (origin-state return); converting them to „vissza oda, ahonnan jöttél" is slice F8.

There is no independent editable goal date. Maintenance has no invented arrival date. The
personal preview is not the whole system prompt. Context edits apply on the next chat turn.

## 10. Key files

- `frontend/src/features/settings/settingsRoutes.tsx`: domain routes; personal pages mounted in app router.
- `frontend/src/features/settings/components/SettingsFrame.tsx`: common frame and validated origin.
- `frontend/src/features/settings/components/UnsavedChangesGuard.tsx`: navigation/reload protection.
- `frontend/src/features/settings/pages/MezoPersonalPage.tsx`: introduction, instructions and preview.
- `frontend/src/features/settings/pages/AccountSettingsPage.tsx`: canonical account correction.
- `frontend/src/styles/prototype.css` (the `uveg en2 beallitasok` block): the live settings look; `settings.css`/`personal-settings.css` hold only residual skins and geometry.
- `frontend/src/data/companion/preferencesHooks.ts`: dual-mode queries and writes.
- `frontend/src/features/me/pages/BeallitasokPage.tsx`: `/settings/general`, including the Nyelv block; `NotificationsPage.tsx`: `/settings/notifications`.
- `frontend/src/shared/i18n/messages/settings.{hu,en}.ts`: every Settings page's words; `frontend/src/data/auth/languageHooks.ts`: the language write.
