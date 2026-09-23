---
title: Central settings and personal context
type: feature-platform
status: done
updated: 2026-09-23
tags: [frontend, platform, ai]
key_files:
  - frontend/src/features/settings
  - frontend/src/data/companion/preferencesApi.ts
  - frontend/src/data/companion/preferencesHooks.ts
  - frontend/src/app/AppHeader.tsx
related: [_platform-design-system, companion, me, fuel, train, insights, _platform-auth-security]
---

# Central settings

> **2026-09-23 (`mezo-me75u.1`):** the app is locked to dark (üveg style bible §8). The
> Téma picker on `/settings` is hidden while `THEME_LOCK` holds; its code and the stored
> preference are kept so light can return. The header's controls are unchanged in content and
> wear glass (see [design system](_platform-design-system.md) §3 *Üveg foundation*).

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

Add a domain route and SettingsRow, reusing its canonical hooks. Preserve origin state and
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
- `frontend/src/data/companion/preferencesHooks.ts`: dual-mode queries and writes.
