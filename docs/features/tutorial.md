---
title: Mezo-kalauz (in-app page guides)
type: feature
status: mixed
updated: 2026-09-03
tags: [tutorial, onboarding, frontend, backend]
key_files:
  - frontend/src/features/tutorial
  - frontend/src/shared/ui/kalauz
  - frontend/src/shared/lib/tutorialSeen.ts
  - frontend/src/data/tutorial
  - backend/src/main/java/io/mrkuhne/mezo/feature/tutorial
  - api/feature/tutorial/tutorial-progress.yml
related: [today, train, insights, me, fuel, _platform-design-system, _platform-data-layer, _platform-auth-security]
---

# Mezo-kalauz — In-App Page Guides

> One-line: per-route onboarding tutorials ("kalauz"), a five-card sheet auto-shown once per route
> tier and reachable any time from the header "?" button, plus a first-launch welcome pager on
> `/nap`. **Status: mixed — backend ✅ done (`tutorial_progress` singleton, 3 endpoints), FE ✅ done
> for the motor (`TutorialProvider`, `KalauzSheet`, registry, header "?") and the `T0` welcome flow
> (`KalauzWelcome`, `registry/welcome.ts`), content 🔶 five T1 hub guides (`nap`, `train`,
> `fuel`, `mezo`, `me` — all version 1) plus the S3a batch of **fourteen T2 guides** for the Nap
> and Edzés sub-pages (mezo-gb1s.5) and the S3b batch of **eight T2 guides** for the Fuel
> sub-pages (mezo-gb1s.6), the shared `fogalmak.ts` glossary and the four-step welcome;
> the Mezo/Én T2 batches (S3c–d) and every T3 guide are still unbuilt.**

## 1. Summary

Mezo-kalauz is the in-app guide system: a small, dismissible five-card sheet that walks a user
through what a page is for, tied to the route via a typed **registry** and remembered per-user via
a **seen-store**. The driving design is
[`docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`](../superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md)
(decisions D1–D11, open questions §13); the plan is
[`docs/superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md`](../superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md);
the prototype is [`docs/design_2.0/prototypes/kalauz.html`](../design_2.0/prototypes/kalauz.html).

**S1 (`mezo-gb1s.1`) shipped the motor, not the content library**: the seen-store (backend + FE),
the `TutorialProvider` engine (auto-open, session-guard, local-first write, server-merge), the
`KalauzSheet` UI (five card kinds, spotlight peek), the header "?" affordance, and exactly **one
real guide** — `fuel` (T1, the Fuel hub). **S2a (`mezo-gb1s.3`) then added the four remaining
tab-root guides** — `nap`, `train`, `mezo`, `me` (all T1, version 1) — plus the shared
`fogalmak.ts` concept glossary a `fogalom` card's `term`/`def` now spread from (§7). Every guide is
real end-to-end: no mock-vs-real split inside the tutorial domain itself, `useTutorialProgress`
runs the same dual-mode data-layer contract every other backed hook does.

