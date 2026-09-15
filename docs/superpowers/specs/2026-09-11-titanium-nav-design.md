# Titanium navigation — design spec (mezo-jkh4)

Date: 2026-09-11. Owner-approved model (A, 2026-09-11): a companion-mark domain switcher +
the current domain's four contextual tabs, with per-domain last-tab memory. Replaces the
current always-5-domain flat bottom bar.

Recon: navigation terrain report 2026-09-11. IA source of truth: handoff §6 / master prompt §5
(the canonical 5×4 matrix) + the prototype `docs/design_2.0/prototypes/companion-titanium/`
(`navigation.js` domains object + switcher + `rememberRoute`).

## The model

Bottom bar (`.tab-bar`), left→right:
1. **Domain-switch button** — the Mezo companion mark (`i-mezo`) + the current domain's name +
   a caret (`⌃`). Tapping it opens the switcher dialog.
2. **The current domain's four contextual tabs** (icon + label). The active tab is highlighted.

**Switcher dialog** ("MERRE MENJÜNK?" / heading "Egy társ. Öt világ."): lists the 5 domains, each
with its name + its four tab labels joined by ` · `; the current domain marked. Selecting a domain
navigates to **its last-visited tab** (memory), else its first tab.

**Active domain** = first path segment (`/nap`→Nap, `/train`→Edzés, `/fuel`→Fuel, `/mezo`→Mezo,
`/me`→Én). A sub-page not among the 4 tabs keeps the domain bar with no tab highlighted.

**Last-tab memory**: a small in-session store `navMemory[domain] = routeOfLastVisitedTab`, updated
on every navigation whose route matches one of the domain's tabs; the switcher links each domain to
its remembered route (default = tab 1). (In-memory module store, like the prototype; optional
localStorage is out of scope.)

**Chrome gates unchanged**: `hideChrome`/`hideFab`/`hideHeader` route lists stay; the whole bar is
hidden on the chrome-free routes (`/ritual`, `/train/session`, `/me/sleep/night`). The header
(`AppHeader`) is unchanged in this slice — only the bottom bar is rebuilt.

## Frozen 5×4 matrix — label → route → clay icon

| Domain (switch mark `i-mezo`) | Tab 1 | Tab 2 | Tab 3 | Tab 4 |
| --- | --- | --- | --- | --- |
| **Nap** | Mai · `/nap` · `i-nap` | Beszélgetés · `/nap/uzenetek` · `i-mezo` | Rutin · `/nap/rutin` · `i-rend` | Napzárás · `/ritual` · `i-hold` |
| **Edzés** | Mai · `/train/mai` · `i-edzes` | Terhelés · `/train/week` · `i-meso` | Napló · `/train/gym` · `i-naplo` | Tervek · `/train/mesocycles` · `i-retegek` |
| **Fuel** | Mai · `/fuel` · `i-tanyer` | Kiegészítők · `/fuel/stack` · `i-kiegeszito` | Trendek · `/fuel/trendek` · `i-trend` | Konyha · `/fuel/konyha` · `i-fazek` |
| **Mezo** | Felfedezések · `/mezo` · `i-minta` | Előrejelzések · `/mezo/predictions` · `i-hajnal` | Karakter · `/mezo/karakter` · `i-kristaly` | Tudástár · `/mezo/knowledge` · `i-tudas` |
| **Én** | Áttekintés · `/me` · `i-emberek` | Súly · `/me/weight` · `i-suly` | Alvás · `/me/sleep` · `i-alvas` | Napló · `/me/naplo` · `i-naplo` |

> **Amendment 2026-09-12 (mezo-o6uv):** the Fuel row above supersedes the original
> `Mai · Receptek · Kamra · Kiegészítők` set. Owner-approved with the Fuel Titanium prototype
> (`docs/superpowers/specs/2026-09-11-fuel-titanium-design.md` §Prototype approval): Receptek and
> Kamra merge into **Konyha**, the freed slot becomes **Trendek**, and the order puts the daily
> jobs first. Route paths of the surviving destinations are unchanged.

Notes / decisions:
- **Karakter moves to Mezo** (owner decision, me-nap-deep: "character remains in Mezo"). Rename
  the route tree `/me/karakter/*` → `/mezo/karakter/*`, add `/me/karakter/*` → `/mezo/karakter/*`
  redirects (legacy links + notifications), and update internal `navigate()`/`Link` targets. This
  is required so the Mezo bar stays active on the Karakter surface (active domain = first segment).
- **Edzés “Napló” → `/train/gym`** is the nearest existing surface (the gym log); flagged for the
  owner to confirm/redirect on the running nav — it is the one destination without a dedicated
  page. Everything else maps to an existing route.
- Active-tab highlight uses longest-matching-prefix so deep sub-pages (e.g. `/fuel/stack/manage`)
  still light the right tab.

## Out of scope (this slice)

Header (`AppHeader`) redesign; the cross-domain shared-date mechanism (handoff §6) — a separate
slice; building a dedicated Edzés “Napló” page; localStorage persistence of last-tab memory.

## Owner gate

Build on `feat/titanium-nav`; the owner approves the **running** nav (switcher + each domain's
tabs, memory, Karakter under Mezo) before merge. Then: full both-mode tests, doc/CODEMAP updates,
PR, CI, current-main premerge, `--no-ff` merge, deploy.

## Prior art

Prototype `navigation.js`/`navigation-state.js` (the exact switcher + `rememberRoute` behavior we
reproduce); MyFitnessPal/Apple contextual bars (per the earlier researcher report) validate a
switcher + contextual tabs over an always-flat 5-tab bar.

## Codebase terrain

Per the 2026-09-11 nav recon: `TabBar.tsx` (5-tab flat model to replace), `AppLayout.tsx` (mount +
gates, unchanged), `router.tsx` (Karakter move + redirects), `headerSection.tsx` (SECTIONS map),
`shared/ui/clay` (all tab icons exist in the new Titanium set). Guard tests to update in lockstep:
`TabBar.test.tsx` (labels/icons/FAB), `navigation.test.tsx` (flows/redirects/subnav-absent),
`hubHeaders.test.tsx` (header order). `Icon.tsx` flat glyphs are legacy (StatusBar/FloatingReturn
only) — not touched.
