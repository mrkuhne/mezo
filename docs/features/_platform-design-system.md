---
title: Design System & UI Primitives ("Napív")
type: feature-platform
status: done
updated: 2026-07-14
tags: [platform, design, frontend]
key_files:
  - frontend/src/styles/prototype.css
  - frontend/src/index.css
  - frontend/src/shared/ui
  - frontend/src/app
  - frontend/src/shared/lib/theme.ts
  - frontend/src/shared/lib/daypart.ts
  - frontend/src/shared/lib/cn.ts
related: [_platform-data-layer, today, train, me]
---

# Design System & UI Primitives ("Napív") — Feature Documentation

> **One-line:** mezo's mobile-first visual foundation — a single CSS-token vocabulary, ~25 thin React primitives, and an iPhone-frame app shell that every screen renders on. **Status: ✅ done (Phase 1, frontend-only).** It is _platform-level_ (the `_` prefix): it has no route/tab of its own; it lives under `frontend/src/styles/`, `frontend/src/shared/ui/`, and `frontend/src/app/`, and is consumed by all 5 domains (`Today/Train/Fuel/Insights/Me`) — since the **Napív** redesign (`mezo-8141`, 2026-07-13) Insights no longer has its own bottom tab; it's reached via a ✨ link in the Today header.

---

## 1. Summary

**"Napív"** is the visual substrate the whole PWA is painted on — it **supersedes "Deep Current v2"** (the Phase-1 skin) as of **2026-07-13** (`mezo-8141`). It provides:

1. a **token vocabulary** — warm neutrals (`--ink`/`--sub`/`--faint`/`--warm`/`--line`/`--surface`, plus the pre-existing `--canvas`) and six domain accents, three with a deeper variant (`--coral(+deep)` — Train + default action, `--amber` — warm secondary, `--sage(+deep)` — Fuel + success, `--lav(+deep)` — Sleep/Me/Insights, `--rose` — Sport, `--sky` — Futás/water), **Bricolage Grotesque** (display) + **Plus Jakarta Sans** (body) type — **JetBrains Mono is retired from UI copy**, kept only as `--ff-mono` for tabular numerics — 8pt spacing (unchanged), and **pills + 20–28px radii** (`.notch-*` classes redefined to plain `border-radius`, the chamfer clip-path retired) — in `frontend/src/styles/prototype.css` (~1487 lines, incl. the S4 Train + S5 active-workout additions, §3);
2. **~25 React primitives** (`frontend/src/shared/ui/**`), each a thin wrapper over a CSS class; and
3. an **app shell** (`frontend/src/app/**`) — a desktop iPhone-mockup frame carrying a circadian **sky** band, a frosted floating **tab-bar** capsule with a center quick-log FAB, and the bottom-`Sheet` modal idiom.

**Status per layer.** This is a pure **frontend** concern. It has **no backend, no API contract, no DB, no data hook** — it sits _below_ `frontend/src/data/hooks.ts` (the FE↔data boundary) and renders identically whether a view is mock-only (Fuel/Insights/People) or real (Train/biometrics). The only stateful platform piece here is the **theme** (dark/light), persisted in `localStorage`, never in the backend. Nothing here is Phase 2 or Phase 3.

