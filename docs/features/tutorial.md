---
title: Mezo-kalauz (in-app page guides)
type: feature
status: mixed
updated: 2026-09-02
tags: [tutorial, onboarding, frontend, backend]
key_files:
  - frontend/src/features/tutorial
  - frontend/src/shared/ui/kalauz
  - frontend/src/shared/lib/tutorialSeen.ts
  - frontend/src/data/tutorial
  - backend/src/main/java/io/mrkuhne/mezo/feature/tutorial
  - api/feature/tutorial/tutorial-progress.yml
related: [today, fuel, _platform-design-system, _platform-data-layer, _platform-auth-security]
---

# Mezo-kalauz — In-App Page Guides

> One-line: per-route onboarding tutorials ("kalauz"), a five-card sheet auto-shown once per route
> tier and reachable any time from the header "?" button. **Status: mixed — backend ✅ done
> (`tutorial_progress` singleton, 3 endpoints), FE ✅ done for the motor (`TutorialProvider`,
> `KalauzSheet`, registry, header "?"), content 🔶 one guide only (`fuel`).**

## 1. Summary

Mezo-kalauz is the in-app guide system: a small, dismissible five-card sheet that walks a user
through what a page is for, tied to the route via a typed **registry** and remembered per-user via
a **seen-store**. The driving design is
[`docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`](../superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md)
(decisions D1–D11, open questions §13); the plan is
[`docs/superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md`](../superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md);
the prototype is [`docs/design_2.0/prototypes/kalauz.html`](../design_2.0/prototypes/kalauz.html).

**This slice (S1, `mezo-gb1s.1`) ships the motor, not the content library**: the seen-store
(backend + FE), the `TutorialProvider` engine (auto-open, session-guard, local-first write,
server-merge), the `KalauzSheet` UI (five card kinds, spotlight peek), the header "?" affordance,
and exactly **one real guide** — `fuel` (T1, the Fuel hub). Everything is real end-to-end for that
one guide: no mock-vs-real split inside the tutorial domain itself, `useTutorialProgress` runs the
same dual-mode data-layer contract every other backed hook does.

Guide **tiers** (`KalauzTier`): `T1`/`T2` auto-open once per route-visit-and-not-yet-seen (after
the page's entrance choreography settles); `T3` never auto-opens — it is reachable only via the
header "?", which then carries the `.nap-offnow` amber dot while unseen. **T0** (a first-launch
welcome flow) and any `T2`/`T3` guides beyond `fuel` are explicitly **out of scope for S1** — next
slices under the same `mezo-gb1s` epic (S2: first launch + hubs).

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
| `DELETE` | `/api/tutorial/progress` | `204`; soft-deletes the live row (`Beállítások · Kalauzok újranézése`) — next `GET` returns the empty ghost again. |

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
- **Fuel** (`frontend/src/features/fuel/pages/FuelMaiPage.tsx`) — the only page seam so far: the
  Logolás hero tile wrapper carries `data-kalauz-anchor="fuel-log"`, the DOM hook the `fuel`
  registry entry's `hogyan` card spotlight peeks at.
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
  against the registry's; `resetAll()` clears both the local mirror and the server row (the
  "Kalauzok újranézése" settings action).
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
2. Wire it into `KALAUZ_REGISTRY` in `frontend/src/features/tutorial/registry/index.ts`.
3. If a `hogyan` card wants a spotlight, add `data-kalauz-anchor="<name>"` to the target DOM
   element on the real page — the spotlight button only renders when the anchor is present, so a
   missing anchor degrades gracefully rather than pointing at nothing.
4. Run the **hang-lint** test (`frontend/src/features/tutorial/registry/registry.test.ts`) — it
   enforces no forbidden words (`kell|muszáj|hiba|elbukik|rossz`), ≤2 sentences per card, ≤25 words
   per `fogalom` definition, unique ids, every route matching a real router route, `version ≥ 1`.

A new guide needs **no backend change** — the `jsonb` map is free-form on the server; the guide id
is only meaningful to the frontend registry. Bump `version` on an existing entry (never rename
`id`) to re-arm the auto-show for users who already saw an older version.

