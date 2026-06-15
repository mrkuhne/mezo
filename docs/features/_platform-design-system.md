---
title: Design System & UI Primitives ("Deep Current v2")
type: feature-platform
status: done
updated: 2026-06-14
tags: [platform, design, frontend]
key_files:
  - frontend/src/styles/prototype.css
  - frontend/src/index.css
  - frontend/src/components/ui
  - frontend/src/app
  - frontend/src/lib/theme.ts
  - frontend/src/lib/cn.ts
related: [_platform-data-layer, today, train, me]
---

# Design System & UI Primitives ("Deep Current v2") — Feature Documentation

> **One-line:** mezo's mobile-first visual foundation — a single CSS-token vocabulary, ~25 thin React primitives, and an iPhone-frame app shell that every screen renders on. **Status: ✅ done (Phase 1, frontend-only).** It is _platform-level_ (the `_` prefix): it has no route/tab of its own; it lives under `frontend/src/styles/`, `frontend/src/components/ui/`, and `frontend/src/app/`, and is consumed by all 5 domain tabs (`Today/Train/Fuel/Insights/Me`).

---

## 1. Summary

"Deep Current v2" is the visual substrate the whole PWA is painted on. It provides:

1. a **token vocabulary** — brand teal, canvas/surfaces, the `--cat-*` category palette, Antonio/Inter/JetBrains-Mono type, 8pt spacing, and the signature notch-chamfer clip-paths — in `frontend/src/styles/prototype.css` (809 lines);
2. **~25 React primitives** (`frontend/src/components/ui/**`), each a thin wrapper over a CSS class; and
3. an **app shell** (`frontend/src/app/**`) — a desktop iPhone-mockup frame, a 5-tab bottom bar, a mic FAB, and the bottom-`Sheet` modal idiom.

**Status per layer.** This is a pure **frontend** concern. It has **no backend, no API contract, no DB, no data hook** — it sits _below_ `frontend/src/data/hooks.ts` (the FE↔data boundary) and renders identically whether a view is mock-only (Fuel/Insights/People) or real (Train/biometrics). The only stateful platform piece here is the **theme** (dark/light), persisted in `localStorage`, never in the backend. Nothing here is Phase 2 or Phase 3.