**Driving spec (link, don't duplicate).** The **current** design rationale — the Napív token/font/shape rework, the theme-attribute inversion, the frosted tab bar + quick-log FAB, the circadian atmosphere, and the motion vocabulary — lives in [`docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`](../superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md); the S1+S2 implementation plan is [`docs/superpowers/plans/2026-07-13-napiv-s1-s2-foundation.md`](../superpowers/plans/2026-07-13-napiv-s1-s2-foundation.md). The **historical** ("Deep Current v2") rationale — the retired "visual non-negotiables" (notch corners, tokens-not-`rgba()`, no `dangerouslySetInnerHTML`, pixel-parity) and Slice 0 "Foundation" — lives in [`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md). The Today-domain "anchor mode" skin origin is detailed in [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md); its current shape (a desaturated daypart variant, §2 below) is Napív's replacement for that skin.

---

## 1a. Frontend structure & naming conventions

`frontend/src` is organized in **four layers**, with one uniform template per feature — the map every screen and hook lives on. The **prescriptive house standard** — the rules + recipes to follow when building frontend code — is [`docs/references/frontend_conventions.md`](../references/frontend_conventions.md) (read it before touching `frontend/src`); the rationale is in [ADR 0003](../decisions/0003-frontend-structure-conventions.md), and the reorg is specced in [`2026-07-01-frontend-structure-refactor-design.md`](../superpowers/specs/2026-07-01-frontend-structure-refactor-design.md).

```
src/
├─ app/        shell + routing (AppLayout, PhoneFrame, StatusBar, TabBar, ThemeProvider,
│              providers/, router.tsx) — router.tsx is the single route map
├─ features/   domains — each uses the SAME internal template (below)
├─ shared/     domain-independent, reused: ui/ (~25 primitives) · lib/ (cn,dates,pct,theme,safeMarkdown) · hooks/
└─ data/       the FE↔BE boundary: per-domain hooks + mock + types + REST client
```

**Feature template** (only folders with content appear; `quickinput` has just `sheets/`, `progression` keeps its overlay provider at the feature root):
```
features/<domain>/
├─ pages/        *Section · *Page · *SubNav · tabs.ts · *Skeleton   (the routed layer)
├─ components/   presentational components + small pure view-helpers
├─ sheets/       *Sheet / *Modal bottom-sheets
└─ logic/        pure feature logic / derivations (planner.ts, agenda.ts, buildProtocol.ts…)
```

**Naming taxonomy** — everything routed is either a `*Section` or a `*Page`; the retired `Screen`/`View` duality is gone:

| Suffix / kind | Role | Folder |
|---|---|---|
| `*Section` | tab-root that renders a `SubNav` + `<Outlet>` (`TrainSection`, `FuelSection`, `InsightsSection`, `MeSection`) | `pages/` |
| `*Page` | any routed leaf — an `<Outlet>` child **or** a standalone full-page route (`GymPage`, `TodayPage`, `ActiveWorkoutPage`, `RecipeEditorPage`…) | `pages/` |
| `*Sheet` / `*Modal` | bottom-sheet modal | `sheets/` |
| `*Skeleton` · `*SubNav` · `tabs.ts` | route-adjacent scaffolding | `pages/` |
| `*Card/Panel/Row/Hero/Stat/Bar/Grid/Chip/Cell` | presentational | `components/` |
| pure `.ts` logic / derivations | `planner`, `agenda`, `workoutState`, `weightStats`, `growthJournal`… | `logic/` |

**`data/` layer.** `data/hooks.ts` is a thin re-export **barrel** — the single `@/data/hooks` surface every feature consumes; implementations live in per-domain `data/<domain>/<name>Hooks.ts`. Per-domain folders (`today · fuel · train · me · insights · progression`) hold hooks + mock data + types + the REST `*Api.ts` client. `data/_client/` holds cross-cutting infra (`api`, `api.gen`, `mode`, `flags`, `auth`); the shared core (`types.ts`, `nova.ts`, `pantrySources.ts`, `kindMeta.ts`, `useDualQuery.ts`) stays at `data/` root to avoid a root→domain dependency inversion.

**Import rules.** No barrels except `data/hooks.ts` — imports are **deep** and **absolute** through the `@/*`→`src/*` alias (`@/features/train/pages/GymPage`, `@/shared/ui/Chip`, `@/data/fuel/fuelHooks`). Tests are colocated next to their source.

---

## 2. User-facing behavior

The design system has no "flows" of its own; it provides the chrome and the idioms every flow uses. The user-visible behaviors it owns:

1. **App shell / navigation.** On desktop, the app renders inside a `440×956` iPhone 17 Pro Max mockup — `.phone` → `.phone-screen`, a fake `.dynamic-island`, `.status-bar`, and `.home-indicator` (`PhoneFrame.tsx`, `StatusBar.tsx`). **Since Napiv S5 (`mezo-8141`)** that island isn't always a static mockup — while the active-workout rest Live-Activity is ticking, `DynamicIsland.tsx` swaps in the countdown capsule `.dynamic-island.live` instead (§3, consumed only by Train — [train.md](train.md) §2/§9). On a real narrow viewport or an installed PWA (`@media (max-width: 519px), (display-mode: standalone|fullscreen|minimal-ui)` — `prototype.css:303–335`) the mockup chrome is hidden and the app goes full-bleed, deferring to real `env(safe-area-inset-*)` insets. **Since the Napív redesign (`mezo-8141`):** the bottom `.tab-bar` is a frosted floating capsule (`backdrop-filter: blur(20px) saturate(1.5)` over `color-mix(var(--canvas))`, `@supports not` falls back to a near-opaque tint) holding **4 tabs** — `"Ma" · "Edzés" · "Fuel" · "Én"` — split `LEFT`/`RIGHT` around a center **`.tab-fab`** (`aria-label="Gyors logolás"`, coral→amber gradient circle) that mounts `QuickInputSheet` on click. `Insights` no longer has a bottom tab; it's reached via a ✨ `Icon name="sparkle"` link (`aria-label="Insights"`, `.icon-btn`) in the Today header (`BrandRow.tsx`) — the route and its sub-nav (`InsightsSection`) are unchanged, only the entry point moved. **Circadian sky (`mezo-8141`):** `PhoneFrame` stamps `.phone-screen` with `data-day="reggel|delutan|este"` (`daypartNow()`, re-evaluated every 60s) and paints a masked `.sky` band as its first layer, tinting the canvas warm-gold / neutral / lavender across the day (dimmed in dark theme, muted in AnchorMode) on every screen.
2. **Theme toggle.** `Me → Profil → gear → SettingsSheet` (`frontend/src/features/me/sheets/SettingsSheet.tsx`) flips dark/light via `useTheme().toggle()`. The choice persists to `localStorage`. **Since the Napív redesign (`mezo-8141`) the CSS attribute semantics are inverted from the Phase-1/mezo-sb6z shape:** `:root` (the attribute-absent state) is now the **light** base, and `data-theme="dark"` is the opt-in override — light is both the default _and_ the CSS base, so there's no more split between "default" and "attribute meaning". `applyTheme` sets `data-theme="dark"` for dark / **removes** the attribute for light (`theme.ts:21–26`); `DEFAULT_THEME = 'light'` (`theme.ts:3`). A pre-paint inline script in `index.html` adds `data-theme="dark"` before first paint only when the stored value is exactly `'dark'`; any other/missing value falls through to light with no attribute (no-flash). **Dark-theme guards (`mezo-8141`):** the Napív token block (`prototype.css`, right after its own `:root` block) now carries a `:root[data-theme="dark"]` placeholder override for `--surface`/`--warm`/`--line`/`--ink`/`--sub`/`--faint`/`--np-shadow-card`/`--np-shadow-row` on the legacy navy palette (real Pulse dark values land in S8), and the circadian `.phone-screen[data-day]` background tints (item 1) are guarded back to `var(--canvas)` under `data-theme="dark"` so the light-theme daypart device doesn't override the dark canvas.
3. **Bottom sheets.** Every modal interaction (quick input, check-in, settings, pickers, score detail) slides a `Sheet` up from the bottom, dismissible by backdrop tap, `Escape`, the in-sheet X, or a drag-down on the grab handle.
4. **Ghost / empty states.** In real mode, when a section has no data yet, views render `GhostState` — a faint skeleton + a one-line Hungarian message + an optional CTA (e.g. `"A statisztikáid az első logolt session után jelennek meg."`). This is the **empty** state (query resolved, no data); the **loading** state (query still pending) is the animated skeletons in item 6.
5. **Reorderable lists.** `SortableList` (`@dnd-kit`-backed) gives any list touch/pointer **drag-to-reorder** via a dedicated grip handle plus an always-visible ▲▼ button fallback (a11y/keyboard), labelled `${name} feljebb`/`lejjebb`. Generic over `{ id; label? }[]`, it calls `onReorder(ids)` with the new id order; consumers remap their items to that order. Backs the meso builder/planner exercise reorder (real, was fake in Phase 1) and the active-workout in-session reorder.
6. **Loading skeletons (real mode).** While a view's backing query is still **pending** in real mode, it shows an **animated skeleton** (a light-teal shimmer sweep) shaped like the content it's about to replace, instead of a blank screen or a demo flash. This is the real-mode loading state for the 10 main flash views — Fuel (`Kamra`, `Receptek`), Train (`Mai`, `Gym`, `Sport`, `Gyakorlatok`, `Mesociklusok`), Goals, and the two formerly-blank routes (`GoalPlannerPage`, `ActiveWorkoutPage`). **Mock mode shows no skeleton** — the seed resolves synchronously so the pending window never opens, keeping Playwright parity (see item 6 mechanics in §3). The skeleton primitives (`Skeleton`/`SkeletonText`/`SkeletonCard`/`ScreenSkeleton`) and the `mezo-shimmer` keyframe are documented in §3.
7. **Error states — the third leg of the triad (mezo-ah18.8).** Loading (item 6) / empty (item 4) / **error** now all have a home. **Render errors:** `ErrorBoundary` (`shared/ui/ErrorBoundary.tsx`, class component) is mounted twice — app-level in `main.tsx` (full-page fallback + reload) and tab-level inside `AppLayout` around the `<Outlet/>` with `resetKey={location.pathname}`, so a crashed page degrades to a GhostState-vocabulary card ("Valami elromlott ezen a nézeten." + Újrapróbálom) while the TabBar stays usable and navigating away recovers. **Write errors:** the `QueryClient` in `app/providers/QueryProvider.tsx` carries a `MutationCache.onError` that emits a Hungarian error toast (with a short `exceptionTraceId` prefix when the failure is an `ApiError`) for **every** failed mutation — nothing fails silently; per-mutation `onError` handlers still run on top. **The toast host:** `ToastProvider`/`useToast` (`shared/ui/ToastProvider.tsx`) is mounted once in `AppLayout` and renders the global `.toast` (one at a time, kind-tinted `--error/--success/--brand-primary`, `role="status"`, 3.2s auto-hide); non-React code reaches it through the `shared/lib/toastBus.ts` pub/sub. Purpose-built confirmations (the FuelStackPage protocol card, `PRToast`) deliberately stay feature-local — the host is for generic feedback.

---

## 3. Architecture & data flow

There is **no `view → hook → mock/real → api → backend → db` path for the design system itself** — it sits _below_ the data layer. The relevant internal flows:

```
main.tsx
  └─ QueryProvider
       └─ ThemeProvider            (useState(() => readStoredTheme() ?? DEFAULT_THEME))
            └─ RouterProvider       (router.tsx)
                 └─ AppLayout       (app/AppLayout.tsx)
                      PhoneFrame  (anchor skin ⇐ useTodayScenario().anchorMode)
                        ScreenContent (.screen-content scroller)
                          <Outlet/>   → *Section → *SubNav + nested <Outlet/> → *Page
                        TabBar (4 NavLinks + center FAB → QuickInputSheet)
```

- **Theme cascade.** `ThemeProvider` seeds state from `readStoredTheme() ?? DEFAULT_THEME` (default **light**); a `useEffect` calls `applyTheme(theme)` (sets `data-theme="dark"` for dark / removes the attribute for light — the Napív-inverted semantics, see §2 item 2) and `writeStoredTheme(theme)` (`localStorage['mezo-theme']`). All logic is in `frontend/src/shared/lib/theme.ts` (`THEME_KEY = 'mezo-theme'`, `DEFAULT_THEME = 'light'`). Consumed via `useTheme()` (throws if used outside the provider). `applyTheme` also syncs the browser/PWA chrome color: it rewrites `<meta name="theme-color">` to the per-theme value (`theme.ts:25`, light `#FBF6EF` / dark `#0A0F14`). Three places must stay in sync for the default: the pre-paint script + static `theme-color` meta in `index.html`, `DEFAULT_THEME` here, and the PWA manifest `theme_color`/`background_color` in `frontend/vite.config.ts` (light `#FBF6EF` / `#E6E1D8`).
- **Token cascade.** `:root` now defines the **light (Napív)** base tokens (`prototype.css:3–82`); `:root[data-theme="dark"]` overrides the dark subset (`prototype.css:85–133`). Components reference `var(--…)` only; nothing hardcodes hex except a couple of intentionally-branded data palettes (`data/nova.ts`, `data/pantrySources.ts`). **Theme-invariant exception:** `--text-on-media` / `--text-on-media-dim` (defined once in `:root`, deliberately NOT overridden for dark) label text that overlays the recipe hero/list image-placeholder bands — those bands are hardcoded-dark in _both_ themes, so their overlay text must stay light in both (`RecipeCard.tsx`, `RecipeDetailPage.tsx` hero). Their values mirror the (legacy) dark `--text-primary`/`--text-secondary` tones, keeping dark mode pixel-identical.
- **Elevation & bezel tokens (theme-driven).** Light mode lifts cards off the canvas; dark stays flat. Three tokens carry this, now defined in `:root` (light/Napív) and overridden in the `data-theme="dark"` block: `--card-elevation` (light = a two-layer warm-tinted drop-shadow, dark = `none`), `--card-border` (light `rgba(43,33,24,0.10)`, dark `var(--border-subtle)`), and `--page-glow` (the desktop bezel's radial-gradient center stop — `.app-root` is token-driven in both themes, `prototype.css:169`). `.card` applies both via `border: 1px solid var(--card-border)` + `filter: var(--card-elevation)` (`prototype.css:415–416`). **Why `drop-shadow` (a `filter`), not `box-shadow`:** historically, the notch `clip-path` on `.card.notch-*` clipped a `box-shadow` to the chamfered silhouette (the shadow disappeared), whereas `filter: drop-shadow()` is applied _after_ the clip and traces the notched outline correctly. Napív retired the chamfer clip-path (`.notch-*` is now plain `border-radius`, `prototype.css:136–140`), so this constraint no longer strictly applies — but the `filter`-based elevation tokens were kept as-is through S1+S2 (an S8 cleanup candidate, not a functional issue). Glass surfaces (`PatternCard`, `MacroCells`, `RecipeDetailPage`'s `MacroHeroCell`) use `var(--surface-glass)` rather than a hardcoded white `rgba()` so they read correctly in both themes.
- **Tailwind bridge (build-time, runtime-live).** `frontend/src/index.css` does `@import "tailwindcss"` + `@theme inline { … }`, mapping `--brand-*`, `--surface-*`, `--cat-*`, `--font-*` onto Tailwind tokens. Utilities emit `var(--…)` refs, so `data-theme` flips utilities live with no rebuild.
- **Anchor-mode wiring.** `AppLayout.tsx:12–16` reads `useTodayScenario().anchorMode` and passes `anchor = scenario.anchorMode && location.pathname.startsWith('/today')` into `<PhoneFrame anchor={anchor}>`, which toggles `.phone-screen.anchor`. **Since the AnchorMode Napiv restyle (`mezo-8141`, S3 Task 9) this class no longer swaps a dedicated canvas skin** — it only mutes the daypart `.sky` band (`opacity:.35; filter:saturate(.6)`, `prototype.css:1241`); `AnchorModeView.tsx` themes its own cards directly off the standard Napiv tokens (`--sub`/`--ink`/`--coral-deep`/`--warm`/`--surface`/`--faint`/`--line`) instead of a bespoke palette. This is the one place the shell reaches _up_ into the data layer.

### Loading skeletons (mezo-f2z)

The animated loading state (§2.6) is a small primitive family in `frontend/src/shared/ui/Skeleton.tsx` plus one generic page skeleton, all painted by the `.sk` CSS class and its `mezo-shimmer` keyframe:

- **CSS.** `.sk` is a `var(--surface-2)` block; `.sk::after` is a `translateX(-100%) → translateX(100%)` light-teal gradient running `mezo-shimmer 1.5s infinite` (`prototype.css:678–694`). `@media (prefers-reduced-motion: reduce)` disables the sweep (`.sk::after { display: none }`) — the skeleton stays as a static placeholder.
- **Primitives** (`Skeleton.tsx`): `Skeleton` (one shimmer block, `variant: 'line' | 'block' | 'card' | 'circle' | 'stat'` + `width/height/radius`), `SkeletonText` (a tapering stack of line skeletons), `SkeletonCard` (a `.card.notch-12` wrapper). All carry `aria-hidden` so AT only sees the parent `role="status"` landmark. `ScreenSkeleton` (`ScreenSkeleton.tsx`) composes them into a generic `<div role="status" aria-label="Betöltés…">` page (header line + two cards) for views with no distinctive loadable layout to mirror.
- **The `pending` hook idiom.** Each dual-mode feature hook surfaces a `pending` boolean derived as **`!mock && isPending`** (from the underlying `useQuery`/`useDualQuery`). In **mock** mode `pending` is always `false` — the seed resolves synchronously — so the skeleton never mounts (parity). Examples: `usePantry().pending`, `useRecipes().pending`, `useGoal().pending`, `useTrain().{workoutPending, sportPending, exercisesPending}`.
- **The per-view branch.** A flash view renders its skeleton **before** the empty-state guard: `if (pending) return <XSkeleton/>` (a layout-aware skeleton for the rich views; `<ScreenSkeleton/>` for the two blank-flash routes), each rooted at `role="status"`. Tests assert this dual-mode: real-pending (a never-resolving MSW handler for the backing endpoint) → `findByRole('status')`; mock → real content/redirect, `queryByRole('status')` is null.
- **Mock-safety note (GoalPlannerPage).** `GoalPlannerPage` keys its skeleton off `useBiometricProfile().isLoading` rather than a `!mock`-gated flag. That is still mock-safe **without** an explicit gate, because the hook passes `initialData` in mock mode, so TanStack Query reports `isLoading: false` synchronously (no flash). `ActiveWorkoutPage` uses the already-`!mock`-gated `workoutPending`.

### Napív motion utilities (mezo-8141)

The Napív redesign adds a suite of motion classes — `.np-anim` (staggered rise via `--i`), `.np-press` (spring scale on active), and keyframes `np-rise`, `np-pop`, `np-grow`, `np-draw` — all disabled under `prefers-reduced-motion: reduce` (including a forced `transition: none` on `.sky` and `.phone-screen` to prevent visual flicker on reduced-motion devices). **Gotcha for tests:** `.np-anim` starts at `opacity:0` and jsdom never completes keyframes — component tests for views using these classes must stub `matchMedia` to prefer reduced motion (see `LevelUpScreen.test.tsx` for the pattern).

### Napív S3 Today-domain classes (mezo-8141)

The S3 Today re-composition (Tasks 2–7, 9) added a batch of structural classes to `prototype.css` (~lines 1260–1339) that are **feature-specific to Today**, not shared vocabulary — the same precedent as the active-workout's `.setdots .sd` family in §7 (formerly `.set-dot`, superseded by Napiv S5 — see the S5 subsection below): `.dayarc`/`.arc-base`/`.arc-progress`/`.arc-dot`/`.arc-sun` (+ `.arc-checkin-*`/`.arc-workout`/`.arc-sleep` state fills, `DayArc`'s SVG arc), `.greet`/`.greet-day` (`GreetingHeader`, with `[data-day="…"]`-scoped accent overrides), `.np-hero`/`.np-hero-eyebrow`/`.np-hero-meta` (the `WorkoutTeaser`/`VolleyballCard` hero card, alongside the pre-existing `.np-anim`/`.np-press` motion classes above), `.brief`/`.brief-clamp`/`.brief-more` (the collapsible briefing card's 2-line clamp + `bővebben` toggle), `.secthead-np` (the restyled `Hogy vagy ma?`/`Ma eddig` section headers), `.beats`/`.beat{,.done,.now}` (the heartbeat strip's pill buttons, `.beat.now` pulses via `::after` + `beatpulse`), `.scard` (`QuickStat`'s mini-ring card), and `.growrow` (`GrowthTodayRow`). This section also introduced `.typetag`/`.typetag-{gym,sport,run}` (the pill-shaped hero type tag on `WorkoutTeaser`/`VolleyballCard`), later reused verbatim by the S4 Train hero cards below. Consumption/behavior detail lives in [today.md](today.md) — not duplicated here.

### Napív S4 Train-domain classes (mezo-8141)

The S4 Train slice (Tasks 1–9) added a second batch of structural classes to `prototype.css` (~lines 1341–1411) — this time explicitly **shared-vocabulary-in-waiting**: the pill sub-nav and page-head idiom are built so Fuel/Me can adopt them later, not Train-only. **`.np-pills`/`.np-pill`** — the coral pill sub-nav (`TrainSubNav`); `.np-pill.on` is the active state, tinted via the **`--pill-accent`** custom property (defaults to `var(--coral)`) — Fuel is slated to set `--pill-accent: var(--sage)` and Me `var(--lav)` when they migrate their own sub-navs onto this markup in S6/S7 (§5, §9). **`.pghead-np`/`.pgact-np`** — the page-head row (`.over` eyebrow + `h1`) and its pill action chip, now rendered by every Train page in place of `.page-header` + `Eyebrow`/`PageTitle` (§5 item 3). **`--wash-gym/-sport/-run`** + **`--tag-gym/-sport/-run`** — the coral/rose/sky session-type token pairs (wash = tinted background, tag = the accent text/icon color; only the wash trio gets a `data-theme="dark"` override, tag stays the same hex in both themes), consumed by **`.stag-*`** (the compact type-tag pill on `WeeklyDayRow`'s `.dayrow` session rows) and by the pre-existing **`.typetag-*`** above (`Mai`'s three hero variants). **`.loadrow`/`.loadtile`** (+ `.lic`/`.lic-{gym,sport,run}`/`.lk`/`.lva`) — `Mai`'s weekly-load summary tiles (`LoadTiles.tsx` over the pure `logic/weeklyLoad.ts`). **`.dayrow`** (+ `.d`/`.sess`/`.s`/`.done-chip`/`.log-chip`, `.today`/`.rest` state modifiers) — `WeeklyDayRow`'s restyled day card. **`.trainhero`** (+ `-over`/`.h2row`/`.chips`/`.chip-np`/`.np-ctarow`) — `Mai`'s gym hero card. Consumption/behavior detail lives in [train.md](train.md) — not duplicated here.

**Migration is partial, not domain-wide.** Only `TrainTodayPage`, `GymPage`, `SportPage`, `RunningPage`, `WeeklyDayRow`, `LoadTiles`, and `TrainSubNav` were re-skinned onto the new tokens; `ExercisesPage`/`MesocycleLibraryPage`/`MesocycleBuilderPage`/`MesocyclePlannerPage`/`RunningBlockBuilderPage` only picked up the `.pghead-np` page-head (body content still runs on `--brand-glow`). **Fixed in the final-review wave (`mezo-8141`):** `TrainTodayPage`'s own hero "MA"/"Kész" status chips now use `--tag-sport`/`--tag-run` rather than the pre-S4 `--cat-tendency`/`--info` (see [train.md](train.md) §9). The remaining S8 stragglers still hardcoding those legacy tokens are `SportLogSheet`/`SportScheduleSheet`/`RunLogSheet` (`--cat-tendency`) and `ChallengeCard` (`--cat-tendency`/`--info`). Deeper Builder/Planner restyling and this residual cleanup are S8 candidates, per the S4 plan's out-of-scope note.

### Napív S5 Active-workout classes (mezo-8141)

The S5 slice added the active-workout session's own structural classes to `prototype.css` (~lines 1421–1487). Most are single-screen (Train-only), but the rest Live-Activity island is the one **app-shell** exception (mounted in `PhoneFrame`, not scoped under Train). **`.dynamic-island.live`** (+ `.ring`/`.lt1`/`.lt2`/`.lnext`/`.ln1`/`.ln2`) — the rest-countdown capsule `DynamicIsland.tsx` swaps in for the plain mockup `.dynamic-island` (§2) while a rest is ticking. It is **hardcoded dark in BOTH themes** (`background:#0F0D0B`, no `:root[data-theme="dark"]` override) — the one Napiv surface deliberately exempt from the usual light/dark token pairing rule, since a Live-Activity capsule reads as always-dark on a real device too. And unlike the plain `.dynamic-island` (hidden on a real device/PWA by the full-bleed media query, §2), the **`.live`** variant stays **visible** there (`prototype.css:1443–1448`) — a live rest is app content, not device chrome. **`.wk-top`** (+ `.back`/`.tt`/`.t1`/`.t2`) + **`.exdots`** (`i.don`/`i.cur`/`i.skp` — one dot per exercise) is the session's sticky header. **`.excard`** (+ `.exo`/`h2`/`.prev`) is the single execution card; inside it, **`.setdots`** (`.sd.don`/`.sd.cur`/`.sd.wu` for a pending warmup/`.sd.extra` dashed coral for a pending F2-added extra set) is the set-progress dot row, **`.steprow`**/**`.stepper`** is the giant `SetStepper` ± widget (`features/train/components/SetStepper.tsx`), **`.rirrow`** the RIR/Side pill rows, **`.setnote`** the transient per-set note input, and **`.donebtn`** the `Szett kész ✓` CTA. **`.nextex`** and **`.aistrip`** are presentational rows below the card (upcoming-exercise preview, engine rationale). Consumption/behavior detail lives in [train.md](train.md) §2/§9 — not duplicated here.

**This supersedes the older `.set-dot{,.done,.active,.extra,.warm}` family** (§7's worked example of a feature-specific component-state class, before this slice) — that markup no longer renders anywhere (`ActiveWorkoutPage.tsx` now emits `.setdots .sd` instead), so the CSS rules are **dead/unused**, left in place pending an S8 cleanup pass (train.md §9).

---

## 4. Data model & API

**N/A — frontend-only, no backend surface.** No entities, DTOs, OpenAPI fragments (`api/feature/<x>`), Liquibase changesets, or REST endpoints exist for this feature. The Java/Spring/Liquibase house standards in `docs/references/*.md` do **not** apply here.

The only persisted state is the theme string in `localStorage` under key `mezo-theme` (`THEME_KEY`, `theme.ts:2`), typed `Theme = 'dark' | 'light'`.

The closest things to a "data model" are two typed palette maps consumed by badge primitives (intentionally carrying raw brand hex, exempt from the tokens-only rule):

- `NOVA_META: Record<NovaGroup, { label; desc; color }>` — `frontend/src/data/nova.ts` (NOVA food-processing groups 1–4), consumed by `NovaDot`.
- `pantrySources: Record<PantrySourceKey, { label; color; short }>` — `frontend/src/data/pantrySources.ts` (`kifli.hu` / `myprotein.hu` / `tesco.hu` / `auchan.hu` / `manual`), consumed by `SourceBadge`.

---

## 5. Integrations

The design system is consumed by **every** feature; the seams are the imports from `@/shared/ui/**`, the global `@/styles/prototype.css`, `@/app/ThemeProvider`, and `@/shared/lib/{cn,safeMarkdown,theme}`. The named, bidirectional contracts:

| Seam | Direction & contract |
|---|---|
| **App shell ↔ Today** | `AppLayout.tsx` _consumes_ `useTodayScenario()` (`@/data/hooks`); the crossing type is `TodayScenario.anchorMode: boolean`. When `true` on `/today`, `PhoneFrame` toggles `.phone-screen.anchor` — since Task 9 this only mutes the `.sky` band; the dedicated `--anchor-*` canvas skin was retired (§3, §9). |
| **Shell ↔ QuickInput** | `QuickInputSheet` (`@/features/quickinput/sheets/QuickInputSheet.tsx`) is a `Sheet` consumer mounted by `TabBar`'s center `.tab-fab` (`aria-label="Gyors logolás"`). Since the Napív redesign (`mezo-8141`) it's a 6-tile quick-log grid (Étkezés/Edzés/Víz/Súly/Stack/Check-in) — each tile calls the `Sheet` render-prop `close()` then `navigate()`s to its target route (`/fuel`, `/train`, `/me/weight`, `/fuel/stack`, `/today`); navigation-only in S1, real quick-actions land in later slices. |
| **Theme ↔ Me** | `SettingsSheet.tsx` (Me) _consumes_ `useTheme()` and drives the global `data-theme`. The `Toggle` primitive + `sun`/`moon` `Icon`s are the UI. Crossing type: `Theme = 'dark' \| 'light'`. |
| **Icon set ↔ TabBar / every view** | The `IconName` union (`Icon.tsx:7`) is the contract. `TabBar`'s `LEFT`/`RIGHT` tab arrays map tab ids → `IconName` (`today/train` · `fuel/me` — `TabBar.tsx:6–13`); the center FAB uses `'plus'`. Adding a glyph = extend the `IconName` union **and** add a `case` in `Icon.tsx`. Recent additions: `pencil` + `trash` (edit/delete affordances, for the Train catalog-authoring sheet — `mezo-52zg`). |
| **ToolChip ↔ AI-surfacing views** | `Tool { type: 'read' \| 'compute' \| 'write'; name; args? }` (exported from `ToolChip.tsx`) is the cross-feature type, consumed by Train cross-load, Fuel, and Insights to show the AI's tool calls. Mock today; real in Phase 3. |
| **NovaDot / SourceBadge ↔ Fuel** | _Consume_ `NovaGroup`/`NovaMeta` (`data/nova.ts`) and `PantrySourceKey`/`PantrySourceMeta` (`data/pantrySources.ts`) — the Fuel domain's food-provenance vocabulary. |
| **ScoreRing / MacroRow ↔ Fuel** | `ScoreHero`, `MacroHero`, `RecipeDetailSheet` _consume_ them for meal scores/macros (`{ pct, label }` and `{ macros, per? }`). |
| **RetaPhaseBar ↔ Today/Train** | _Consumes_ a `day` index derived from the retatrutide cycle (mock); colors come from `--reta-d1..d7`. |
| **GhostState ↔ Train (real mode)** | Train is the only domain in real mode today; its views (`SportPage`, `RunningPage`, GYM…) ghost-guard with `GhostState` when the backend is empty. This is the visible seam between the design system and the dual-mode data layer (`isMockMode()`, `@/data/_client/mode`). |
| **App shell ↔ Train (rest Live-Activity, Napiv S5, `mezo-8141`)** | `AppLayout.tsx` mounts `LiveActivityProvider` (wraps `PhoneFrame`) and hides `TabBar` on `/train/session`; `PhoneFrame` mounts `DynamicIsland`, which _consumes_ `useLiveActivityOptional()`. `ActiveWorkoutPage` (Train) is the only feature that ever calls `useLiveActivity().startRest`/`clearRest`. Crossing type: `RestActivity {endsAt, total, next}` — full behavior in [train.md](train.md) §2/§9. |
| **Tailwind ↔ all** | `index.css @theme inline` _exposes_ `bg-surface-1`, `text-brand-glow`, `font-display`, etc. as utilities backed by the same runtime vars, so views can freely mix utilities and `var(--…)` tokens. |

**The on-brand-screen idiom (the most load-bearing integration knowledge).** The canonical reference implementation is `frontend/src/features/train/pages/SportPage.tsx` (and its `--info`-accented twin `RunningPage.tsx`). The shape every domain reuses:

1. **Screen shell** (`*Screen.tsx`) renders a sticky `*SubNav` + nested `<Outlet/>`; it is deliberately _thin_ — each view owns its own header because headers are data-driven.
2. **SubNav** (`*SubNav.tsx`) maps a `*_TABS` array (`tabs.ts`) of `{ id, to, label, end? }` to `NavLink`s with `.subnav-item`/`.active`; sticky `top:0`, `background: var(--canvas)`, active underline `--brand-glow`. Labels stay Hungarian verbatim (`"Mai"`, `"Gym"`, `"Futás"`, `"Gyakorlatok"`, `"Mesociklusok"`). **Since Napiv S4 (`mezo-8141`) Train's `TrainSubNav` no longer follows this shape** — it renders the coral `.np-pills`/`.np-pill` pill nav instead (accent-parametric via `--pill-accent`, §3); `.subnav-item`/`.active` remains current for Fuel/Insights/Me until they migrate too.
3. **Page header** = `.page-header` with `<Eyebrow brand>Train · Sport</Eyebrow>` + `<PageTitle>Röplabda</PageTitle>` on the left and an action `Chip` (e.g. `+ Log`) on the right — historically `SportPage.tsx:67–69`. **Since Napiv S4 (`mezo-8141`) every Train page instead renders the raw `.pghead-np`/`.pgact-np` markup** (§3) in place of `Eyebrow`/`PageTitle`/`Chip`, so `SportPage.tsx` no longer literally matches this step (it is still the reference for steps 4–7 below).
4. **Hero card** = a `.card.notch-12` themed with the feature's **accent token** applied four ways: a `linear-gradient(… color-mix(in srgb, var(--ACCENT) 6%, transparent) → var(--surface-1))` background, a `color-mix(… 30%)` border, a 3px left accent bar, and a radial-glow blob (`SportPage.tsx:92–107`). Inside: feature eyebrow + `<Display size="lg">` + a stat row + an AI explainer (`sparkle` icon + `SafeMarkdown`).
5. **View switcher** = an _intra-view_ segmented control (`.flex-1.notch-4` buttons, `aria-pressed`), active button tinted with `color-mix(var(--ACCENT))` (`SportPage.tsx:166–168`) — distinct from the SubNav's _inter-view_ switch.
6. **Sheets** = `{open && <XSheet onClose={…} onSave={…}/>}` mounted at the view root, each over the `Sheet` primitive.
7. **Ghost-guard** = in real mode, each possibly-empty facet renders `<GhostState message="…magyar…" />` instead of the hero/list.

**Accent-color convention (critical, convention-not-enforced).** Each Train sub-feature picks one token and threads it everywhere via `color-mix`:

- **Gym → `--tag-gym`/`--wash-gym`** (coral) — `GymPage.tsx`, `TrainTodayPage.tsx`'s `.trainhero` (Napiv S4, `mezo-8141`).
- **Sport → `--tag-sport`/`--wash-sport`** (rose) — `SportPage.tsx`. **Superseded by Napiv S4**; the pre-S4 `--cat-tendency` (pink) was cleared off `TrainTodayPage`'s volleyball-hero status chip in the final-review wave (`mezo-8141`) and still lingers only on `SportLogSheet`/`SportScheduleSheet`/`ChallengeCard` (train.md §9).
- **Running / "Futás" → `--tag-run`/`--wash-run`** (sky) — `RunningPage.tsx`. **Superseded by Napiv S4**; the pre-S4 `--info` (blue) was cleared off `TrainTodayPage`'s run-hero status chip in the final-review wave (`mezo-8141`) and still lingers on `RunLogSheet`/`ChallengeCard` and on the un-re-skinned `RunningBlockBuilderPage`/`WeekdayGrid`/`RunWeekEditor`.
- **`--brand-glow`** is the default/AI accent (eyebrows `.brand`, `sparkle` callouts, faint teal card tints) — still current for `Gyakorlatok`/`Mesociklusok`/Builder/Planner body content (train.md §9).

House rule (phase-1 spec): **tokens, not stray `rgba()`** — accents go through `--cat-*` / `--tag-*` / `color-mix`, never a hardcoded pink/blue.

---

## 6. How to use it (consume)

This feature is consumed by import, not by a data hook. Pull primitives from `@/shared/ui/**`, reference colors as `var(--token)` or Tailwind utilities, and join classes with `cn()`:

```tsx
import { NotchCard } from '@/shared/ui/NotchCard'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { Sheet } from '@/shared/ui/Sheet'
import { GhostState } from '@/shared/ui/GhostState'
import { Chip } from '@/shared/ui/Chip'
import { CtaPrimary } from '@/shared/ui/Cta'

function Example({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Train · Sport</Eyebrow>
          <PageTitle>Röplabda</PageTitle>
        </div>
        <Chip variant="brand">+ Log</Chip>
      </div>

      <NotchCard notch={12} accent="tendency">
        <Display size="lg">72</Display>
        <Icon name="sparkle" size={18} />
      </NotchCard>

      {open && (
        <Sheet onClose={onClose} labelledBy="sheet-title">
          {(close) => <CtaPrimary onClick={close}>Mentés</CtaPrimary>}
        </Sheet>
      )}
    </>
  )
}
```

Key shapes: `NotchCard` takes `notch={4|8|12}`, `glass?`, `accent?: 'brand'|'warning'|'error'|'tendency'`. `Sheet` children may be a render-prop `(close) => ReactNode` so in-sheet buttons dismiss with the same slide-down. `Icon` takes `name: IconName`, `size=24`, `color='currentColor'`, `strokeWidth=1.5`. For theme: `const { theme, toggle } = useTheme()` from `@/app/ThemeProvider`.

For XSS-safe inline copy with `**bold**` markers, use `SafeMarkdown` from `@/shared/lib/safeMarkdown` — never `dangerouslySetInnerHTML`.

---

## 7. How to extend it

**Add a UI primitive (recipe):**

1. Create `frontend/src/shared/ui/<Name>.tsx` — a thin component, `cn()` for classes, minimal props, `var(--…)` tokens only (no stray hex/`rgba()`).
2. If it needs new structural CSS, add a class to `frontend/src/styles/prototype.css` (keep the 8pt scale, tabular-nums mono for labels/numbers, Bricolage Grotesque for display, `notch-*` for corners — now pills/rounded radii, not chamfers). A few **feature-specific component-state classes** also live here alongside the shared vocabulary — e.g. the active-workout `.setdots .sd{,.don,.cur,.wu}` dots (`.sd.wu` = the amber pending-warmup marker, `--warning`-tinted, Hypertrophy Drive `mezo-dhdr`) — that's fine for small stateful variants tightly coupled to one screen. **Napiv S5 (`mezo-8141`) superseded the earlier `.set-dot{,.done,.active,.extra,.warm}` family** with this one; the old rules are now dead CSS (§3, train.md §9) — a reminder that this kind of screen-local class is expected to churn as a screen's layout is reworked, unlike the shared vocabulary.
3. If it introduces a color, add it as a `:root` var (the light/Napív base) **and** its `:root[data-theme="dark"]` override — don't hardcode.
4. Add a colocated render test `<Name>.test.tsx` (Vitest + RTL — assert classes/structure/aria; mirror the existing files).
5. (Optional) expose it to Tailwind by adding a `--color-…: var(--…)` line to `index.css @theme inline`.

**Add a glyph:** extend the `IconName` union (`Icon.tsx:7`) **and** add a matching `case` rendering an SVG `<path>` in `Icon.tsx`. If it's a tab icon, also wire it in `TabBar`'s `LEFT`/`RIGHT` arrays.

**Add a new screen (recipe — follow §5's idiom):** new `*Screen.tsx` + `*SubNav.tsx` + `tabs.ts`; register routes in `frontend/src/app/router.tsx`; give each view a `.page-header` (`<Eyebrow brand>` + `<PageTitle>`) + an accent-themed hero `.card.notch-12` + a view switcher + `Sheet`s + `GhostState` ghost-guards. Pick **one** accent token and thread it via `color-mix`.

**References & obligations.** This is frontend-only, so the Java/Spring `docs/references/*.md` do **not** apply. The governing standards are the **phase-1 frontend design spec** ([`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md) — "Visual non-negotiables": notch corners, tokens-not-`rgba`, no `dangerouslySetInnerHTML`, pixel-parity) and the project `CLAUDE.md` frontend conventions: keep **Hungarian UI labels verbatim**, and any view that touches data must remain **dual-mode** and pass tests in **both** modes (mock + real).

---

## 8. Testing

- **Unit / render tests (Vitest + React Testing Library)**, colocated in `frontend/src/shared/ui/*.test.tsx` (12 files): `text.test.tsx` (Eyebrow/LabelMono/Display/PageTitle), `Icon.test.tsx` (svg render, size prop, `BrandGlyph`), `NotchCard.test.tsx` (card/notch/glass/accent-strip), `chips.test.tsx` (Chip variant, ToolChip type/args, ToolChipRow, RefTag), `Sheet.test.tsx` (handle, render-prop close, backdrop/Escape close, no-close-on-inner-click), `cta.test.tsx`, `progressbar.test.tsx`, `QuickStat.test.tsx`, `RetaPhaseBar.test.tsx` (7 segs, active/past), `ScoreRing.test.tsx`, `Toggle.test.tsx`, `fuelPrimitives.test.tsx`. Plus shell tests in `frontend/src/app/{shell,navigation,TabBar,ThemeProvider}.test.tsx` and lib tests in `frontend/src/shared/lib/theme.test.ts` + `frontend/src/shared/lib/safeMarkdown.test.tsx`.
- Tests assert **classes / structure / aria**, not pixels (e.g. `expect(className).toBe('eyebrow brand')`).
- **Pixel-parity retired.** The old-prototype Playwright harness (`frontend/tests/parity/`, `pnpm parity`) — pixel-parity vs the Phase-1 prototype retired 2026-07-13 by the Napív redesign (mezo-8141); visual self-baselines return in S8.

```bash
cd frontend
pnpm test            # vitest (design-system tests are mode-agnostic)
```

**Mode caveat to know:** `isMockMode()` (`frontend/src/data/_client/mode.ts`) defaults to **mock** when `VITE_USE_MOCK` is absent (so tests run with no backend), but `.env`/`.env.example` set `VITE_USE_MOCK=false` (real mode) for `pnpm dev`. Design-system tests are mode-agnostic regardless.

---

## 9. Decisions, gotchas & deferred

- **Tokens-not-`rgba()` & no `dangerouslySetInnerHTML`** are hard house rules from the phase-1 spec; `SafeMarkdown` exists specifically to enforce the latter (React nodes only, escapes everything but `**bold**`).
- **`Sheet` portals to `.phone-screen`, not `<body>`** (`Sheet.tsx:28–30`) — so the backdrop covers the tab bar and `position: absolute` anchors to the device viewport. Falls back to `<body>` in tests. The close animation deliberately kills the entrance keyframe + forces a reflow (`Sheet.tsx:43–65`) to get a real start→end transform delta — a subtle gotcha if refactored. It respects `prefers-reduced-motion`.
- **Light is the default AND the CSS base (Napív, `mezo-8141`) — this inverts the pre-Napív/mezo-sb6z shape.** Before Napív, the _default theme_ was light but the _CSS base_ (`:root`, the attribute-absent state) stayed dark, so light needed `data-theme="light"` added. Napív collapses that split: `:root` **is** the light base now, so light needs **no attribute at all**; dark is the opt-in override, selected by **adding** `data-theme="dark"` (`applyTheme`, `theme.ts:21–26`). **Never add `data-theme="light"`** — there is no such block; light is attribute-absence. (Symmetric to the old rule this replaces, which forbade `data-theme="dark"` for the same reason in the other direction.)
- **The 519px breakpoint** is the desktop-mockup ↔ full-bleed-PWA switch (`prototype.css:303–335`). Scrollbars are globally hidden with `display: none` (not just `width: 0` — required for macOS Safari overlay scrollbars; `prototype.css:156–160`).
- **The `.tab-bar` is a frosted floating capsule again (Napív, `mezo-8141`), superseding the fully-opaque bar from `mezo-ci5`.** The old opaque `var(--canvas)` rule (still physically present earlier in `prototype.css`, undeleted until an S8 cleanup pass) is overridden by a later same-specificity `.tab-bar` rule appended to the Napív CSS section: `background: color-mix(in srgb, var(--canvas) 66%, transparent)` + `backdrop-filter: blur(20px) saturate(1.5)`, with an `@supports not (backdrop-filter: …)` fallback bumping the tint to 96% opaque. This time the translucency is theme-aware (`color-mix` over the live `--canvas` var, not a hardcoded `rgba()`), which is what broke the pre-`mezo-ci5` attempt — light theme leaked. `.screen-content`'s `padding-bottom` grew `96px → 118px` for the floating capsule's clearance (same cascade-override trick, same CSS section).
- **House rule — in-view tab/segment switchers must use `useStickyTab`, not raw `useState`** (`frontend/src/shared/hooks/useStickyTab.ts`, mezo-0h9). Route-based sub-navs (Train/Fuel/Insights/Me) already remember their position via the URL, but a _segment switcher rendered inside one route_ (e.g. Futás's `E heti edzés · Napló · Tervek`) keeps its selection in component state, so navigating into a detail screen and back via breadcrumb remounts the view and snaps it to the default. `useStickyTab(key, fallback)` is a drop-in for `useState` that persists the selection per stable `key` in `sessionStorage`, so breadcrumb-back restores the **last** segment, not the default. Current keys: `train.futas.view`, `train.sport.view`. The global test setup clears `sessionStorage` after each test so the stickiness never leaks between tests.
- **GOTCHA — `--anchor-*` tokens (`--anchor-canvas/-surface/-accent/-text`) are legacy since the AnchorMode Napiv restyle (`mezo-8141`, S3 Task 9).** They remain defined in both `:root` blocks (`prototype.css:59–62`, `:124–127`) but `AnchorModeView.tsx` no longer references them (it now themes off `--sub`/`--ink`/`--coral-deep`/`--warm`/`--surface`/`--faint`/`--line`, and `.phone-screen.anchor` only mutes `.sky`, §3). The only remaining consumers are `VulnerabilityCard.tsx`'s eyebrow color (`var(--anchor-accent)`) and one mock Train color fallback (`data/train/train.ts:534`, `var(--anchor-accent, var(--cat-preference))`). Candidate for full removal in a future cleanup (S8 scope per the S3 plan's out-of-scope note).
- **Accent-via-`color-mix` is a convention, not a primitive.** `NotchCard` only supports `accent: brand/warning/error/tendency`; Sport/Running do their full accent theming with inline `color-mix`, not `NotchCard`. A reusable accent-hero primitive is an obvious-but-deferred refactor.
- **Mock-only AI motifs:** `ToolChip`, the `--cat-*` pattern palette, and the tool-transparency rows render mock data; they become real in **Phase 3** (Spring AI / pgvector / RAG).
- **Browser zoom is disabled app-wide** via the viewport meta (`maximum-scale=1, user-scalable=no`, `index.html:5`). The driving reason is the compact UI: form fields render at 12–13px, so iOS Safari would auto-zoom on focus (it zooms any sub-16px input). This is an accessibility trade-off (WCAG 1.4.4) accepted for the native-app feel; the alternative — forcing every input to ≥16px — would break the dense visual language. Pinch-zoom: fully blocked on Android; iOS ignores `user-scalable=no` for pinch but honors `maximum-scale=1`, which is what suppresses the focus auto-zoom.
- **Deferred:** heavier visual-regression coverage was explicitly deferred in phase 1.

---

## 10. Key files

**Tokens & CSS**
- `frontend/src/styles/prototype.css` — all tokens + every component CSS class (~1487 lines). The `:root` / `:root[data-theme="dark"]` blocks at the top (lines 3–133) carry the **inverted** theme semantics in place (light is now the base, dark the override — Napív, `mezo-8141`); a separate Napív section appended at the end (from its own `:root` token block, same commit) overrides several other earlier rules by cascade order rather than deleting them (`.tab-bar`, `.screen-content`, and — in the same safe-area media block — `.recipe-save-bar`), and adds the circadian `.sky`/`[data-day]` rules and the `.np-*` motion vocabulary; the tail (~lines 1421–1487) is the Napiv S5 active-workout section (rest island + `.wk-top`/`.excard` family, §3).
- `frontend/src/index.css` — Tailwind v4 `@theme inline` bridge.
- `frontend/index.html` — fonts (**Bricolage Grotesque + Plus Jakarta Sans + JetBrains Mono**), `viewport-fit=cover`, static `theme-color` (`#FBF6EF`, light), the **pre-paint theme script** (adds `data-theme="dark"` only when the stored value is exactly `'dark'`; otherwise stays attribute-absent = light), zoom disabled (`maximum-scale=1, user-scalable=no`).
- `frontend/vite.config.ts` — PWA manifest `theme_color`/`background_color` (light `#FBF6EF` / `#E6E1D8`) — keep in sync with `DEFAULT_THEME` + the static meta.

**Primitives** (`frontend/src/shared/ui/`)
- `Icon.tsx` — custom SVG icon set (`IconName`, `BrandGlyph`, `StatusIcons`).
- `Sheet.tsx` — bottom-sheet modal (portal + drag/Escape/backdrop dismiss).
- `GhostState.tsx` — real-mode empty state (query resolved, no data).
- `Skeleton.tsx` — real-mode loading skeletons (`Skeleton`/`SkeletonText`/`SkeletonCard`; `.sk` + `mezo-shimmer`).
- `ScreenSkeleton.tsx` — generic `role="status"` page skeleton for blank-flash views (`GoalPlannerPage`, `ActiveWorkoutPage`).
- `NotchCard.tsx` — rounded-corner card (`notch={4|8|12}` now maps to `border-radius`, not a chamfer — Napív retired the clip-path) + optional accent strip.
- `Eyebrow.tsx` / `LabelMono.tsx` / `PageTitle.tsx` / `Display.tsx` — typography.
- `Cta.tsx` / `Chip.tsx` / `ToolChip.tsx` / `ToolChipRow.tsx` — buttons & chips.
- `ProgressBar.tsx` / `ScoreRing.tsx` / `RetaPhaseBar.tsx` / `Toggle.tsx` — indicators/controls.
- `MacroRow.tsx` / `QuickStat.tsx` / `StatCell.tsx` / `RefTag.tsx` — domain-flavored badges/stats kept shared (multi-feature or domain-free). `NovaDot`/`SourceBadge` were relocated to `frontend/src/features/fuel/components/` — they import `@/data/{nova,pantrySources}` and are used only by Fuel, so they are feature-coupled, not shared primitives.

**App shell** (`frontend/src/app/`)
- `PhoneFrame.tsx` / `StatusBar.tsx` / `ScreenContent.tsx` — iPhone mockup shell.
- `TabBar.tsx` / `AppLayout.tsx` — 4-tab nav + center quick-log FAB + layout (anchor-mode wiring). `TabBar` owns the `quickOpen` state and conditionally mounts `QuickInputSheet` (Napív, `mezo-8141`). `AppLayout` also mounts `LiveActivityProvider` and hides `TabBar` on `/train/session` (Napiv S5, `mezo-8141`).
- `DynamicIsland.tsx` — self-ticking rest-countdown island (`.dynamic-island.live`); mounted in `PhoneFrame`, consumed only by the active workout (Napiv S5, `mezo-8141`).
- `providers/LiveActivityProvider.tsx` — the rest Live-Activity context (`RestActivity`, `startRest`/`clearRest`); mounted once in `AppLayout` (Napiv S5, `mezo-8141`).
- `router.tsx` — route tree (section/subnav/page structure) plus full-screen builder/wizard siblings registered outside the tab tree (e.g. `train/mesocycles/new`, `me/goals/new` → `GoalPlannerPage`).
- `ThemeProvider.tsx` — `useTheme()` context.

**Lib helpers**
- `frontend/src/shared/lib/theme.ts` — theme read/write/apply (`localStorage: mezo-theme`; Napív-inverted attribute semantics, §2 item 2 / §3).
- `frontend/src/shared/lib/daypart.ts` — circadian `Daypart` type (`'reggel' | 'delutan' | 'este'`) + `daypartForHour`/`daypartNow` (bands 4–11 / 12–17 / 18–3), consumed by `PhoneFrame` for the `.sky`/`[data-day]` atmosphere (`mezo-8141`).
- `frontend/src/shared/lib/cn.ts` — class-join helper.
- `frontend/src/shared/lib/safeMarkdown.tsx` — XSS-safe `**bold**` renderer.
- `frontend/src/shared/hooks/useStickyTab.ts` — `useState` drop-in that remembers an in-view switcher's segment across navigation (sessionStorage), so breadcrumb-back restores the last tab, not the default (mezo-0h9).

**Reference implementations of the screen idiom**
- `frontend/src/features/train/pages/{TrainSection,TrainSubNav,tabs}.tsx` — canonical section-idiom shell.
- `frontend/src/features/train/pages/SportPage.tsx` — reference on-brand screen; accent since Napiv S4 (`mezo-8141`) is `--tag-sport`/`--wash-sport` (rose), superseding the pre-S4 `--cat-tendency`.
- `frontend/src/features/train/pages/RunningPage.tsx` — same idiom; accent since Napiv S4 is `--tag-run`/`--wash-run` (sky), superseding the pre-S4 `--info`.
- `frontend/src/features/me/sheets/SettingsSheet.tsx` — theme-toggle UI.

**Palette data**
- `frontend/src/data/nova.ts` / `frontend/src/data/pantrySources.ts` — palette maps for `NovaDot` / `SourceBadge`.

**Tests**
- `frontend/src/shared/ui/*.test.tsx` (12) — render/unit tests.
- `frontend/src/app/{shell,navigation,TabBar,ThemeProvider}.test.tsx` — shell tests.

**Spec (link, don't duplicate)**
- [`docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`](../superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md) — current driving spec (tokens, theme inversion, shell, circadian atmosphere, motion).
- [`docs/superpowers/plans/2026-07-13-napiv-s1-s2-foundation.md`](../superpowers/plans/2026-07-13-napiv-s1-s2-foundation.md) — S1+S2 implementation plan (this slice).
- [`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md) — historical ("Deep Current v2") design rationale + retired visual non-negotiables.
