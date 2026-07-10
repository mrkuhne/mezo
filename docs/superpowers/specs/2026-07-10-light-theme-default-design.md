# Light Theme as Default + Light-Mode Polish (design spec)

- **Date:** 2026-07-10 · **bd:** `mezo-sb6z` · **Domain:** Platform (design system) — frontend only
- **Living doc to update on ship:** [`docs/features/_platform-design-system.md`](../../features/_platform-design-system.md) (theme section) + [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md) if the token list changes
- **Design references (mandatory):** `frontend_conventions.md`
- **UI preview (reviewed & approved):** live-app screenshot comparison Artifact (Train tab, light mode) — current vs. shadow variant A vs. B; **variant A approved** by Daniel.

## 1. Goal

The app currently defaults to the dark theme, which Daniel finds too dark. A complete light
token set **already exists** (`prototype.css` `:root[data-theme="light"]`, toggle in
`SettingsSheet.tsx`) — it is good quality but unloved: the default never exercises it, a few
hardcoded dark styles leak through, and on the light canvas the white cards do not separate
from the background.

This slice makes **light the default theme everywhere** (dark stays a Settings option),
fixes every light-mode leftover, and gives cards a subtle 3D elevation + faint border so the
layout reads clearly on white. Frontend-only; no API/backend change.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Light's role | **Light default + dark stays as toggle** (chosen over light-only and over a light redesign). The existing light palette is approved as-is; only elevation/polish changes. |
| D2 | How to flip the default | **Default-flip in every layer, CSS untouched** (chosen over inverting `:root` to light + `[data-theme="dark"]` override). The `index.html` pre-paint inline script already runs before first paint, so there is no dark flash; inverting the CSS would be a large, risky diff with zero visible benefit. |
| D3 | Card elevation | **Variant A — subtle two-layer shadow + faint border**, light mode only: `filter: drop-shadow(0 1px 2px rgba(10,15,20,0.06)) drop-shadow(0 4px 10px rgba(10,15,20,0.07))`; card border-color `rgba(15,23,35,0.10)`. `drop-shadow` (not `box-shadow`) because the notch clip-path would clip a box-shadow; drop-shadow follows the notched silhouette (verified live). Applied via the `.card` class → every real content box gets it uniformly; chips/tags do NOT. Dark mode keeps `filter: none`. Exact values may be fine-tuned ±20% during the visual audit within the approved direction. |
| D4 | Elevation token shape | New CSS custom properties in `prototype.css`: `--card-elevation` (dark: `none`; light: the drop-shadow pair) and `--card-border` (dark: `var(--border-subtle)`; light: `rgba(15,23,35,0.10)`), consumed by `.card`. Token-level so future themes tune one place. |
| D5 | Stored preference | `localStorage['mezo-theme']` keeps overriding the default (a past explicit choice survives). Only the fallback changes. |
| D6 | PWA chrome | `theme_color`/`background_color` in the Vite PWA manifest flip to light values (`#F4F6F8` / `#DDE2E8`-family); the `<meta name="theme-color">` becomes **dynamic** — `applyTheme()` updates it per theme so the iOS status bar/PWA chrome matches the active theme. |
| D7 | Hardcoded leftovers | The `.app-root` desktop bezel background (hardcoded dark radial gradient) becomes token-driven (`--page-bg`-based, themed both modes). The 6 hardcoded `rgba(255,255,255,…)`/`rgba(0,0,0,…)` glass/stripe spots in components get theme-aware tokens (reuse `--surface-glass` where it fits, else a new `--stripe-glass` token). |

## 3. Scope

**In:**
1. **Default flip (no dark flash):**
   - `index.html` inline script: when nothing (valid) is stored → set `data-theme="light"` immediately.
   - `frontend/src/shared/lib/theme.ts`: fallback `'dark'` → `'light'`; `applyTheme()` also updates `<meta name="theme-color">` (light `#F4F6F8`, dark `#0A0F14`).
   - `frontend/src/app/ThemeProvider.tsx`: initial state fallback `'light'`.
   - `frontend/vite.config.ts` PWA manifest: light `theme_color` + `background_color`.
2. **Card elevation (D3/D4)** in `prototype.css` + light-mode override block.
3. **Leftover fixes (D7):** `.app-root`, `PatternCard.tsx:35`, `RecipeCard.tsx:27`, `MacroCells.tsx:41`, `RecipeDetailPage.tsx:52` + `:122`, `PersonCard.tsx:42`.
4. **Full visual audit in light mode:** walk every route + the main sheets with Playwright, fix any contrast/visibility defect found (small, in-place fixes; anything big files a follow-up bd issue).
5. **Tests + gates:** update `ThemeProvider.test.tsx` / `shared/lib` theme tests asserting the dark default; `pnpm build` + `pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` green.
6. **Docs:** update `_platform-design-system.md` (default theme, elevation tokens); `node scripts/lint-docs.mjs` clean.

**Out:** any light-palette redesign (approved as-is), backend/API changes, removing the dark theme,
per-feature layout changes beyond contrast/visibility fixes.

## 4. Error handling / edge cases

- **First load, empty storage:** pre-paint script sets light → no flash of dark.
- **Stored `dark`:** user keeps dark everywhere (script, provider) — D5.
- **Corrupt stored value:** existing validation treats it as null → light.
- **`filter` stacking context:** `drop-shadow` creates a new stacking context on `.card`; cards contain no `position: fixed` descendants (sheets/toasts portal outside), verified during audit.

## 5. Testing

- Unit: theme.ts default + meta update; ThemeProvider default = light; toggle round-trip unchanged.
- Both test modes green + build green (house gate).
- Visual: Playwright pass over all routes/sheets in light **and** a dark-mode spot-check (regression: dark must look unchanged).

## 6. Milestone note

Roadmap/milestone log entry: "light theme default + card elevation" under the current phase.