**Driving spec (link, don't duplicate).** The historical design rationale — the "visual non-negotiables" (notch corners, tokens-not-`rgba()`, no `dangerouslySetInnerHTML`, pixel-parity) and Slice 0 "Foundation" — lives in [`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md). The Today-domain "anchor mode" skin is detailed in [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md).

---

## 2. User-facing behavior

The design system has no "flows" of its own; it provides the chrome and the idioms every flow uses. The user-visible behaviors it owns:

1. **App shell / navigation.** On desktop, the app renders inside a `440×956` iPhone 17 Pro Max mockup — `.phone` → `.phone-screen`, a fake `.dynamic-island`, `.status-bar`, and `.home-indicator` (`PhoneFrame.tsx`, `StatusBar.tsx`). On a real narrow viewport or an installed PWA (`@media (max-width: 519px), (display-mode: standalone|fullscreen|minimal-ui)` — `prototype.css:303–335`) the mockup chrome is hidden and the app goes full-bleed, deferring to real `env(safe-area-inset-*)` insets. The bottom `.tab-bar` holds 5 tabs — `"Today" · "Train" · "Fuel" · "Insights" · "Me"` — plus a floating `.fab` mic button (`aria-label="Gyors rögzítés"`).
2. **Theme toggle.** `Me → Profil → gear → SettingsSheet` (`frontend/src/features/me/SettingsSheet.tsx`) flips dark/light via `useTheme().toggle()`. The choice persists to `localStorage` and is applied as `data-theme="light"` on `<html>`. **Dark is the default via _absence_ of the attribute** (`applyTheme` _removes_ it for dark — `theme.ts:16–20`).
3. **Bottom sheets.** Every modal interaction (quick input, check-in, settings, pickers, score detail) slides a `Sheet` up from the bottom, dismissible by backdrop tap, `Escape`, the in-sheet X, or a drag-down on the grab handle.
4. **Ghost / empty states.** In real mode, when a section has no data yet, views render `GhostState` — a faint skeleton + a one-line Hungarian message + an optional CTA (e.g. `"A statisztikáid az első logolt session után jelennek meg."`).

---

## 3. Architecture & data flow

There is **no `view → hook → mock/real → api → backend → db` path for the design system itself** — it sits _below_ the data layer. The relevant internal flows:

```
main.tsx
  └─ QueryProvider
       └─ ThemeProvider            (useState(() => readStoredTheme() ?? 'dark'))
            └─ RouterProvider       (router.tsx)
                 └─ AppLayout       (app/AppLayout.tsx)
                      PhoneFrame  (anchor skin ⇐ useTodayScenario().anchorMode)
                        ScreenContent (.screen-content scroller)
                          <Outlet/>   → *Screen → *SubNav + nested <Outlet/> → *View
                        Fab (mic) → QuickInputSheet
                        TabBar (5 NavLinks)
```

- **Theme cascade.** `ThemeProvider` seeds state from `readStoredTheme()`; a `useEffect` calls `applyTheme(theme)` (sets/removes `data-theme="light"` on `documentElement`) and `writeStoredTheme(theme)` (`localStorage['mezo-theme']`). All logic is in `frontend/src/lib/theme.ts` (`THEME_KEY = 'mezo-theme'`). Consumed via `useTheme()` (throws if used outside the provider).
- **Token cascade.** `:root` defines all vars (dark); `:root[data-theme="light"]` overrides the contrast-sensitive subset (`prototype.css:82–135`). Components reference `var(--…)` only; nothing hardcodes hex except a couple of intentionally-branded data palettes (`data/nova.ts`, `data/pantrySources.ts`).
- **Tailwind bridge (build-time, runtime-live).** `frontend/src/index.css` does `@import "tailwindcss"` + `@theme inline { … }`, mapping `--brand-*`, `--surface-*`, `--cat-*`, `--font-*` onto Tailwind tokens. Utilities emit `var(--…)` refs, so `data-theme` flips utilities live with no rebuild.
- **Anchor-mode wiring.** `AppLayout.tsx:12–16` reads `useTodayScenario().anchorMode` and passes `anchor = scenario.anchorMode && location.pathname.startsWith('/today')` into `<PhoneFrame anchor={anchor}>`, which swaps `.phone-screen.anchor` to the `--anchor-*` token skin (a muted warm alternate for Today's low-energy mode). This is the one place the shell reaches _up_ into the data layer.

---

## 4. Data model & API

**N/A — frontend-only, no backend surface.** No entities, DTOs, OpenAPI fragments (`api/feature/<x>`), Liquibase changesets, or REST endpoints exist for this feature. The Java/Spring/Liquibase house standards in `docs/references/*.md` do **not** apply here.

The only persisted state is the theme string in `localStorage` under key `mezo-theme` (`THEME_KEY`, `theme.ts:2`), typed `Theme = 'dark' | 'light'`.

The closest things to a "data model" are two typed palette maps consumed by badge primitives (intentionally carrying raw brand hex, exempt from the tokens-only rule):

- `NOVA_META: Record<NovaGroup, { label; desc; color }>` — `frontend/src/data/nova.ts` (NOVA food-processing groups 1–4), consumed by `NovaDot`.
- `pantrySources: Record<PantrySourceKey, { label; color; short }>` — `frontend/src/data/pantrySources.ts` (`kifli.hu` / `myprotein.hu` / `tesco.hu` / `auchan.hu` / `manual`), consumed by `SourceBadge`.

---

## 5. Integrations

The design system is consumed by **every** feature; the seams are the imports from `@/components/ui/**`, the global `@/styles/prototype.css`, `@/app/ThemeProvider`, and `@/lib/{cn,safeMarkdown,theme}`. The named, bidirectional contracts:

| Seam | Direction & contract |
|---|---|
| **App shell ↔ Today** | `AppLayout.tsx` _consumes_ `useTodayScenario()` (`@/data/hooks`); the crossing type is `TodayScenario.anchorMode: boolean`. When `true` on `/today`, `PhoneFrame` _exposes_ the `--anchor-*` skin (`.phone-screen.anchor`). |
| **Shell ↔ QuickInput** | `Fab` (mic) → `AppLayout` opens `QuickInputSheet` (`@/features/quickinput`) — a `Sheet` consumer. The contract is just "renders a `Sheet`". |
| **Theme ↔ Me** | `SettingsSheet.tsx` (Me) _consumes_ `useTheme()` and drives the global `data-theme`. The `Toggle` primitive + `sun`/`moon` `Icon`s are the UI. Crossing type: `Theme = 'dark' \| 'light'`. |
| **Icon set ↔ TabBar / every view** | The `IconName` union (`Icon.tsx:7`) is the contract. `TabBar.TABS` maps tab ids → `IconName` (`today/train/fuel/insights/me` — `TabBar.tsx:7–11`). Adding a glyph = extend the `IconName` union **and** add a `case` in `Icon.tsx`. |
| **ToolChip ↔ AI-surfacing views** | `Tool { type: 'read' \| 'compute' \| 'write'; name; args? }` (exported from `ToolChip.tsx`) is the cross-feature type, consumed by Train cross-load, Fuel, and Insights to show the AI's tool calls. Mock today; real in Phase 3. |
| **NovaDot / SourceBadge ↔ Fuel** | _Consume_ `NovaGroup`/`NovaMeta` (`data/nova.ts`) and `PantrySourceKey`/`PantrySourceMeta` (`data/pantrySources.ts`) — the Fuel domain's food-provenance vocabulary. |
| **ScoreRing / MacroRow ↔ Fuel** | `ScoreHero`, `MacroHero`, `RecipeDetailSheet` _consume_ them for meal scores/macros (`{ pct, label }` and `{ macros, per? }`). |
| **RetaPhaseBar ↔ Today/Train** | _Consumes_ a `day` index derived from the retatrutide cycle (mock); colors come from `--reta-d1..d7`. |
| **GhostState ↔ Train (real mode)** | Train is the only domain in real mode today; its views (`SportView`, `RunningView`, GYM…) ghost-guard with `GhostState` when the backend is empty. This is the visible seam between the design system and the dual-mode data layer (`isMockMode()`, `@/lib/mode`). |
| **Tailwind ↔ all** | `index.css @theme inline` _exposes_ `bg-surface-1`, `text-brand-glow`, `font-display`, etc. as utilities backed by the same runtime vars, so views can freely mix utilities and `var(--…)` tokens. |

**The on-brand-screen idiom (the most load-bearing integration knowledge).** The canonical reference implementation is `frontend/src/features/train/views/SportView.tsx` (and its `--info`-accented twin `RunningView.tsx`). The shape every domain reuses:

1. **Screen shell** (`*Screen.tsx`) renders a sticky `*SubNav` + nested `<Outlet/>`; it is deliberately _thin_ — each view owns its own header because headers are data-driven.
2. **SubNav** (`*SubNav.tsx`) maps a `*_TABS` array (`tabs.ts`) of `{ id, to, label, end? }` to `NavLink`s with `.subnav-item`/`.active`; sticky `top:0`, `background: var(--canvas)`, active underline `--brand-glow`. Labels stay Hungarian verbatim (`"Mai"`, `"GYM"`, `"Futás"`, `"Gyakorlatok"`, `"Mesociklusok"`).
3. **Page header** = `.page-header` with `<Eyebrow brand>Train · Sport</Eyebrow>` + `<PageTitle>Röplabda</PageTitle>` on the left and an action `Chip` (e.g. `+ Log`) on the right (`SportView.tsx:67–69`).
4. **Hero card** = a `.card.notch-12` themed with the feature's **accent token** applied four ways: a `linear-gradient(… color-mix(in srgb, var(--ACCENT) 6%, transparent) → var(--surface-1))` background, a `color-mix(… 30%)` border, a 3px left accent bar, and a radial-glow blob (`SportView.tsx:92–107`). Inside: feature eyebrow + `<Display size="lg">` + a stat row + an AI explainer (`sparkle` icon + `SafeMarkdown`).
5. **View switcher** = an _intra-view_ segmented control (`.flex-1.notch-4` buttons, `aria-pressed`), active button tinted with `color-mix(var(--ACCENT))` (`SportView.tsx:166–168`) — distinct from the SubNav's _inter-view_ switch.
6. **Sheets** = `{open && <XSheet onClose={…} onSave={…}/>}` mounted at the view root, each over the `Sheet` primitive.
7. **Ghost-guard** = in real mode, each possibly-empty facet renders `<GhostState message="…magyar…" />` instead of the hero/list.

**Accent-color convention (critical, convention-not-enforced).** Each Train sub-feature picks one token and threads it everywhere via `color-mix`:

- **Sport → `--cat-tendency`** (pink) — `SportView.tsx`.
- **Running / "Futás" → `--info`** (blue) — `RunningView.tsx`.
- **`--brand-glow`** is the default/AI accent (eyebrows `.brand`, `sparkle` callouts, faint teal card tints).

House rule (phase-1 spec): **tokens, not stray `rgba()`** — accents go through `--cat-*` / `--info` / `color-mix`, never a hardcoded pink/blue.

---

## 6. How to use it (consume)

This feature is consumed by import, not by a data hook. Pull primitives from `@/components/ui/**`, reference colors as `var(--token)` or Tailwind utilities, and join classes with `cn()`:

```tsx
import { NotchCard } from '@/components/ui/NotchCard'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { GhostState } from '@/components/ui/GhostState'
import { Chip } from '@/components/ui/Chip'
import { CtaPrimary } from '@/components/ui/Cta'

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

For XSS-safe inline copy with `**bold**` markers, use `SafeMarkdown` from `@/lib/safeMarkdown` — never `dangerouslySetInnerHTML`.

---

## 7. How to extend it

**Add a UI primitive (recipe):**

1. Create `frontend/src/components/ui/<Name>.tsx` — a thin component, `cn()` for classes, minimal props, `var(--…)` tokens only (no stray hex/`rgba()`).
2. If it needs new structural CSS, add a class to `frontend/src/styles/prototype.css` (keep the 8pt scale, mono for labels/numbers, Antonio for display, `notch-*` for corners).
3. If it introduces a color, add it as a `:root` var **and** its `:root[data-theme="light"]` override — don't hardcode.
4. Add a colocated render test `<Name>.test.tsx` (Vitest + RTL — assert classes/structure/aria; mirror the existing files).
5. (Optional) expose it to Tailwind by adding a `--color-…: var(--…)` line to `index.css @theme inline`.

**Add a glyph:** extend the `IconName` union (`Icon.tsx:7`) **and** add a matching `case` rendering an SVG `<path>` in `Icon.tsx`. If it's a tab icon, also wire it in `TabBar.TABS`.

**Add a new screen (recipe — follow §5's idiom):** new `*Screen.tsx` + `*SubNav.tsx` + `tabs.ts`; register routes in `frontend/src/app/router.tsx`; give each view a `.page-header` (`<Eyebrow brand>` + `<PageTitle>`) + an accent-themed hero `.card.notch-12` + a view switcher + `Sheet`s + `GhostState` ghost-guards. Pick **one** accent token and thread it via `color-mix`.

**References & obligations.** This is frontend-only, so the Java/Spring `docs/references/*.md` do **not** apply. The governing standards are the **phase-1 frontend design spec** ([`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md) — "Visual non-negotiables": notch corners, tokens-not-`rgba`, no `dangerouslySetInnerHTML`, pixel-parity) and the project `CLAUDE.md` frontend conventions: keep **Hungarian UI labels verbatim**, and any view that touches data must remain **dual-mode** and pass tests in **both** modes (mock + real).

---

## 8. Testing

- **Unit / render tests (Vitest + React Testing Library)**, colocated in `frontend/src/components/ui/*.test.tsx` (12 files): `text.test.tsx` (Eyebrow/LabelMono/Display/PageTitle), `Icon.test.tsx` (svg render, size prop, `BrandGlyph`), `NotchCard.test.tsx` (card/notch/glass/accent-strip), `chips.test.tsx` (Chip variant, ToolChip type/args, ToolChipRow, RefTag), `Sheet.test.tsx` (handle, render-prop close, backdrop/Escape close, no-close-on-inner-click), `cta.test.tsx`, `progressbar.test.tsx`, `QuickStat.test.tsx`, `RetaPhaseBar.test.tsx` (7 segs, active/past), `ScoreRing.test.tsx`, `Toggle.test.tsx`, `fuelPrimitives.test.tsx`. Plus shell tests in `frontend/src/app/{shell,navigation,TabBar,ThemeProvider}.test.tsx` and lib tests in `frontend/src/lib/theme.test.ts` + `frontend/src/lib/safeMarkdown.test.tsx`.
- Tests assert **classes / structure / aria**, not pixels (e.g. `expect(className).toBe('eyebrow brand')`).
- **Pixel-parity (Playwright)** — `frontend/tests/parity/playwright.config.ts` (viewport `440×956`, scale 2, dev server on `:4317`) renders the app vs. the prototype HTML for visual diffing; this is the design system's true regression net. Run via `pnpm parity`; prototype path via the `MEZO_PROTOTYPE_DIR` env var.

```bash
cd frontend
pnpm test            # vitest (design-system tests are mode-agnostic)
pnpm parity          # playwright pixel-parity vs prototype
```

**Mode caveat to know:** `isMockMode()` (`frontend/src/lib/mode.ts`) defaults to **mock** when `VITE_USE_MOCK` is absent (so tests/parity run with no backend), but `.env`/`.env.example` set `VITE_USE_MOCK=false` (real mode) for `pnpm dev`. Design-system tests are mode-agnostic regardless.

---

## 9. Decisions, gotchas & deferred

- **Tokens-not-`rgba()` & no `dangerouslySetInnerHTML`** are hard house rules from the phase-1 spec; `SafeMarkdown` exists specifically to enforce the latter (React nodes only, escapes everything but `**bold**`).
- **`Sheet` portals to `.phone-screen`, not `<body>`** (`Sheet.tsx:28–30`) — so the backdrop covers the tab bar and `position: absolute` anchors to the device viewport. Falls back to `<body>` in tests. The close animation deliberately kills the entrance keyframe + forces a reflow (`Sheet.tsx:43–65`) to get a real start→end transform delta — a subtle gotcha if refactored. It respects `prefers-reduced-motion`.
- **Dark is default via _absence_ of `data-theme`** (`applyTheme` removes the attribute, `theme.ts:16–20`) — never add `data-theme="dark"`.
- **The 519px breakpoint** is the desktop-mockup ↔ full-bleed-PWA switch (`prototype.css:303–335`). Scrollbars are globally hidden with `display: none` (not just `width: 0` — required for macOS Safari overlay scrollbars; `prototype.css:156–160`).
- **The `.tab-bar` is fully opaque `var(--canvas)`** (`prototype.css:257`), like `.status-bar` and `.sticky-top`. `.screen-content` scrolls _under_ it (`padding-bottom: 96px` gives the clearance), so the bar **must** stay opaque or scrolled content bleeds through. An earlier translucent frosted version (`rgba(10,15,20,0.92)` + `backdrop-filter`) leaked ~8% and — being hardcoded dark — broke in light theme; don't reintroduce a translucent bar without solving both (mezo-ci5).
- **Accent-via-`color-mix` is a convention, not a primitive.** `NotchCard` only supports `accent: brand/warning/error/tendency`; Sport/Running do their full accent theming with inline `color-mix`, not `NotchCard`. A reusable accent-hero primitive is an obvious-but-deferred refactor.
- **Mock-only AI motifs:** `ToolChip`, the `--cat-*` pattern palette, and the tool-transparency rows render mock data; they become real in **Phase 3** (Spring AI / pgvector / RAG).
- **Browser zoom is disabled app-wide** via the viewport meta (`maximum-scale=1, user-scalable=no`, `index.html:5`). The driving reason is the compact UI: form fields render at 12–13px, so iOS Safari would auto-zoom on focus (it zooms any sub-16px input). This is an accessibility trade-off (WCAG 1.4.4) accepted for the native-app feel; the alternative — forcing every input to ≥16px — would break the dense visual language. Pinch-zoom: fully blocked on Android; iOS ignores `user-scalable=no` for pinch but honors `maximum-scale=1`, which is what suppresses the focus auto-zoom.
- **Deferred:** heavier visual-regression coverage was explicitly deferred in phase 1.

---

## 10. Key files

**Tokens & CSS**
- `frontend/src/styles/prototype.css` — all tokens + every component CSS class (809 lines).
- `frontend/src/index.css` — Tailwind v4 `@theme inline` bridge.
- `frontend/index.html` — fonts (Antonio/Inter/JetBrains), `viewport-fit=cover`, `theme-color`, zoom disabled (`maximum-scale=1, user-scalable=no`).

**Primitives** (`frontend/src/components/ui/`)
- `Icon.tsx` — custom SVG icon set (`IconName`, `BrandGlyph`, `StatusIcons`).
- `Sheet.tsx` — bottom-sheet modal (portal + drag/Escape/backdrop dismiss).
- `GhostState.tsx` — real-mode empty state.
- `NotchCard.tsx` — chamfered card + optional accent strip.
- `Eyebrow.tsx` / `LabelMono.tsx` / `PageTitle.tsx` / `Display.tsx` — typography.
- `Cta.tsx` / `Chip.tsx` / `ToolChip.tsx` / `ToolChipRow.tsx` — buttons & chips.
- `ProgressBar.tsx` / `ScoreRing.tsx` / `RetaPhaseBar.tsx` / `Toggle.tsx` — indicators/controls.
- `MacroRow.tsx` / `QuickStat.tsx` / `StatCell.tsx` / `NovaDot.tsx` / `SourceBadge.tsx` / `RefTag.tsx` — domain badges/stats.

**App shell** (`frontend/src/app/`)
- `PhoneFrame.tsx` / `StatusBar.tsx` / `ScreenContent.tsx` — iPhone mockup shell.
- `TabBar.tsx` / `Fab.tsx` / `AppLayout.tsx` — 5-tab nav + mic FAB + layout (anchor-mode wiring).
- `router.tsx` — route tree (screen/subnav/view structure).
- `ThemeProvider.tsx` — `useTheme()` context.

**Lib helpers**
- `frontend/src/lib/theme.ts` — theme read/write/apply (`localStorage: mezo-theme`).
- `frontend/src/lib/cn.ts` — class-join helper.
- `frontend/src/lib/safeMarkdown.tsx` — XSS-safe `**bold**` renderer.

**Reference implementations of the screen idiom**
- `frontend/src/features/train/{TrainScreen,TrainSubNav,tabs}.tsx` — canonical screen-idiom shell.
- `frontend/src/features/train/views/SportView.tsx` — reference on-brand screen (`--cat-tendency` accent).
- `frontend/src/features/train/views/RunningView.tsx` — same idiom, `--info` accent.
- `frontend/src/features/me/SettingsSheet.tsx` — theme-toggle UI.

**Palette data**
- `frontend/src/data/nova.ts` / `frontend/src/data/pantrySources.ts` — palette maps for `NovaDot` / `SourceBadge`.

**Tests**
- `frontend/src/components/ui/*.test.tsx` (12) — render/unit tests.
- `frontend/src/app/{shell,navigation,TabBar,ThemeProvider}.test.tsx` — shell tests.
- `frontend/tests/parity/playwright.config.ts` — pixel-parity harness (`440×956`).

**Spec (link, don't duplicate)**
- [`docs/superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md`](../superpowers/specs/2026-06-02-mezo-phase1-frontend-design.md) — historical design rationale + visual non-negotiables.
