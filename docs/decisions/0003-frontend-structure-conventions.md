# 0003 — Frontend structure & naming conventions

- **Status:** Accepted
- **Date:** 2026-07-01
- **Driver:** mezo-t2x4

## Context

`frontend/src` grew organically across the six Phase-1 vertical slices. A real convention
set already existed — a `@/*`→`src/*` path alias, a central `app/router.tsx`, a
per-feature folder — but it was **implicit and inconsistent**, so the tree read as
disorganized:

- Features kept their sheets and pure logic at the feature root next to route components
  (Train's root held `TrainScreen` + builders + `planner.ts`/`agenda.ts`/`workoutState.ts`);
  some had a `views/` folder, some a flat layout, with no shared internal template.
- `data/` was **69 flat files** — mock data, hooks, types, and tests all in one directory —
  and `data/hooks.ts` was a 180-line god-file mixing inline hook implementations with
  re-exports.
- `lib/` was **32 flat files** mixing REST `*Api.ts` clients with pure utils (`cn`, `dates`,
  `pct`) and hooks (`useReducedMotion`).
- The routed-component vocabulary (`Screen` for a tab root, `View` for a sub-route) was
  undocumented, and there was no stated "page" concept.

The design was validated in
[`docs/superpowers/specs/2026-07-01-frontend-structure-refactor-design.md`](../superpowers/specs/2026-07-01-frontend-structure-refactor-design.md)
and executed per
[`docs/superpowers/plans/2026-07-01-frontend-structure-refactor.md`](../superpowers/plans/2026-07-01-frontend-structure-refactor.md).

Goal: make the existing system **explicit, uniform, and visible** — without changing any
runtime behavior.

## Decision

Reorganize `frontend/src` into **four layers** with one uniform per-feature template and a
stated naming taxonomy. This was a **behavior-preserving reorg** (file moves + symbol
renames + import rewrites); the full test suite in both modes and the build stayed green at
every step, and `pnpm parity` is the visual no-op proof.

- **Four layers.** `app/` (shell + the single `router.tsx` route map) · `features/<domain>/`
  (domains) · `shared/` (`ui/` primitives, `lib/` utils, `hooks/`) · `data/` (the FE↔BE
  boundary).
- **Uniform feature template:** `features/<domain>/{pages,components,sheets,logic}/`. Only
  folders with content appear.
- **Naming taxonomy — everything routed is a `*Section` or a `*Page`.** A tab-root that
  renders a `SubNav` + `<Outlet>` is a `*Section` (`TrainScreen`→`TrainSection`, etc.); any
  routed leaf — an `<Outlet>` child or a standalone full-page route — is a `*Page`
  (`*View`→`*Page`, standalone `*Screen`/builders/planners→`*Page`). `*Sheet`/`*Modal` go in
  `sheets/`; presentational `*Card/*Panel/*Row/…` in `components/`; pure logic/derivations in
  `logic/`. The old `Screen`/`View` duality is retired.
- **`data/` per-domain, with a shared core.** Domain folders (`today · fuel · train · me ·
  insights · progression`) hold hooks + mock + types + the REST `*Api.ts` client.
  `data/_client/` holds cross-cutting infra (`api`, `api.gen`, `mode`, `flags`, `auth`).
  The shared core (`types.ts`, `nova.ts`, `pantrySources.ts`, `kindMeta.ts`,
  `useDualQuery.ts`) stays at `data/` root to avoid a root→domain dependency inversion.
- **`data/hooks.ts` is a thin re-export barrel** — the single `@/data/hooks` surface every
  consumer imports (the documented FE↔data boundary is preserved); implementations live in
  per-domain `data/<domain>/<name>Hooks.ts`.
- **No barrels elsewhere; deep, absolute imports.** Apart from `data/hooks.ts`, there are no
  `index.ts` barrels — imports are deep through the `@/*` alias
  (`@/features/train/pages/GymPage`, `@/shared/ui/Chip`, `@/data/fuel/fuelHooks`). This
  structurally prevents import cycles and keeps tree-shaking predictable.
- **`shared/ui` is domain-free.** Two former `components/ui` primitives with a hard `@/data`
  coupling and single-feature use (`NovaDot`, `SourceBadge`) were relocated to
  `features/fuel/components/`.

## Consequences

- **Positive:** one glance at any feature tells you where its pages, sheets, components, and
  logic live; `data/` and `shared/` are navigable by domain; the "page" vocabulary is
  explicit; the convention is documented (the structure section in
  [`_platform-design-system.md`](../features/_platform-design-system.md)) and enforced by
  habit rather than a linter.
- **Cost:** a large one-time diff (~450 files moved, 38 symbol renames) and a rebase burden
  for any in-flight branch. Mitigated by doing it as one focused, gated pass in an isolated
  worktree.
- **Deferred (follow-ups, not part of this change):** splitting `data/me/goals.ts` into
  `{goals,weight,biometric}.ts`; splitting `biometricsApi.ts` so `checkinApi` lives in
  `data/today/`; verifying/removing the possibly-dead `MacroRow`; migrating domain interfaces
  out of the shared `data/types.ts`.
- **Not adopted:** a top-level route-mirroring `pages/` tree (rejected in favor of
  feature-cohesion — pages live inside each feature); per-feature public `index.ts` barrels
  (rejected for cycle/tree-shaking reasons).

## Addendum (2026-07-15, `mezo-mifi`)

The `pnpm parity` "visual no-op proof" referenced above (Decision + Consequences) was
**retired** with the old-prototype pixel-parity harness during the Napív redesign
(`mezo-8141`, 2026-07-13). Its role is now served by the self-baselined Playwright
visual-regression harness (`frontend/tests/visual/`, `pnpm test:visual`) — see
[`_platform-design-system.md`](../features/_platform-design-system.md) §8. The reorg
decision itself is unchanged; only the named verification command moved.