## 8. Testing

- **FE** (Vitest + RTL + MSW, both modes):
  `frontend/src/features/tutorial/TutorialProvider.test.tsx` (auto-open delay, seen-on-open,
  dismissed/completed writes, session-guard, version-bump re-arm, route-change close),
  `frontend/src/shared/ui/kalauz/KalauzSheet.test.tsx`, `frontend/src/shared/lib/tutorialSeen.test.ts`,
  `frontend/src/data/tutorial/tutorialProgressHooks.test.ts`,
  `frontend/src/features/tutorial/registry/registry.test.ts` (hang-lint + route/id checks). Header
  tests that share the `/fuel` route (`frontend/src/app/AppHeader.test.tsx`,
  `frontend/src/app/hubHeaders.test.tsx` or equivalent) seed the fuel guide as already-seen via
  `writeLocalProgress()` before rendering, so the header's own assertions aren't flaked by the
  600 ms auto-open.
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
  script so the header "?" renders deterministically seen/unseen; `fuel-{light,dark}.png` changed
  in this slice purely because of the new "?" button (baseline refresh via the
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
- **Header tests are seed-order-sensitive**: any test that renders `/fuel` and asserts on the
  header's control count/order must seed the fuel guide as seen first, or the 600 ms auto-open
  timer can fire mid-test.
- **Open question #1 (spec §13)**: the daypart switch renders on every route in code, but the
  guide copy for `fuel`'s `kapcsolat` card follows the **design's** Nap-only framing rather than
  the code's every-route reality — a known copy/code mismatch, not a bug, left for a future content
  pass to reconcile.
- **Open question #2 (spec §13)**: `tutorialSeen.ts`'s localStorage key (`mezo.kalauz.v1`) carries
  no user-id prefix. Fine while the app is single-owner; the multi-user slice must prefix it (or
  two users on one device/browser will share "seen" state).
- **Deferred to later `mezo-gb1s` slices**: T0 first-launch welcome flow (S2), any guide beyond
  `fuel` (S2: first launch + hubs), a shared `fogalmak.ts` concept dictionary (deliberately not
  built yet — YAGNI until a second `fogalom` term appears), the chrome-free-page mini-"?" (S3, tied
  to the active-workout guide).

## 10. Key files

**Frontend — engine & UI**
- `frontend/src/features/tutorial/TutorialProvider.tsx` — the motor: registry lookup, auto-open
  timing, session-guard, write-order, merge.
- `frontend/src/features/tutorial/registry/` — `types.ts` (`KalauzEntry`/`KalauzCard`), `fuel.ts`
  (the one shipped guide), `index.ts` (`KALAUZ_REGISTRY`, `findKalauz`, `getKalauz`).
- `frontend/src/shared/ui/kalauz/KalauzSheet.tsx` — the five-card sheet, spotlight peek.
- `frontend/src/shared/ui/Sheet.tsx` — gained `onBackdropClick`/`backdropClassName` for peek.
- `frontend/src/shared/lib/tutorialSeen.ts` — localStorage mirror + `mergeProgress`.
- `frontend/src/app/AppHeader.tsx` — the "?" button.
- `frontend/src/app/AppLayout.tsx` — `TutorialProvider` mount point.
- `frontend/src/features/fuel/pages/FuelMaiPage.tsx` — `data-kalauz-anchor="fuel-log"`.

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
- `frontend/src/features/tutorial/TutorialProvider.test.tsx`,
  `frontend/src/features/tutorial/registry/registry.test.ts`,
  `frontend/src/shared/ui/kalauz/KalauzSheet.test.tsx`,
  `frontend/src/shared/lib/tutorialSeen.test.ts`,
  `frontend/src/data/tutorial/tutorialProgressHooks.test.ts`
- `backend/src/test/java/io/mrkuhne/mezo/feature/tutorial/TutorialProgressApiIT.java`,
  `TutorialProgressSwitchOffApiIT.java`

**Docs**
- Spec: `docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md`
- Plan: `docs/superpowers/plans/2026-09-02-mezo-kalauz-s1-motor.md`
- Prototype: `docs/design_2.0/prototypes/kalauz.html`
