# Én domain — new IA: Hol tartok · Test · Célok · Napló (+ Életvonal, Rutin → Nap)

- **Issue:** `mezo-lhqw7` (picks up the open Életvonal item of `mezo-88iwa.16`)
- **Date:** 2026-09-28 · owner brainstorm, all decisions below owner-approved in chat
- **Canon:** Üveg style bible + `elo/en.html` living prototype; restored-world bible §3.4 ranking

## Problem

Én is the only domain whose information architecture was never re-decided. The Titanium / Üveg
programmes re-skinned it (U6, U7) but kept the August Design 2.0 hub-of-tiles:

- Tab bar `Áttekintés · Súly · Alvás · Napló` (`navModel.ts:117-126`) with **no `owns`**, so every
  deep page (goals, week, growth, people, rutin) lights "Áttekintés".
- The weekly summary (`/me/week`) has **no door inside Én** (the hub dropped its Heti tile).
- `GrowthHubPage` is the last page in the old non-glass look.
- Súly / Alvás / Napló tab pages carry a `‹ Én` back chip no other domain's tab page has.
- Rutin is split: built in Én (`/me/rutin`), ticked in Nap (`/nap/rutin`).
- Three things are called "Napló".

## Owner decisions (2026-09-28)

1. The Én main page answers **"Hol tartok"** (body, goals, progress). "What Mezo knows about me"
   stays in the Mezo domain; settings stay behind the header gear.
2. Tabs: **Hol tartok · Test · Célok · Napló** (option 1 of 3).
3. **Rutin building moves to Nap's Rutin tab** ("egy téma, egy hely"); **Emberek stays in Én** as a card.
4. Hol tartok hero = **the week** (score ring + 2–3 sentences → week analysis). Identity
   (name, level, XP, streak, coins) shrinks to a thin strip on top.
5. The **Életvonal** instrument (chosen 2026-09-17, `mezo-88iwa.16`) goes on Hol tartok,
   directly under the week hero, replacing a small body snapshot.
6. Test tab opens on **Súly** by default.
7. (prototype round 1) **The weight goal is a first-class goal**, not a "behind the goals" row:
   the first goal tile on Célok and an equal row on Hol tartok's Célok állása card.

## Design

> **Planning addendum (2026-10-05).** Four points were settled against the code while writing
> the plan (`docs/superpowers/plans/2026-10-05-en-ia.md` §Decisions): the Test tab keeps the two
> existing URLs (`/me/weight` tab home owning `/me/sleep`, no `/me/test`); the Heted lines are
> the first two sentences of the weekly review (no structured "went well / watch" data exists);
> Életvonal stations come from whole-kg crossings and dated perks (badges carry no date); the
> biometrics door moves to the bottom of the Test views. Where this section differs, the plan wins.

### Tab row (navModel)

| Tab | Route | Owns (deep pages that light it) |
|---|---|---|
| Hol tartok | `/me` | `/me/week`, `/me/growth`, `/me/people` |
| Test | `/me/test` | `/me/weight`, `/me/sleep` |
| Célok | `/me/goals` | (prefix already covers `/me/goals/*`) |
| Napló | `/me/naplo` | — |

Test is a real tab page (`/me/test?nezet=suly|alvas`, default `suly`) with a two-way segmented
switch; the switch preserves the query so push deep links land on the right view.
`/me/weight` → `/me/test?nezet=suly` and `/me/sleep` → `/me/test?nezet=alvas` redirect (query
kept); `/me/sleep/night` stays its own chrome-free route. Implementation may keep `WeightPage`
and `SleepPage` bodies as-is and mount them inside the Test page (no duplicated UI).

### Hol tartok (`/me`)

Order, top to bottom:

1. **Identity strip** (thin, flat, not glass): avatar/initial, name, title chip, Lv · XP ·
   streak · coins → `/me/growth`. Kalauz anchor `me-idhero` moves here.
2. **Heted** — the hero (frameless radial halo per §3.4): weekly score ring with big numeral,
   2–3 short lines (what went well / what didn't) from the existing week data, CTA → `/me/week`
   (the week family: elemzés, napok, tanulságok, felfedezések stays as deep pages owned by this tab).
3. **Életvonal** — glass card, one accent: ~12-week weight trajectory as one drawn curve; big
   numeral = Δkg over the window, sub-line = current 7-day measured average; dotted projection
   toward the weight target (only when a target exists and there is a trend basis); a thin
   sleep-rhythm band along the bottom; gold **stations** on the curve, tap → one-line caption.
   Stations come only from events already stored (weight-goal set/changed, a new low of the
   smoothed trend, awards earned in the window); zero stations is a valid state. Honesty:
   < 2 measurements → a calm empty state with a "Mérj" action, no curve. Tap on the card → Test (Súly).
   "A következő állomás" line (target, remaining Δ) when a weight target exists.
4. **Célok állása** — one equal row per active goal, weight goal first (progress % + bar), then
   each life goal with its direction (↗ emelkedik / → tartja / ↘ figyelmet kér, never red) and
   today's pillar count → `/me/goals`; no goals → "Első cél" → `/me/goals/new`.
5. **Two cards**: **Fejlődés** (→ `/me/growth`) and **Emberek** (→ `/me/people`).
   Alvás is represented only in the Életvonal band; the Rutin tile is removed.

Tile lines keep the honesty contract (line read from the destination page's own hook,
`undefined` rather than 0; `me.md` §9 forbids a summary endpoint).

### Test (`/me/test`)

Segmented switch **Súly | Alvás**; each view is today's page content unchanged (hero, stat cells,
chart, logs, sheets, night-mode entry). No `‹ Én` back chip.