Guide **tiers** (`KalauzTier`): `T1`/`T2` auto-open once per route-visit-and-not-yet-seen (after
the page's entrance choreography settles); `T3` never auto-opens — it is reachable only via the
header "?", which then carries the `.nap-offnow` amber dot while unseen. **S3a (`mezo-gb1s.5`)
shipped the first T2 batch**: all five Nap sub-pages (`/nap/uzenetek|rutin|kuldetesek|checkin|eletjel`)
and all nine Edzés sub-pages (`/train/mai|week|sport|futas|exercises|medals|mesocycles|session`,
`/train/review/:workoutId` — the registry's first parameterised route), each with a
`data-kalauz-anchor` spotlight target where the page has an always-rendered one. **S3b
(`mezo-gb1s.6`) shipped the Fuel batch**: `/fuel/log`, `/fuel/log/uj`, `/fuel/plan`, `/fuel/stack`,
`/fuel/recipes`, `/fuel/kamra`, `/fuel/gyogyszer`, `/fuel/naplo` — eight guides, three new glossary
keys (`ablak`, `stack`, `pontszam`) and six anchors, three of them through `PageHero`'s new
optional `kalauzAnchor` prop. The Mezo/Én T2 batches (S3c–d) and the T3 single-card layer are
still **out of scope**.

**S2b (`mezo-gb1s.4`) added `T0`**: a one-time, four-step first-launch **welcome pager**
(`frontend/src/shared/ui/kalauz/KalauzWelcome.tsx`), shown once on `/nap` before any per-route
guide gets a chance to auto-open. It is a different UI family from `KalauzSheet` (a full-screen
pager, not a bottom sheet) and its registry entry
(`frontend/src/features/tutorial/registry/welcome.ts`) deliberately lives **outside**
`KALAUZ_REGISTRY` — see §2 below.

## 2. User-facing behavior

- **Auto-open**: on a route with a `T1`/`T2` registry entry not yet seen (by registry `version`),
  the guide opens itself ~600 ms after the route settles (0 ms under `prefers-reduced-motion`),
  once per app session per guide (a session-guard survives the delayed timer even if the user
  navigates away before it fires).
- **The header "?"** (`.nap-roundbtn.nap-q`, `AppHeader.tsx`) — renders **only** when the current
  route has a registry entry (honest state: no dead button on guide-less pages), always first in
  the button row so the daypart switch's presence never shifts it. Opens the current route's guide
  on tap; carries `.is-open` while its sheet is open and `.nap-offnow` when it is a `T3` guide not
  yet seen.
- **The sheet** (`KalauzSheet`) — up to five cards, one question type each (`Mi ez?` / `Mire jó?` /
  `Hogyan használjuk?` / `Mikor nézzük?` / `Mivel függ össze?`), a step dot-row, Vissza/Tovább
  navigation, and on the last card a `"Kihagyom"` link and `"Értem, kezdjük"` CTA. A `hogyan` card
  may carry a `"Mutasd meg a képernyőn"` spotlight button (only rendered when its DOM anchor
  actually exists on the page) that **peeks** the sheet — collapses it to a thin bottom bar,
  clears the backdrop, and darkens everything except the anchored element via a portaled
  `.kalauz-spot` box. Any tap (bar, backdrop, anchor) un-peeks.
- **Kihagyom / ✕ / Escape vs "Értem, kezdjük"**: both close the sheet, but only the CTA marks the
  guide **completed** (`completedAt`); the others record **`dismissedAtStep`** (the card index at
  close). Neither changes whether the guide counts as *seen* — see §3.
- **`kapcsolat`** cards render chip links to other routes; tapping one both navigates and closes
  the sheet as `'done'`.
- Route navigation while a guide is open closes it as a dismissal at step 0 (`dismissedAtStep: 0`)
  — the guide doesn't survive a page change.

### T0 — the first-launch welcome

- **`WELCOME`** (`frontend/src/features/tutorial/registry/welcome.ts`) — `WELCOME_ID = 'welcome'`,
  `WELCOME_VERSION = 1`, four steps: `napszak` (the three daypart faces), `tabbar` (all five tabs),
  `log` (the real `QuickInputSheet` tile grid + "Mondd el Mezónak" row), `sugo` (a pointer to the
  header "?"). It is deliberately **outside `KALAUZ_REGISTRY`** — a `/nap`-routed entry there would
  collide with the `nap` guide (identical pattern, which the registry route-lint rejects), and the four steps
  are tappable demos `KalauzCard`'s five kinds can't express. Its seen-key still lands in the same
  `tutorial_progress` map (the backend is key-agnostic), so this needs **no backend/contract
  change** — `versionOf(id)` (`registry/index.ts`) special-cases `WELCOME_ID` so `isUnseen('welcome')`
  resolves correctly even though `getKalauz('welcome')` would return `null`.
- **Trigger**: `TutorialProvider` opens the welcome when `welcomeStatus === 'pending' &&
  pathname === '/nap' && !isPending` (the `isPending` wait avoids a flash-then-revert on a new
  device where localStorage is empty but the server already has it marked seen). While
  `welcomeStatus === 'pending'` on `/nap`, the per-route auto-open timer for `nap`'s own `T1` guide
  is held back by the same "is anything open?" seam described in §9 — **there is no chaining**
  between the welcome and `/nap`'s own kalauz; they simply never race, because the welcome's gate
  blocks the timer from ever starting. The seam runs **both ways**: the welcome effect also
  refuses to open while a `KalauzSheet` is open (the "?" button can fire during a long `isPending`
  window), because `.welcome` sits at `z-index: 60` — *below* the sheets (200) — so it would
  otherwise mount invisibly, write its own `seenAt` ("seen = shown" would be a lie), steal focus,
  and put two `aria-modal` dialogs on screen at once. `openId` is a real dependency of that
  effect, not just a ref read, so the welcome still opens the moment the sheet closes.
- **Route change closes it**, exactly like an open sheet: the route effect's force-dismiss branch
  handles the welcome too, writing `dismissedAtStep: 0` (the same value the sheet branch uses —
  the provider does not know the pager's internal step) when the entry is neither completed nor
  already dismissed. Without this an Android back gesture would leave the full-screen overlay,
  its `document`-level Tab-trap and its `Escape` handler mounted over the page the user left.
  The branch keys off the pathname the welcome *opened on*, not a bare "is open" flag, so a
  StrictMode re-run of the route effect can't dismiss the welcome it just opened.
- **UI** (`KalauzWelcome.tsx`) — a domain-free, full-screen pager (not `KalauzSheet`), portalled
  into `.phone-screen`, `z-index: 60`. It follows the ARIA APG dialog pattern: focus moves to the
  step `<h2>` on mount and again on every step change, `Escape` closes with reason `'skip'`, and
  focus returns to the element that opened it on unmount. The back button's accessible name is
  exactly `Vissza` (the `‹` glyph is `aria-hidden`).
- **Registry vs. welcome are not the same UI stack**: `KalauzCard`'s five question types, the
  glossary, and the hang-lint (§7) apply only to `KALAUZ_REGISTRY` entries. `WELCOME`'s steps have
  their own shape (`WelcomeStep`) and their own copy; they share only the lint *primitives*
  (`FORBIDDEN`, `countSentences` — `frontend/src/features/tutorial/registry/lint.ts`), factored out
  so `registry.test.ts` and `welcome.test.ts` enforce the same voice rules without duplicating them.

## 3. Architecture & data flow

```
TutorialProvider (route-aware, mounted once in AppLayout)
  ├─ registry: findKalauz(pathname) → KalauzEntry | null   (features/tutorial/registry)
  ├─ useTutorialProgress() ⇄ tutorialSeen.ts (localStorage mirror, key `mezo.kalauz.v1`)
  └─ renders <KalauzSheet> (shared/ui/kalauz) when a guide is open
```

- `TutorialProvider` (`frontend/src/features/tutorial/TutorialProvider.tsx`) is mounted once in
  `AppLayout` around `MezoThreadProvider` — the same "one shell-level provider" pattern the Mezo
  chat thread uses. It exposes `useTutorial()` (§6) to the rest of the tree.
- On every route change it looks up `findKalauz(pathname)` (the **registry**,
  `frontend/src/features/tutorial/registry/index.ts`) and decides whether to auto-open (§2).
- Progress is a `Record<guideId, TutorialProgressEntry>`. Local state (`useState` seeded from
  `tutorialSeen.ts`'s `readLocalProgress()`) is the **immediate** truth; `useTutorialProgress()`
  (`frontend/src/data/tutorial/tutorialProgressHooks.ts`) is the server truth arriving
  asynchronously. **Write order** (`persist()`): write to React state + localStorage
  *synchronously*, then fire the `PUT` in the background — a `PUT` failure leaves the local write
  standing (the next successful `GET`/merge retries it). **Read/merge**: when the server value
  lands, `mergeProgress(server, local)` (`tutorialSeen.ts`) takes the union keyed by guide id,
  later `seenAt` wins, ties go to local (the optimistically-fresher side); any local-only surplus
  is written back to the server so a stale server row self-heals on the next merge.
- `KalauzSheet` (`frontend/src/shared/ui/kalauz/KalauzSheet.tsx`) is **domain-free** — it receives
  `label`/`cards` as data and knows nothing about seen-state; it reports back only
  `onClose(reason: 'skip' | 'done', step: number)`, which `TutorialProvider` turns into a
  `dismissedAtStep` or `completedAt` write.

## 4. Data model & API

**Table**: `tutorial_progress` (migration
`backend/src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-gb1s.1_create_tutorial_progress.sql`)
— a per-user **singleton** row (same shape as `fuel_settings`: partial-unique index on
`created_by` where `is_deleted = false`), one `jsonb` column (`progress`, keyed by guide id →
`TutorialProgressEntryJson`), soft-delete (`is_deleted`), `updated_at`.

**Contract** ([`api/feature/tutorial/tutorial-progress.yml`](../../api/feature/tutorial/tutorial-progress.yml),
tag `TutorialProgress`):

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/tutorial/progress` | Returns `TutorialProgressResponse{progress}` — **empty-map ghost**, never 404, before anything is seen. Corrupt jsonb entries (blank `seenAt`, unparseable date) are **skipped with a `log.warn`**, not thrown — the rest of the map still returns. |
| `PUT` | `/api/tutorial/progress` | `SetTutorialProgressRequest{progress}` → whole-map replace (upsert the singleton row). The client owns the merge (§3); the server never merges. |
| `DELETE` | `/api/tutorial/progress` | `204`; soft-deletes the live row — triggered by the **"Kalauzok újranézése"** row in `frontend/src/features/me/pages/BeallitasokPage.tsx:70-87` (not owner-gated), which drives an `idle \| busy \| done \| error` state off `resetAll()`'s promise; next `GET` returns the empty ghost again. |

`TutorialProgressEntry` shape: `{ version: int, seenAt: date-time, completedAt: date-time | null,
dismissedAtStep: int | null }`. `version` is the **registry** version of the guide that was seen —
a version bump in the registry entry re-arms the auto-show even for users who already saw the
older version.

Gated by the switch `mezo.feature.tutorial.enabled`
(`FeaturesConfiguration.TUTORIAL_SWITCH`) — both `TutorialProgressController` and
`TutorialProgressService` are `@ConditionalOnProperty` on it.

## 5. Integrations

- **`AppHeader`** (`frontend/src/app/AppHeader.tsx`) — reads `useTutorial().current`/`.openId`/
  `.isUnseen()` to render the "?" button (only when a guide exists for the route), its `.is-open`
  state, and the `.nap-offnow` dot for unseen `T3` guides.
- **`AppLayout`** (`frontend/src/app/AppLayout.tsx`) — mounts `TutorialProvider` once, around
  `MezoThreadProvider`, so every route inside the shell shares one guide-engine instance.
- **Five page seams**, one `data-kalauz-anchor` DOM hook per tab-root guide's `hogyan` card
  spotlight:
  - `fuel-log` — the Logolás hero tile wrapper, `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
    (one node).
  - `nap-hero` — all four `.nap-hero` nodes in
    `frontend/src/features/today/pages/NapHubPage.tsx`: three daypart faces (reggel/nappal/este)
    plus the `?day=rough` anchor-mode hero. Anchor mode is a dev URL-param state (provisional,
    `mezo-d20.11`, final form deferred to the F7 design round) and is deliberately outside the
    scope of the guide copy — it carries the anchor only so the spotlight does not degrade there.
  - `train-hero` — all six `.eh-hero` variants in
    `frontend/src/features/train/pages/EdzesHubPage.tsx`.
  - `mezo-chat` — the composer-shaped chat opener, one node, in
    `frontend/src/features/insights/pages/MezoHubPage.tsx` (the `Mezo` tab's page module still
    lives under `features/insights` — see [`insights.md`](insights.md) for the tab-rename
    history).
  - `me-idhero` — the identity hero, one node, in `frontend/src/features/me/pages/EnHubPage.tsx`.
- **`BeallitasokPage`** (`frontend/src/features/me/pages/BeallitasokPage.tsx:70-87`) — the
  "Kalauzok újranézése" row calls `useTutorial().resetAll()` and reflects its promise in an
  `idle | busy | done | error` local state; this row is **not** owner-gated (unlike the LLM-usage
  row on the same page), since resetting the tutorial state has no cost implication.
- **Auth** — `created_by` is stamped server-side from `CurrentUserId`, never client-supplied (same
  ownership seam as every other backed feature, [`_platform-auth-security.md`](_platform-auth-security.md)
  §4). The **`tutorialSeen.ts` localStorage key is `mezo.kalauz.v1`, with no user-id prefix** —
  fine for S1's single-owner reality; the future multi-user slice is the one that must namespace
  it (spec §13, open question #2 — see §9).
- **Design system** — `KalauzSheet` builds on the shared `Sheet` primitive
  (`frontend/src/shared/ui/Sheet.tsx`, which gained optional `onBackdropClick`/`backdropClassName`
  props for the peek state) and the `Clay` icon/spot sprites, per
  [`_platform-design-system.md`](_platform-design-system.md).
- No other domain reads or writes `tutorial_progress` — it is a self-contained cross-cutting layer
  like notifications, not a domain with its own tab/route.

## 6. How to use it (consume)

```ts
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { useTutorialProgress, useTutorialProgressActions } from '@/data/hooks'
```

- `useTutorial()` — the shell-level context: `{ current, openId, open(id), close(reason, step),
  isUnseen(id), resetAll() }`. `current` is the `KalauzEntry | null` for the route right now (drives
  the header "?"); `open`/`close` drive the sheet; `isUnseen(id)` compares the stored `version`
  against the registry's (via `versionOf`, so it also resolves the `welcome` id — see §2).
  `resetAll()` is an honest reset: it clears every session flag (`autoShown`, the pending timer,
  the open sheet, `welcomeStatus`/`welcomeOpen`), the local mirror, and fires the `DELETE`, but
  **it now rejects when the `DELETE` fails** rather than swallowing the error — the caller decides
  what to show. `tutorialProgressHooks.ts`'s reset mutation guards the round-trip on two fronts:
  `cancelQueries` on the progress key stops an in-flight `GET`'s **response** from landing after
  the `DELETE` and writing the old map back — but the map **already sitting in the query cache**
  is a separate hazard, because the `DELETE` flies for 300 ms – 2 s and every reader
  (`TutorialProvider`'s server-merge and welcome effects) would see the pre-reset server state
  meanwhile: a tab-tap to `/nap` in that window used to find `welcome` "already seen" and
  silently suppress it for the whole session. So the mutation **optimistically writes `{}` into
  the cache before the `DELETE`**, and on failure restores the previous value (or drops the entry
  if there was none) before rethrowing — a failed reset must not leave the cache empty, since the
  server still holds the data. It is wired to the "Kalauzok újranézése" row in
  `BeallitasokPage.tsx` (§5).
- `useTutorialProgress()` / `useTutorialProgressActions()` — the raw dual-mode data-layer hooks
  (`@/data/tutorial/tutorialProgressHooks.ts`, re-exported from `@/data/hooks`) most call sites
  never need directly; `TutorialProvider` is the one consumer. `TUTORIAL_PROGRESS_GHOST` (`{}`) is
  the honest empty value in both mock and real mode before anything is seen.
- Never import `KalauzSheet` outside `TutorialProvider` — it is a dumb renderer over
  `{ label, cards, onClose, onNavigate }`, not a data-fetching component.

## 7. How to extend it

Adding a guide to an existing route:

1. Add (or extend) a registry file under `frontend/src/features/tutorial/registry/` (see `fuel.ts`
   for the shape) exporting a `KalauzEntry[]`.
2. Wire it into `KALAUZ_REGISTRY` in `frontend/src/features/tutorial/registry/index.ts`. **Array
   order carries no meaning**: `findKalauz` delegates to `resolveKalauz`, which runs react-router's
   own `matchRoutes` ranking over the entry patterns, so the literal sibling always beats the
   parameterised one (`/me/people/heti` over `/me/people/:id`) exactly as the router picked the
   page. Two guards in `registry.test.ts` keep that true: no two entries may share a route pattern,
   and no overlapping pair may be *rank-tied* (a tie is where the array order would silently
   decide — e.g. `/me/:a/heti` vs `/me/people/:b`, both scoring 10+3+10). A tie is reported as
   `a (route) ⇄ b (route) — <witness pathname>`; fix it by making one pattern more specific.
3. If a `hogyan` card wants a spotlight, add `data-kalauz-anchor="<name>"` to the target DOM
   element on the real page — the spotlight button only renders when the anchor is present, so a
   missing anchor degrades gracefully rather than pointing at nothing. Two shared components carry
   the attribute behind an optional prop rather than making every call site hand-roll the markup:
   `DayStrip`'s `kalauzAnchor` (S3a) and `PageHero`'s `kalauzAnchor` (S3b, `shared/ui/mozaik`) —
   on a Mozaik sub-page the hero is often the ONLY unconditionally rendered element, so it is
   frequently the only honest target. Anchor **unconditional** elements only.
4. A `fogalom` card never has its `term`/`def` typed by hand: it spreads
   `...fogalom('<key>')` from `frontend/src/features/tutorial/registry/fogalmak.ts` at
   registry-construction time. A new concept lands in `fogalmak.ts` first (with a source
   comment pointing at where the term is authoritative), then the card references it by key —
   this keeps the `KalauzCard` type and `shared/ui/kalauz` domain-free.
5. Run the **hang-lint** test (`frontend/src/features/tutorial/registry/registry.test.ts`) — it
   enforces no forbidden words (`kell|muszáj|hiba|elbukik|rossz`), ≤2 sentences per card, ≤25 words
   per `fogalom` definition, unique ids, every route matching a real router route, `version ≥ 1`,
   plus a glossary lint (every `fogalom` card resolves to a `FOGALMAK` entry, no orphan keys) and
   a chip-route lint (every `kapcsolat` link target is a real route).

A new guide needs **no backend change** — the `jsonb` map is free-form on the server; the guide id
is only meaningful to the frontend registry. Bump `version` on an existing entry (never rename
`id`) to re-arm the auto-show for users who already saw an older version.

## 8. Testing

- **FE** (Vitest + RTL + MSW, both modes):
  `frontend/src/features/tutorial/TutorialProvider.test.tsx` (auto-open delay, seen-on-open,
  dismissed/completed writes, session-guard, version-bump re-arm, route-change close),
  `frontend/src/shared/ui/kalauz/KalauzSheet.test.tsx`, `frontend/src/shared/lib/tutorialSeen.test.ts`,
  `frontend/src/data/tutorial/tutorialProgressHooks.test.ts`,
  `frontend/src/features/tutorial/registry/registry.test.ts` (hang-lint + route/id checks),
  `frontend/src/features/tutorial/registry/welcome.test.ts` (the same hang-lint, over `WELCOME`'s
  steps, via the shared `registry/lint.ts` primitives),
  `frontend/src/shared/ui/kalauz/KalauzWelcome.test.tsx` (steps, focus contract, Escape). Header
  tests that render a route with a registry hit (`frontend/src/app/AppHeader.test.tsx`,
  `frontend/src/app/hubHeaders.test.tsx`) seed **every** guide as already-seen via
  `seedAllKalauzSeen()` (`frontend/src/test/kalauz.ts`) before rendering, so the header's own
  assertions aren't flaked by the 600 ms auto-open — not `writeLocalProgress()` directly (that was
  true only while `fuel` was the sole guide; see §9's "shell tests must seed every guide" note).
- **MSW**: `resetTutorialProgressState()` is called from `frontend/src/test/setup.ts`'s
  `afterEach`, and that same `setup.ts` prefix-clears every `mezo.kalauz.*` localStorage key after
  each test — a persisted "seen" mark would otherwise silently mute the next test's auto-open.
- **Backend ITs**: `backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressApiIT.java`
  (7 tests: empty-ghost GET, PUT replace + round-trip, DELETE reset, 400 on invalid entry, 401
  without a token, empty-map PUT, corrupt-entry skip-on-read) + `TutorialProgressSwitchOffApiIT.java`
  (the switch-off 404/absent-bean path). Cross-user ownership isolation (spec §6) is **not**
  covered here — the single-owner IT harness this repo has today can't stand up a second
  authenticated user to assert against; tracked for the multi-user slice.
- **Visual goldens**: `frontend/tests/visual/visual.spec.ts` seeds `mezo.kalauz.v1` in its init
  script so the header "?" renders deterministically seen/unseen — but **only in the file's first
  `describe` block** (the theme-comparison suite, `:114-`). The other `addInitScript` calls in the
  same file (`:144`, `:175`, `:197`, `:212`, `:225`, `:238`) set only the `mezo-theme` localStorage
  key and touch no route with a kalauz seam, `/nap` included; `fuel-{light,dark}.png` changed in
  this slice purely because of the new "?" button (baseline refresh via the
  `update-visual-baselines.yml` workflow, not a content regression).

## 9. Decisions, gotchas & deferred

- Decisions D1–D11 and the full UX/architecture rationale live in the spec
  ([`docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`](../superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md))
  — this doc doesn't restate them.
- **Seen = appeared**, not completed or dismissed (the Appcues modal rule) — `seenAt` is written
  the instant the sheet opens, not on any closing action. `completedAt`/`dismissedAtStep` are
  independent, both-optional fields recording *how* it was closed, and neither affects whether
  `isUnseen()` still returns true.
- **`.is-peek` sets `animation: none`** in the sheet CSS — the `sheet-rise` keyframe's `both` fill
  mode would otherwise override the peek's `transform`, snapping the sheet back to its risen
  position every re-render.
- **The header "?" renders only on a registry hit** — this is a deliberate honesty rule (§2), not
  an oversight; a guide-less route shows no button at all rather than a disabled one.
- **Header tests are seed-order-sensitive**: any test that renders a kalauz-having route and
  asserts on the header's control count/order must seed guides as seen first (via
  `seedAllKalauzSeen()`, see the "shell tests must seed every guide" note below), or the 600 ms
  auto-open timer can fire mid-test.
- **Auto-open never fires while something is already open** (`TutorialProvider.tsx`, route effect):
  a `kapcsolat` chip navigates *before* its sheet finishes the 300 ms exit, and under
  `prefers-reduced-motion` the destination's auto-open delay is 0 — without the guard the
  destination guide opened into the still-exiting sheet and got `seenAt` + `completedAt` written
  without ever being shown. The guard is deliberately general ("is anything open?"), because the
  S2b welcome flow needs the same seam to suppress the `/nap` auto-open. `<KalauzSheet>` is also
  keyed on the guide id so a guide swap remounts instead of inheriting the exiting instance's
  `step`.
- **Spec §13.1 resolved (S3a, mezo-gb1s.5): the daypart switch stays on every route** — the code
  is the design now, not the handoff's Nap-only wish. Rationale: since the unified shell header
  (`mezo-atry`) the switch is not a Nap-state display but a **navigation affordance** — from any
  route it jumps to `/nap` at the chosen daypart (`AppHeader.tsx pickFace`), the misleading-state
  risk is already neutralised (`.nap-offnow` is `onNap`-scoped, elsewhere the REAL daypart shows),
  and D10 anchored the "?" to the row's left edge precisely so the switch's presence costs nothing.
  Removing it would add conditional chrome to the one-header contract for no user gain. No guide
  copy asserts Nap-only-ness, so nothing needed rewording; the welcome dropped its header step in
  S2b partly because of this question, and that stays dropped.
- **Open question #2 (spec §13)**: `tutorialSeen.ts`'s localStorage key (`mezo.kalauz.v1`) carries
  no user-id prefix. Fine while the app is single-owner; the multi-user slice must prefix it (or
  two users on one device/browser will share "seen" state).
- **The chrome-free-page mini-"?" shipped in S3a** (D11): `/train/session` is on `AppLayout`'s
  `hideChrome` list, so the header "?" does not exist there — the prep-phase breadcrumb row in
  `ActiveWorkoutPage.tsx` renders its own `.nap-roundbtn.nap-q` (same recipe, same
  `aria-label`) that re-opens the `train-session` guide. Auto-open still covers the first visit:
  entering `/train/session` lands in the `prep` phase unless a workout is already open
  (`initialPhase = open ? 'active' : 'prep'`), so in practice the first-ever visit — the only
  auto-open — happens over the mission briefing, which is what D11 asked for. The active/summary
  phases deliberately render no "?": the guide does not reach over live logging.
- **Spec/shipped drift, carried forward from earlier slices — noted here, not fixed**: the spec's
  architecture diagram (§5) writes the localStorage key as `mezo.kalauz.<userId>`, but the shipped
  key is the unprefixed `mezo.kalauz.v1` (open question #2 above already covers this as a known
  gap, not new). The spec's type table (§8) types the `fogalom` card as
  `{ term: FogalomKey }`, but the shipped `KalauzCard` spreads `{ term, def }` from `fogalom(key)`
  at registry-construction time (§7, item 4) — the spec predates the glossary-spread design that
  S2a actually shipped.
- **Anchors are per-face/per-variant JSX nodes, not a single element**: `nap-hero` sits on all
  four `.nap-hero` nodes in `NapHubPage.tsx` (three daypart faces + the `?day=rough` anchor-mode
  hero, a dev URL-param state outside the guide copy's scope) and `train-hero` sits on all
  six `.eh-hero` variants in `EdzesHubPage.tsx` — a new face/variant on `/nap` or `/train` must
  carry the anchor too, or the spotlight silently degrades to "no anchor" on that face. The S3a
  anchors follow the same idiom where a page varies: `checkin-sor` sits on all three row-state
  variants (done/hot/dim) of the first check-in row, `rutin-lista` on the first habit group in
  either daypart order, and `mai-napsav` travels through `DayStrip`'s optional `kalauzAnchor`
  prop (only `/train/mai` passes it — the hub's own anchor stays `train-hero`). Two S3a guides
  are deliberately anchor-less: `/nap/kuldetesek` (quest cards are data-conditional, an empty
  day is real) and `/train/review/:workoutId` (the whole page is data-gated). The S3b anchors add
  `log-napvalto` (the `/fuel/log` day stepper), `log-forrasok` (the `MealComposer` source tiles —
  shared, so the same node also exists inside the `LogFlowPage` overlay on other routes),
  `receptek-tabs`, and three `PageHero kalauzAnchor` targets (`stack-hero`, `kamra-hero`,
  `naplo-hero`). Two more guides are deliberately anchor-less: `/fuel/plan` (every speaking card —
  weekly note, medication strip, supplement map — is data-conditional) and `/fuel/gyogyszer`
  (the page has two disjoint faces, empty vs. tracked cycle, and is permanently empty in
  practice — see [`fuel.md`](fuel.md) §2 and ADR 0027).
- **The spec's `quickinput` T2 item is deferred to S4, not dropped** (S3b): spec §10 lists a
  "Gyors logolás sheet" guide triggered by the `QuickInputSheet`'s first open, but that is **not a
  route** — the engine's only auto-open trigger is the route effect, so it cannot fire.
  `open(id)` already accepts an arbitrary id, so the missing piece is a component-event seam
  (engine work, not registry content); it rides with S4's engine touch-ups rather than with a
  content batch.
- **Shell tests must seed every guide, not just seen-render one**: any shell test that mounts
  `AppLayout` on a route with a registry hit needs `seedAllKalauzSeen()` (from
  `frontend/src/test/kalauz.ts`) in its `beforeEach`, or the 600 ms auto-open can fire mid-test —
  seeding a single guide by hand is no longer enough now that twenty-seven guides exist.

## 10. Key files

**Frontend — engine & UI**
- `frontend/src/features/tutorial/TutorialProvider.tsx` — the motor: registry lookup, auto-open
  timing, session-guard, write-order, merge.
- `frontend/src/features/tutorial/registry/` — `types.ts` (`KalauzEntry`/`KalauzCard`), `index.ts`
  (`KALAUZ_REGISTRY`, `resolveKalauz`, `findKalauz`, `getKalauz`, `versionOf`).
- `frontend/src/features/tutorial/registry/fogalmak.ts` — canonical Hungarian glossary
  (`FOGALMAK`, `fogalom(key)`), consumed via `...fogalom('<key>')` spread by any `fogalom` card.
- `frontend/src/features/tutorial/registry/fuel.ts` — the Fuel hub guide (`fuel`, anchor
  `fuel-log`) plus the eight S3b T2 guides (`fuel-log`, `fuel-log-uj`, `fuel-terv`, `fuel-stack`,
  `fuel-receptek`, `fuel-kamra`, `fuel-gyogyszer`, `fuel-naplo`).
- `frontend/src/features/tutorial/registry/nap.ts` — the Nap hub guide (`nap`), anchor `nap-hero`.
- `frontend/src/features/tutorial/registry/train.ts` — the Edzés hub guide (`train`), anchor
  `train-hero`.
- `frontend/src/features/tutorial/registry/mezo.ts` — the Mezo hub guide (`mezo`), anchor
  `mezo-chat`.
- `frontend/src/features/tutorial/registry/me.ts` — the Én hub guide (`me`), anchor `me-idhero`.
- `frontend/src/features/tutorial/registry/welcome.ts` — the `T0` welcome (`WELCOME`,
  `WELCOME_ID`, `WELCOME_VERSION`), deliberately outside `KALAUZ_REGISTRY` (§2).
- `frontend/src/features/tutorial/registry/lint.ts` — shared hang-lint primitives (`FORBIDDEN`,
  `countSentences`), used by both `registry.test.ts` and `welcome.test.ts`.
- `frontend/src/shared/ui/kalauz/KalauzSheet.tsx` — the five-card sheet, spotlight peek.
- `frontend/src/shared/ui/kalauz/KalauzWelcome.tsx` — the `T0` full-screen welcome pager (§2).
- `frontend/src/shared/ui/Sheet.tsx` — gained `onBackdropClick`/`backdropClassName` for peek.
- `frontend/src/shared/lib/tutorialSeen.ts` — localStorage mirror + `mergeProgress`.
- `frontend/src/app/AppHeader.tsx` — the "?" button.
- `frontend/src/app/AppLayout.tsx` — `TutorialProvider` mount point.
- `frontend/src/features/me/pages/BeallitasokPage.tsx` — the "Kalauzok újranézése" reset row (§5).
- `frontend/src/features/fuel/pages/FuelMaiPage.tsx` — `data-kalauz-anchor="fuel-log"`.
- `frontend/src/shared/ui/mozaik/index.tsx` — `PageHero`'s optional `kalauzAnchor` prop (§7).
- `frontend/src/features/fuel/pages/{FuelLogPage,FuelRecipesPage,FuelStackPage,FuelKamraPage,FuelNaploPage}.tsx`
  and `components/MealComposer.tsx` — the six S3b anchors (§9).
- `frontend/src/features/today/pages/NapHubPage.tsx` — `data-kalauz-anchor="nap-hero"` × 4
  (one per daypart face).
- `frontend/src/features/train/pages/EdzesHubPage.tsx` — `data-kalauz-anchor="train-hero"` × 6
  (one per hero variant).
- `frontend/src/features/insights/pages/MezoHubPage.tsx` — `data-kalauz-anchor="mezo-chat"`.
- `frontend/src/features/me/pages/EnHubPage.tsx` — `data-kalauz-anchor="me-idhero"`.

**Frontend — data layer**
- `frontend/src/data/tutorial/tutorialProgressApi.ts`, `tutorialProgressHooks.ts` —
  `useTutorialProgress`, `useTutorialProgressActions`, `TUTORIAL_PROGRESS_GHOST`, re-exported from
  `frontend/src/data/hooks.ts`.

**Backend**
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/entity/TutorialProgressEntity.java`,
  `TutorialProgressEntryJson.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/repository/TutorialProgressRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/service/TutorialProgressService.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/tutorial/controller/TutorialProgressController.java`
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-gb1s.1_create_tutorial_progress.sql`

**Contract**
- `api/feature/tutorial/tutorial-progress.yml`

**Tests**
- `frontend/src/test/kalauz.ts` — `buildAllSeenProgress()` (pure data, Node-safe; also consumed
  by `frontend/tests/visual/visual.spec.ts`'s init script; includes the `welcome` key explicitly,
  since it is outside `KALAUZ_REGISTRY`) and `seedAllKalauzSeen()` (writes the localStorage mirror;
  used by shell tests' `beforeEach`).
- `frontend/src/features/tutorial/TutorialProvider.test.tsx`,
  `frontend/src/features/tutorial/registry/registry.test.ts`,
  `frontend/src/features/tutorial/registry/welcome.test.ts`,
  `frontend/src/shared/ui/kalauz/KalauzSheet.test.tsx`,
  `frontend/src/shared/ui/kalauz/KalauzWelcome.test.tsx`,
  `frontend/src/shared/lib/tutorialSeen.test.ts`,
  `frontend/src/data/tutorial/tutorialProgressHooks.test.ts`
- `backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressApiIT.java`,
  `TutorialProgressSwitchOffApiIT.java`

**Docs**
- Spec: `docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`
- Plan: `docs/superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md`
- Prototype: `docs/design_2.0/prototypes/kalauz.html`
