# Mezo — Phase 1 Frontend Implementation Design

> **Date:** 2026-06-02
> **Status:** Approved (brainstorming) → next: writing-plans for the Foundation slice
> **Scope:** Phase 1 only (frontend on mock data). Phase 2 (Supabase backend) and
> Phase 3 (AI brain / BMAD) are explicitly out of scope for this cycle.

## Source of truth

This is **not** a product/visual design document. The product and visual design are
**locked** and owned by the design handoff:

- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/` — the developer handoff package.
- `prototype/Mezo Prototype.html` — the **single source of truth for design** (open it
  side-by-side while building).
- `01-design-system.md` (tokens + Tailwind v4 theme + signature motifs), `02-screens.md`
  (screen-by-screen spec), `03-components.md` (component catalog), `04-data-model.md`
  (mock data shapes). `05-backend-supabase.md` is **Phase 2** — do not open yet.

This document captures the **implementation approach** only: how we rebuild that locked
design as a clean, production frontend.

## What Mezo is

A holistic AI performance & health companion app (training periodization, nutrition/fuel
timing, biometrics, and — later — an AI "companion" memory layer). Mobile-first **PWA**,
rendered in an iPhone frame at **440×956**. Dark-first, Hungarian copy, with a signature
visual language (notch corners, accent strips, tool-transparency chips, provenance blocks).

5 bottom-nav tabs: **Today · Train · Fuel · Insights · Me**, plus global overlays
(QuickInputSheet, CheckInSheet, AnchorMode).

## Stack

- **Vite + React + TypeScript** — SPA / PWA shell.
- **Tailwind CSS v4** with the `@theme` token set from `01-design-system.md` (the
  prototype's CSS variables map 1:1 to Tailwind theme tokens).
- **PWA** via `vite-plugin-pwa` (add-to-home-screen now; push for check-in reminders later).
- **Fonts:** Antonio (display), Inter (body), JetBrains Mono (mono/labels/numbers).
- **Routing:** react-router for tabs + sub-views (clean URLs, back button, PWA-friendly);
  local component state for sheets/modals. (The prototype keeps everything in `useState`;
  behavior is identical, URLs are cleaner.)
- **Package manager:** pnpm.

## Project structure (feature-sliced lite)

```
src/
  app/            # app shell, providers (theme), router, tab nav, FAB
  components/ui/  # shared primitives: NotchCard, Chip, ToolChip, Eyebrow, Stepper,
                  #   ProgressBar, CTA, TabBar, Sheet, PhoneFrame, Provenance
  features/
    today/        # each tab is self-contained: components + local state + mock slice
    train/
    fuel/
    insights/
    me/
  data/           # typed mock data (ported from prototype data.js + pantry-data.js),
                  #   shapes per 04-data-model.md
  lib/            # utils: safe-markdown (**bold**) formatter, theme storage, cn()
  styles/         # tailwind entry + @theme tokens + global layer
  icons/          # ported from prototype icons.jsx
```

Rationale: the project is deliberately **feature-rich** and grows feature-by-feature.
Feature folders keep each tab's code cohesive and isolated, with shared primitives in
`components/ui/`. This matches the react19-enterprise Feature-Sliced Design guidance.

## Decomposition into slices (= beads epics)

Phase 1 is large, so it is built as **6 vertical slices**, one at a time, each to
pixel-parity before the next. Each slice is a beads **epic** with child issues per
screen / sheet / component.

| # | Slice (epic) | Contents |
|---|---|---|
| 0 | **Foundation** | scaffold, fonts, Tailwind v4 `@theme` tokens, signature primitives (notch clip-paths, accent strip, chips, tool-chips, cards, CTA, bars), iPhone shell, 5-tab bar + FAB, dark/light theme provider (`data-theme` + `localStorage: mezo-theme`). Everything depends on this. |
| 1 | **Today** | + CheckInSheet, QuickInputSheet, AnchorMode (exercises the most primitives → validates the system) |
| 2 | **Me** | Profil / Cél / Alvás / Tudás + Settings sheet + theme toggle (simplest) |
| 3 | **Fuel** | Mai / Terv / Stash + recipes / pantry |
| 4 | **Insights** | 7 sub-tabs incl. the knowledge graph |
| 5 | **Train** | Mai / GYM / Sport / Mesociklusok + active workout mode + 4-step AI planner (most complex, last) |

Build order follows the handoff (README §4, roadmap §Phase 1): Foundation →
Today → Me → Fuel → Insights → Train.

**Checkpoint after each slice:** parity screenshot review + user sign-off before the next.
Each slice gets its own writing-plans plan → implementation cycle.

## Design fidelity & conventions (non-negotiable)

From the prototype (README §5):

- **Notch corners everywhere** (`notch-4 / notch-8 / notch-12` clip-paths) — the signature
  shape. Never plain rounded rectangles on these surfaces.
- **Left accent strip** (2px glowing vertical bar) marks the active/primary/warning element.
- **Tool-transparency chips** (`read` / `compute` / `write`) and `[ref]` citation tags —
  core brand motif; keep even if stubbed with static data.
- **Provenance pattern** for AI-derived numbers: `baseline → adjustments → result +
  confidence + user override`. Preserve where it appears.
- **Type:** Antonio (condensed uppercase display) + Inter (body) + JetBrains Mono (all-caps
  eyebrows, labels, numbers, chips).
- **Hungarian copy** kept verbatim from the prototype. Nav labels mix EN/HU intentionally.
- **Dark-first** (`--canvas: #0A0F14`); light theme is a complete override set.
- **Minimum touch target 44px.**