### Célok (`/me/goals`)

Today's `CelokPage` becomes a tab page (no back chip). The weight goal leaves the "A célok
mögött" row list and becomes the **first goal tile** (same tile as a life goal: icon, % , bar,
pace · ETA → `/me/goals/weight`); the header count includes it ("4 aktív"); the PERMAH ring
counts life goals only ("életcél"); "＋ Új cél" becomes a wide dashed tile; Jelek stays in
"A célok mögött". All deep pages
(`/new`, `/:id`, `/signals`, `/weight/*`) unchanged, back label → "Célok".

### Napló (`/me/naplo`)

Today's `JournalPage`, back chip removed. No feature change (search/archive stay deferred, `mezo-hq6yk`).

### Moves

- **Rutin → Nap.** `/me/rutin*` pages move under `/nap/rutin/*` (hub → `/nap/rutin/epites` or a
  "Szerkesztés" entry on the Nap Rutin tab; wizard, lánc, szokások, szokás, szerkesztés as deep
  pages owned by the Nap Rutin tab). Every `/me/rutin*` URL redirects (backend deep links
  `/me/rutin/szokas` in `AnchorResolver` / `AppNotificationKind` keep working through redirects).
  The exact Nap-side entry is settled in the prototype.
- **Growth "Napló" → "Tevékenységek"** (label only; route may stay, `napTimeline.ts` links keep working).
- **GrowthHubPage** gets the glass treatment (last old page).
- Deep pages' back label points at their owning tab (Hol tartok / Test / Célok / Rutin).
- Notifications feed stays behind the bell; settings behind the gear — unchanged.

### Not changing

No data, endpoint or feature removed; every control and field of every touched page remains
(reverse parity list in the plan). Backend unchanged (FE-only) unless the Életvonal station
source proves to need an endpoint — then the plan says so explicitly and asks.

## States

Loading without layout jump; gentle error + retry; empty states honest (no invented numbers);
320px; reduced-motion branch for the ring count-up and the curve draw (static final frame).

## Prior art

- **Strava "You"** — content lenses as sub-tabs, settings behind a header icon: adopted
  (settings stay behind the gear). https://support.strava.com/en-us/articles/15401618-progress-summary-chart
- **Oura 2025 / WHOOP Health** — long-term body data (baselines, trends) separated from the
  daily view: adopted as the Test tab + Életvonal. https://ouraring.com/blog/new-oura-app-experience/ ·
  https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/
- **MacroFactor "Strategy"** — goals are content with progress, not settings: adopted (Célok tab).
  https://macrofactor.com/dashboard-revamp/
- **ChatGPT memory** — rejected for Én: coach memory already lives in Mezo (Rólad / Emlékek).
  https://openai.com/index/memory-and-new-controls-for-chatgpt/

## Codebase terrain

- Nav: `frontend/src/app/navModel.ts:117-126` (Én row), `activeTabRoute` `:160-173`; `TabBar.tsx`.
- Routes: `frontend/src/app/router.tsx:495-599`; retired-redirect idiom `FUEL_RETIRED_REDIRECTS`
  (`:170-195`) + `router.fuelRetiredRedirects.test.tsx`.
- Pages: `features/me/pages/EnHubPage.tsx` (hub, honesty header comment), `WeightPage.tsx:49`,
  `SleepPage.tsx:83`, `JournalPage.tsx:108` (back chips), `GrowthHubPage.tsx:64-95` (non-glass),
  `WeekHubPage.tsx:170-173` (8-week trend hard-coded `[]`), `RutinHubPage.tsx`,
  `features/today/pages/NapRutinPage.tsx`.
- Tab-page pattern: `fuel/pages/FuelTrendekPage.tsx` (`MozaikPage` + `PageBody` + `EntranceGroup`, no back chip).
- Inventory: `app/pageIndex.ts:141-172` + `pageIndex.coverage.test.ts`; `MindenOldalPage` groups by tab.
- Tests pinning Én: `TabBar.test.tsx`, `navigation.test.tsx`, `hubHeaders.test.tsx` (Kalauz on `/me`,
  anchor `me-idhero`), `EnHubPage.test.tsx`, layout `navigation.spec.ts` (4 links), `layout.spec.ts:373-425`.
- CSS: `styles/prototype.css` `── uveg en …` / `── uveg en2 …` blocks, guarded by
  `prototypeCssStructure.test.ts:1633,1722-1740`.
- Backend hard-coded `/me/...` deep links: `AppNotificationKind.java:31-54`,
  `AnchorResolver.java:110-112,566`, `EditionCandidateCollector.java:460` → keep via FE redirects.
- Docs drift to fix in the same change: `me.md` (:93 profile orb, ~:163 Heti tile, :688, :704, :39, :23),
  `docs/features/README.md:64`, `elo/README.md` Nap row.