Primitives are built **once** in `components/ui/` and reused across features.

The prototype's **Tweaks panel is a design-time authoring tool, NOT a product feature** —
ignore it; the states it toggles (rough/medium/good day, drug-cycle day, niggle,
pattern-confidence, vulnerable tone, anchor mode) become real app state driven by mock data.

## Data flow

Phase 1 is **mock-only** — no database, auth, network, or real persistence (except theme in
`localStorage`). The companion's words are **static mock copy** — displayed, not generated.

- Port `data.js` + `pantry-data.js` into typed modules in `src/data/`, matching the shapes
  in `04-data-model.md`.
- Components read through a typed mock layer exposed via **hooks** (`useToday()`,
  `useFuelDay()`, …). Interactions update local component state (the mock object stands in
  for the server).
- This isolates the data source: the Phase 2 swap to TanStack Query + Supabase touches only
  the hook implementations, not the screens.

## Productionization fixes (applied during porting)

From README §6 — none change the design:

- **No `dangerouslySetInnerHTML`.** Replace the prototype's `**bold**` markdown rendering
  with a tiny safe inline formatter.
- **Tokens, not stray `rgba()`.** Map hardcoded accents to `--cat-*` / `--anchor-*` tokens.
- **Consolidate duplicated cards** (`InsightCard`, `FactorCard`, dimension cards) into
  shared components.
- Hand-rolled SVG charts: reproduce the prototype's visual; the knowledge graph may use a
  real force-graph lib later (the prototype's look is the target).

## Verification & testing

- **Pixel-parity:** Playwright / chrome-devtools MCP. Render both our app and the prototype
  at **440×956**, screenshot each, compare. Every screen is self-verified this way before
  it is called done.
- **Tests (light in Phase 1):** navigation smoke tests (tabs / sub-nav / sheets open & close)
  + a few render tests for the shared primitives. Heavier coverage deferred. Visual-regression
  snapshots introduced later, once screens stabilize.
- **"Done" per slice** (handoff acceptance): dark + light both correct & persisted ·
  notch corners / accent strips / tool-chips / eyebrows / provenance blocks match ·
  pixel-parity at 440×956 · no `dangerouslySetInnerHTML` · tokens used instead of stray `rgba()`.

## Tracking & workflow

- **beads** is the only task tracker: one epic per slice (Foundation + 5 tabs), child issues
  per screen / sheet / component. `bd ready` drives the next task. No markdown TODO lists.
- **Design specs** live in `docs/` (committed); **tasks** live in beads. These do not overlap.
- Checkpoint (parity review + sign-off) after each slice before starting the next.

## Out of scope (this cycle)

- Phase 2: Supabase/Postgres, auth, RLS, real persistence, TanStack Query wiring.
- Phase 3: AI brain — LangGraph agent, Edge Functions, pgvector memory, cron, the Phase-7
  motivation system. This is a separate, fresh BMAD cycle per the roadmap; **BMAD is not
  needed for Phase 1.**

## Next step

writing-plans for **Slice 0 — Foundation** (project scaffold + design system + app shell +
nav + theme), then implement and verify before moving to Today.
