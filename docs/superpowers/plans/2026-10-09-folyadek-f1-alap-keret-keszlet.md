# Folyadék F1 — Alap + keret + készlet · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Folyadék foundation to production in one merge: light lock, tokens and fonts, the shared liquid kit, the Folyadék-jel icon sprite, the new frame (title bar, top tabs, five-drop bottom bar, history back) and the new opening animation — with every not-yet-converted page still working and readable inside it.

**Architecture:** Token-first re-skin in place. The theme lock flips to light; the glass kit block of `prototype.css` is rewritten to a white-card recipe so all 783 `.glass` consumers change at once; the Titanium sprite file is regenerated from the prototype's glyph table with **ids unchanged**. The frame is three new shell components fed by the one nav source (`navModel`) plus a small frame context that pages use to hand their title/back to the shell. New look lives in a new stylesheet `styles/folyadek.css` and a new kit `shared/ui/folyadek/`; old CSS is edited only in the blocks named below.

**Tech Stack:** React 18 + react-router, TypeScript, Vite + vite-plugin-pwa, Vitest + Testing Library, Playwright layout specs (`frontend/tests/layout`), plain CSS (`frontend/src/styles`), Node scripts in `scripts/`.

**Bead:** `mezo-n4wf5.1` (its `--acceptance` holds the *Kész, ha…* list — tick items only with evidence). **Spec:** `docs/superpowers/specs/2026-10-09-folyadek-irany-design.md`. **Bible:** `docs/design_2.0/2026-10-09-folyadek-style-bible.md`. **Approved prototype (the build target, owner OK 2026-10-09):** `docs/design_2.0/prototypes/klinikai-iranyok.html` + `vilagos/{kit,foly,ikon,keret}.js`; owner answers in `vilagos/HANDOFF.md` §"Owner's answers, same day". Serve: `python3 -m http.server 8741 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`.

## Global Constraints

- **Match the prototype exactly**: same order, graphic, copy, states. No redesign. A new idea goes to the owner, never into the build.
- **Light only.** `THEME_LOCK = 'light'`. The two dark pockets that hold a force-claim today (`/ritual`, `/me/sleep/night`) keep it until their slices (F2, F6) — a claim outranks the lock in F1.
- **Behaviour frozen** except: bottom bar = five domains, the domain's pages = top tabs, no domain switcher, header back = history (fixed route only as fallback). No route, hook, API contract, mutation or state machine changes.
- **Every header control of today stays:** kalauz "?", settings, Mezo üzenetei (unread badge → `/nap/uzenetek`), notifications (bell + panel), day orb (→ `/nap/napom/<today>`), plus new: Minden oldal (grid → `/minden` route as today). Quick-log button floats as today; `hideChrome` / `hideFab` / `hideHeader` route lists in `AppLayout.tsx` are unchanged.
- **Icon ids unchanged** (`t-*`, clay `i-*`); component signatures of `Icon3D`, `ClayIcon`, `ContentIcon` unchanged.
- **Domain colours** (bible §3): Nap `#1877F2`/`#19C7C0` · Edzés `#F2683A`/`#F7B23B` · Fuel `#149E6E`/`#8FD14F` · Mezo `#6B4FE0`/`#E06BB5` · Én `#0E94B8`/`#46D3B3`. Ink `#0A2A3C`, sub `#4E6B7A`, faint `#8AA0AC`, page ground `#EEF5F9`.
- **Type:** Bricolage Grotesque 700–800 for titles and numerals (`--ff-display`), Geist for text. Self-hosted (no CDN at runtime).
- **Motion** only inside `@media (prefers-reduced-motion: no-preference)`; the base CSS is the final frame.
- **Guard tests are rewritten in the same commit, never deleted.** Tests asserting the old skin assert the new structure instead.
- **Gates run with** `CI=true`; mock mode = `VITE_USE_MOCK` unset, real mode = `VITE_USE_MOCK=false`. File filters after `--` do not scope the suite. Always absolute paths in Bash; never `cd` to the primary checkout.
- Commit subjects: `feat(ui): folyadék — <what> (mezo-n4wf5.1)`. Work on `feat/folyadek-alap`.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/shared/lib/theme.ts` | lock = light; light theme-colour |
| `frontend/index.html`, `frontend/vite.config.ts` | boot script without the dark lock; light `theme-color` / manifest colours |
| `frontend/public/fonts/bricolage-grotesque-variable-latin{,-ext}.woff2`, `styles/fonts.css` | the display face |
| `frontend/src/styles/folyadek.css` (new, imported after `prototype.css`) | tokens (`--fo-*`), domain scopes, frame chrome, kit primitives, splash |
| `frontend/src/styles/prototype.css` | only: `--ff-display`, the `── uveg kit (` block → light card recipe, the `── uveg chrome` block → deleted (replaced by `folyadek.css`), the two hard-coded `'Fraunces'` display rules |
| `scripts/gen-folyadek-sprite.mjs` (new) + `docs/design_2.0/assets/folyadek-glyphs.json` (new) | glyph table → `shared/ui/clay/titanium-icons.svg` and the clay overrides |
| `frontend/src/shared/ui/folyadek/` (new) | `index.ts`, `Page.tsx` (FrameTitle, Hero, Section, Card, Row), `Liquid.tsx` (Wave, Tank, Vial(s), Mini, Level, Fill, Area, Linked, Stream, PerDay), `Bub.tsx`, `Badge.tsx`, `Drop.tsx`, `frame.tsx` (context + hooks), tests beside each |
| `frontend/src/app/navModel.ts` | + `title` per tab, `frameFor(pathname)` |
| `frontend/src/app/TitleBar.tsx` (new, replaces `AppHeader.tsx`), `TopTabs.tsx` (new), `BottomBar.tsx` (new, replaces `TabBar.tsx`), `DomainSwitcher.tsx` (deleted) | the frame |
| `frontend/src/app/AppLayout.tsx` | mounts the new frame; route lists untouched |
| `frontend/src/shared/ui/mozaik/index.tsx` (`PageHead`) | hands its `onBack` to the frame, renders only its children |
| `frontend/src/app/StartupSplash.tsx/.css`, `startupChoreography.ts` | the vessel + five drops |
| `frontend/src/app/QuickLogFab.tsx` | liquid look, same behaviour |

---

### Task 0: Baseline and markers

**Files:** none changed except CSS comment markers.

- [ ] **Step 1: Fresh install and baseline.** `cd <worktree>/frontend && pnpm install --frozen-lockfile`, then `CI=true pnpm test 2>&1 | tail -5` and `CI=true VITE_USE_MOCK=false pnpm test 2>&1 | tail -5`, `pnpm build`. Record the pass counts in the bead (`bd comments add mezo-n4wf5.1 "baseline: mock N files / M tests, real …"`). If anything is red on a clean tree, stop: a red main outranks this work.
- [ ] **Step 2: Baseline screenshots.** Start the app in mock mode (`verify` skill recipe), and with Playwright capture every tab route of the five domains + `/settings` + `/minden` + one deep page per domain at 390 and 320 px into the scratchpad `before/`. These are the "not broken" reference for Task 3.
- [ ] **Step 3: Plant block markers** in `prototype.css` so parallel builders never touch the same lines: wrap the kit block with `/* ▼▼ F1:KIT */ … /* ▲▲ F1:KIT */` (from the `── uveg kit (` banner at ~13553 to just before `── uveg chrome` at ~13770) and the chrome block with `/* ▼▼ F1:CHROME */ … /* ▲▲ F1:CHROME */` (~13770 to just before `── uveg fuel konyha` at ~13965). Commit: `chore(ui): folyadék — F1 block markers (mezo-n4wf5.1)`.

### Task 1: Light lock, tokens, fonts

**Files:** Modify `shared/lib/theme.ts`, `app/ThemeProvider.tsx`, `frontend/index.html`, `frontend/vite.config.ts`, `styles/fonts.css`, `styles/prototype.css:163,1546,5438`, `main.tsx` (import). Create `styles/folyadek.css`, two font files. Tests: `ThemeProvider.test.tsx`, `CircadianTheme.test.tsx`, `forceTheme.napRitual.test.tsx`, `pwaStatusBar.test.ts`, `AppLayout.lightFirst.test.tsx`, `styles/tokens.test.tsx`, `mozaikCssTokens.test.ts`.

**Produces:** `THEME_LOCK: 'light'`; CSS tokens `--fo-ink --fo-sub --fo-faint --fo-page --fo-card --dom --dom2 --liq1 --liq2`, set per domain on `.phone-screen[data-domain="nap|train|fuel|mezo|me"]`.

- [ ] **Step 1: Failing tests.** In `ThemeProvider.test.tsx` replace the dark-lock cases with:

```tsx
it('resolves light under the app lock whatever is stored', () => {
  localStorage.setItem(THEME_KEY, 'dark')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
})
it('a force claim still wins over the lock (the two dark pockets until F2/F6)', () => {
  render(<ThemeProvider><Claim theme="dark" /></ThemeProvider>)
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})
```
In `pwaStatusBar.test.ts` expect `theme-color` `#EEF5F9` in `index.html` and `theme_color` / `background_color` `#EEF5F9` in `vite.config.ts`. Run `CI=true pnpm test` → these fail.
- [ ] **Step 2: Implement the lock.** `theme.ts`: `export const THEME_LOCK: Theme | null = 'light'`, `THEME_COLOR = { light: '#EEF5F9', dark: '#141210' }`, rewrite the doc comment (Folyadék light lock, bible §1.1; a force claim outranks it in F1). `ThemeProvider.tsx`: `const theme: Theme = claims.length > 0 ? claims[claims.length - 1].theme : (lock ?? resolved)`. `index.html`: `<meta name="theme-color" content="#EEF5F9" />`, delete the boot script's lock (`var locked = true` and the `setAttribute` line — the boot never sets `data-theme`), `apple-mobile-web-app-status-bar-style` → `default`. `vite.config.ts`: both colours `#EEF5F9`, comment updated.
- [ ] **Step 3: Fonts.** Download Bricolage Grotesque variable (opsz 12–96, wght 200–800) latin and latin-ext woff2 from the Google Fonts CSS2 response (`curl -A "Mozilla/5.0 … Chrome/120" "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"`, take the two `latin` / `latin-ext` URLs) into `frontend/public/fonts/`. Add two `@font-face` blocks to `fonts.css` copying the Geist blocks' shape (`font-weight: 200 800; font-display: swap;` and the same `unicode-range`s). `prototype.css:163` → `--ff-display: 'Bricolage Grotesque', 'Geist', system-ui, sans-serif;`. Add an ADR note `docs/adr/` superseding ADR 0018 D2 (one paragraph: Bricolage returns as the display face, owner decision 2026-10-09).
- [ ] **Step 4: `styles/folyadek.css`** — create with the token block and import it in `main.tsx` right after `prototype.css`:

```css
/* ── folyadék tokens (mezo-n4wf5.1) ── bible §3 */
:root {
  --fo-ink: #0A2A3C; --fo-sub: #4E6B7A; --fo-faint: #8AA0AC; --fo-page: #EEF5F9; --fo-card: #fff;
  --fo-ok: #1E9E6A; --fo-warn: #C98A12; --fo-bad: #D4483B;
  --dom: #1877F2; --dom2: #19C7C0; --liq1: var(--dom2); --liq2: var(--dom);
  /* the old ramps the unconverted pages read, re-pointed to the cool light world */
  --surface-page: var(--fo-page); --text-primary: var(--fo-ink); --text-secondary: var(--fo-sub); --text-muted: var(--fo-faint);
}
.phone-screen[data-domain="train"] { --dom: #F2683A; --dom2: #F7B23B; }
.phone-screen[data-domain="fuel"]  { --dom: #149E6E; --dom2: #8FD14F; }
.phone-screen[data-domain="mezo"]  { --dom: #6B4FE0; --dom2: #E06BB5; }
.phone-screen[data-domain="me"]    { --dom: #0E94B8; --dom2: #46D3B3; }
.phone-screen { background: linear-gradient(180deg, color-mix(in srgb, var(--dom) 5%, #FBFDFE), color-mix(in srgb, var(--dom) 12%, #EAF2F6)); }
```
`PhoneFrame.tsx` gets `data-domain={activeDomainId(pathname) ?? 'nap'}` on `.phone-screen`. `styles/tokens.test.tsx`: assert these tokens exist on bare `:root`. `mozaikCssTokens.test.ts`: drop the "every token has a dark value" requirement, keep "every `--mz-*` used is defined".
- [ ] **Step 5:** `CI=true pnpm test` (both modes) green for the files above; commit.

### Task 2: The Folyadék-jel sprite

**Files:** Create `docs/design_2.0/assets/folyadek-glyphs.json`, `scripts/gen-folyadek-sprite.mjs`. Regenerate `shared/ui/clay/titanium-icons.svg`; modify `shared/ui/clay/clay-icons.svg` (override list), `titaniumSpriteSource.test.ts`, `Icon3D.test.tsx`, `styles/folyadek.css`. Delete `scripts/gen-titanium-sprite.mjs` (its source prototype stays in git history).

**Produces:** every `t-<k>` symbol id that exists today, drawn as a glyph; colours from `--ic` (line, default `--dom`), `--ic2` (liquid, default `--dom2`), `--icf` (body tint).

- [ ] **Step 1: Export the glyph table.** Open the served prototype and dump it — the table is the source of truth, do not retype paths:

Write this as `dump-glyphs.mjs` in the scratchpad (import `chromium` and `fs` at the top: `import { chromium } from '<worktree>/frontend/node_modules/@playwright/test/index.mjs'; import fs from 'node:fs'`) and run it with `node` from the worktree root:

```js
// scratch: dump-glyphs.mjs — ikon.js keeps GLY private, so read the built symbols back
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8741/klinikai-iranyok.html#w-nap-ikonok'); await p.waitForTimeout(800);
const out = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('symbol[id^="tc-"]')].map(s => [s.id.slice(3), s.innerHTML])));
fs.writeFileSync('docs/design_2.0/assets/folyadek-glyphs.json', JSON.stringify(out, null, 1)); await b.close();
```
Expect 150 keys. Also copy the two clip paths `tc-lv` and `tc-hx` (`ikon.js` `defs.innerHTML`).
- [ ] **Step 2: Failing test** — rewrite `titaniumSpriteSource.test.ts`:

```ts
const ids = [...sprite.matchAll(/<symbol id="(t-[^"]+)"/g)].map((m) => m[1])
it('keeps every icon id the app used before the swap', () => { for (const id of BEFORE_IDS) expect(ids).toContain(id) })
it('draws glyphs, not Titanium art', () => { expect(sprite).not.toMatch(/tg-titanium|feDropShadow/); expect(sprite).toContain('var(--ic,var(--dom))') })
it('every Icon3DName in clay/index.tsx has a symbol', () => { for (const n of ICON3D_NAMES) expect(ids).toContain(n) })
```
`BEFORE_IDS` = the 134 ids of the current file, pasted as a literal array (take them with `grep -o 'symbol id="t-[^"]*"'` before regenerating). `ICON3D_NAMES` is parsed from the `Icon3DName` union in `clay/index.tsx` by regex.
- [ ] **Step 3: Generator.**

```js
#!/usr/bin/env node
// Builds the Folyadék-jel sprite (bible §5, mezo-n4wf5.1) from docs/design_2.0/assets/folyadek-glyphs.json.
// Ids stay t-<name>, so every Icon3D / ContentIcon consumer switches at once.
import { readFileSync, writeFileSync } from 'node:fs'
const gly = JSON.parse(readFileSync('docs/design_2.0/assets/folyadek-glyphs.json', 'utf8'))
const defs = '<defs><clipPath id="tc-lv"><path d="M-2 37Q6 32 14 37T30 37T46 37T66 37V70H-2Z"/></clipPath><clipPath id="tc-hx"><path d="M0 0H32V64H0Z"/></clipPath></defs>'
const syms = Object.entries(gly).map(([k, inner]) => `<symbol id="t-${k}" viewBox="0 0 64 64">${inner}</symbol>`).join('\n')
writeFileSync('frontend/src/shared/ui/clay/titanium-icons.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\n${defs}\n${syms}\n</svg>\n`)
console.log(Object.keys(gly).length, 'glyphs')
```
Run it. If the test names an id with no glyph, draw it in the bible §5 recipe **in the prototype's `ikon.js`**, add it to the `#w-nap-ikonok` sheet, re-dump — and list it in the final report (an icon the owner has not seen).
- [ ] **Step 4: Clay icons used in chrome and fallbacks.** For every clay id that `CLAY_TO_3D` (clay/index.tsx:161-196) or `ikon.js` `CMAP` maps to a glyph, replace that `<symbol id="i-…">` body in `clay-icons.svg` with `<use href="#t-<glyph>"/>` at `viewBox="0 0 64 64"`. Unmapped clay ids: list them (`grep -o 'name="i-[a-z-]*"' -r frontend/src | sort -u` minus the mapped set); for each still rendered, map it to the nearest existing glyph **only if the meaning is identical**, otherwise draw it (as in Step 3).
- [ ] **Step 5: CSS** in `folyadek.css`:

```css
.t-ico { --ic: var(--c, var(--dom)); --ic2: color-mix(in srgb, var(--c, var(--dom2)) 55%, #fff); filter: none; }
.fo-on-liquid .t-ico, .fo-on-liquid svg { --ic: #fff; --ic2: rgba(255,255,255,.4); --icf: transparent; }
```
Where a surface sets `--c` (the old per-card accent) the glyph follows it; elsewhere the domain colours.
- [ ] **Step 6:** tests green both modes; open three old pages in the browser and confirm no empty icon boxes (`document.querySelectorAll('use')` whose `href` target is missing = 0); commit.

### Task 3: The glass kit becomes a light card (unconverted pages stay readable)

**Files:** `prototype.css` between the `F1:KIT` markers; `shared/ui/mozaik/prototypeCssStructure.test.ts`, `shared/ui/sheetGlassGuard.test.ts`.

- [ ] **Step 1: Rewrite the recipes inside the markers** (class names unchanged — 361 files use them):

```css
.glass { --c: var(--dom); position: relative; isolation: isolate; overflow: hidden; border-radius: 26px;
  background: #fff; color: var(--fo-ink);
  box-shadow: 0 14px 26px -18px color-mix(in srgb, var(--c) 45%, rgba(10,42,60,.55)), 0 2px 4px -2px rgba(10,42,60,.06); }
.glass::before { content: none; }
.glass::after { content: ''; position: absolute; opacity: 0; pointer-events: none; }  /* geometry kept for feature overlays */
.glass > * { position: relative; z-index: 1; }
.glass.is-round { overflow: visible; border-radius: 50%; box-shadow: 0 6px 14px -8px rgba(10,42,60,.4); }
.uv-flat { background: color-mix(in srgb, var(--c, var(--dom)) 7%, #fff); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c, var(--dom)) 14%, #fff); }
.uv-empty { border: 1.5px dashed color-mix(in srgb, var(--c, var(--dom)) 40%, transparent); background: transparent; box-shadow: none; }
.uv-well { background: color-mix(in srgb, var(--c, var(--dom)) 8%, #fff); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c, var(--dom)) 16%, #fff); }
.uv-aurora { display: none; }
.uv-halo { background: none; }
```
Keep `.uv-ring-*`, `.uv-bar`, `.uv-eyebrow`, `.uv-voice`, `.uv-tint` selectors; change only literal light-on-dark colours inside them to `var(--fo-ink)` / `var(--fo-sub)` and track colours to `rgba(10,42,60,.08)`. Remove the `:root[data-theme="dark"]` macro override at the top of the block (macros keep their light values).
- [ ] **Step 2: Readability sweep.** Re-shoot the Task 0 route list at 390 px. A scratch Playwright script flags, per route, every text node whose colour luminance > .72 on a background lighter than .5 (the same test as `dressFrame` in `vilagos/keret.js` — copy its `lum` / `onDark` functions). For each hit find the rule in `prototype.css` and replace the literal with the matching token (`var(--fo-ink)`, `var(--fo-sub)`, `var(--c)`); dark wells smaller than 170 px get `background: #fff` + `inset 0 0 0 1.5px rgba(10,42,60,.1)`. **Do not restyle layouts** — the target is "readable, nothing broken", as approved on `#w-<d>-atmenet`. Loop until the script reports zero hits on every route in the list; then repeat at 320 px for overflow only.
- [ ] **Step 3: Guards.** `prototypeCssStructure.test.ts`: replace the cases that pin the dark glass body / gradient frame / aurora with: `.glass` has `background: #fff`, no `backdrop-filter`, `::before` has no content; `.uv-aurora` is `display: none`; the `F1:KIT` markers exist. `sheetGlassGuard.test.ts` keeps its rule (every `<Sheet>` wears `.glass`) unchanged.
- [ ] **Step 4:** both test modes green, `pnpm build`; commit.

### Task 4: The shared kit `shared/ui/folyadek`

**Files:** Create the kit files listed in *File Structure* + CSS in `folyadek.css` (`── folyadék kit ──` block). Source for every recipe: `vilagos/foly.js` (CSS and markup of `wave tank vial vials mini level fill area stream linked bub`), `vilagos/kit.js` (`hero sec card row badge`), `vilagos/koncepciok.js` (`.k2-*` tank / vial / stream CSS), `vilagos/mezo.js` (`perday`, `chain`). Port the CSS verbatim, renaming the scope `.phone.foly[data-s="elo"] .fh-*` / `.k2-*` / `.fl-*` → `.fo-*`, and `--ink/--sub` → `--fo-ink/--fo-sub`.

**Produces (exact exports of `shared/ui/folyadek/index.ts`):**

```ts
export function Hero(p: { label?: string; verdict: ReactNode; sub?: ReactNode; warn?: boolean; children?: ReactNode; actions?: ReactNode }): JSX.Element
export function Section(p: { n?: number; title: string; link?: ReactNode }): JSX.Element   // the drop-badge heading
export function Card(p: { className?: string; children: ReactNode }): JSX.Element
export function Row(p: { icon?: Icon3DName; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; onClick?: () => void }): JSX.Element
export function Wave(p: { color?: string; opacity?: number; className?: string }): JSX.Element
export function Tank(p: { pct: number; num: ReactNode; cap?: string; label?: string; verdict?: ReactNode; marks?: number[]; cta?: string; onCta?: () => void }): JSX.Element
export function Vials(p: { items: VialItem[]; height?: number }): JSX.Element
export interface VialItem { label: string; value: ReactNode; pct: number; color?: string; icon?: Icon3DName; mark?: ReactNode; note?: string; onClick?: () => void }
export function Mini(p: { pct: number; color?: string; icon?: Icon3DName; value?: ReactNode; label?: string }): JSX.Element
export function Level(p: { pct: number; color?: string; height?: number; value?: string; label?: string }): JSX.Element
export function Fill(p: { d: string; viewBox?: string; pct: number; size?: number; color?: string; color2?: string; children?: ReactNode }): JSX.Element
export function Area(p: { values: number[]; dots?: (number | null)[]; target?: number; labels?: string[]; width?: number; height?: number }): JSX.Element
export function Linked(p: { a: number; b: number; labelA: string; labelB: string; valueA?: string; valueB?: string }): JSX.Element
export function Stream(p: { items: { time: string; title: string; sub?: string; right?: ReactNode; now?: boolean; onClick?: () => void }[] }): JSX.Element
export function PerDay(p: { days: { label: string; pct: number; group: 'a' | 'b'; against?: boolean }[] }): JSX.Element
export function Bub(p: { icon: Icon3DName; size?: number; color?: string }): JSX.Element
export function Badge(p: { member: 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo' | 'szk'; size?: number; pct?: number; value?: ReactNode; label?: string }): JSX.Element
export function Drop(p: { pct: number; color: string; size?: number; alive?: boolean }): JSX.Element   // the five domain drops
export { FrameProvider, useFrame, useFrameTitle, useFrameBack } from './frame'
```

- [ ] **Step 1: Tests first**, one file per component file. Each primitive gets the same three checks; example for `Level` and `Fill`:

```tsx
it('clamps the level to 0–100 and exposes it', () => {
  const { container } = render(<Level pct={140} />)
  expect(container.querySelector('.fo-level i')).toHaveStyle({ width: '100%' })
})
it('gives every Fill its own clip and gradient id (bible trap 2)', () => {
  const { container } = render(<><Fill d="M0 0H10V10H0Z" pct={50} /><Fill d="M0 0H10V10H0Z" pct={50} /></>)
  const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
  expect(new Set(ids).size).toBe(2)
})
it('never renders a progress ring', () => { expect(container.querySelector('circle[stroke-dasharray]')).toBeNull() })
```
`Badge`: member → glyph map is exactly `{ szunya:'t-sleep', mocor:'t-dumbbell', falat:'t-bowl', deru:'t-heart', mezo:'t-orb', szk:'t-lens' }` and colours `#AB9FD2 #5B9BD5 #6FB08A #D9A94E #8C97A8 #8494A6` (`kit.js` `TEAM` / `badge`). `Hero`: with `actions` it renders the liquid action row (`.fo-hero-acts`), without it the closing liquid strip.
- [ ] **Step 2: Implement** each component as a thin markup wrapper around the ported CSS; ids via `useId()`. No data hooks, no router imports (ArchUnit-style layering: `shared/ui` must not import from `features/` or `app/` — check `frontend/src` lint rules and `docs/CODEMAP.md`).
- [ ] **Step 3:** a kit gallery route **in dev only** is not added (YAGNI). Instead a Vitest snapshot-free render test `kit.gallery.test.tsx` renders every export once with realistic props and asserts no console error.
- [ ] **Step 4:** tests green both modes; commit.

### Task 5: The frame — title bar, top tabs, five-drop bottom bar, history back

**Files:** Modify `app/navModel.ts`, `app/AppLayout.tsx`, `app/QuickLogFab.tsx`, `shared/ui/mozaik/index.tsx`, `app/MindenOldalPage.tsx` (drop the switcher wording only). Create `app/TitleBar.tsx`, `app/TopTabs.tsx`, `app/BottomBar.tsx`, `shared/ui/folyadek/frame.tsx`. Delete `app/AppHeader.tsx` (its notification-panel body moves into `TitleBar.tsx` unchanged), `app/TabBar.tsx`, `app/DomainSwitcher.tsx`, `app/HeaderAurora.tsx`, `app/useCondensedHeader.ts` (+ their tests are **rewritten** against the new components, keeping every behavioural case). CSS: delete the `F1:CHROME` block, add `── folyadék frame ──` to `folyadek.css` ported from `vilagos/kit.js` (`.fh-top .fh-trow .fh-title .fh-ib .fh-tabs .fh-nav`) and `vilagos/foly.js` (the `Q`-scoped overrides and the "F1 frame parity" block, including the `@media (max-width:360px)` rules), renamed `.fo-*`.

**Interfaces:**

```ts
// navModel.ts — additions
export interface NavTab { /* … */ title?: string }   // page title when it differs from the label
// tab 1 titles: nap 'Ma', train 'Edzés', fuel 'Fuel', mezo 'Üzenőfal', me 'Én'
export interface Frame { domain: NavDomain; tab: NavTab | null; isHub: boolean; title: string; eyebrow: string; fallback: string }
export function frameFor(pathname: string, today: Date): Frame
//  isHub  = pathname equals one of the domain's four tab routes
//  title  = hub: tab.title ?? tab.label · sub-page: the PAGE_INDEX label whose route is the longest prefix of pathname, else tab.label
//  eyebrow= hub: long Hungarian date ("Szerda, október 7.") · sub-page: `${domain.name} · ${tab.label}`
//  fallback = the owning tab's route (domain home when no tab owns the path)
// outside the five domains (/settings…, /minden): domain = Nap for colour, isHub false, eyebrow 'Beállítások' | 'Az app térképe', fallback '/nap'

// shared/ui/folyadek/frame.tsx
export function FrameProvider(p: { children: ReactNode }): JSX.Element
export function useFrameTitle(o: { title?: string; eyebrow?: string }): void   // a converted page overrides the derived title
export function useFrameBack(onBack: () => void): void                          // a page hands its own back handler to the shell
export function useFrame(): { title?: string; eyebrow?: string; onBack?: () => void }
```

- [ ] **Step 1: navModel tests** (`navModel.test.ts`, extend): `frameFor('/nap', d)` → hub, title `Ma`, eyebrow the formatted date; `frameFor('/fuel/stack', d)` → hub, title `Kiegészítők`; `frameFor('/fuel/recipes', d)` → sub-page, eyebrow `Fuel · Konyha`, fallback `/fuel/konyha`; `frameFor('/settings/fuel', d)` → sub-page, title `Fuel beállítások`. Keep every existing `activeTabRoute` / `rememberRoute` / `routeForDomain` case untouched. Implement.
- [ ] **Step 2: BottomBar** (tests rewritten from `TabBar.test.tsx`, `boopNavigation.test.ts`, `navigation.test.tsx`):

```tsx
export function BottomBar() {
  const { pathname } = useLocation()
  useEffect(() => { rememberRoute(pathname) }, [pathname])          // last-tab memory moves here unchanged
  const active = activeDomainId(pathname) ?? 'nap'
  return (
    <nav className="fo-nav" aria-label="Területek">
      {DOMAINS.map((d) => (
        <Link key={d.id} to={routeForDomain(d.id)} className={cn('fo-nav-item', d.id === active && 'on')}
          aria-current={d.id === active ? 'true' : undefined} style={{ '--c': DOMAIN_COLOR[d.id] } as CSSProperties}>
          <Drop pct={d.id === active ? 86 : REST_FILL[d.id]} color={DOMAIN_COLOR[d.id]} size={d.id === active ? 40 : 34} alive={d.id === active} />
          <span>{d.name}</span>
        </Link>
      ))}
    </nav>
  )
}
// DOMAIN_COLOR = { nap:'#1F6FEB', train:'#F26A3D', fuel:'#1E9E6A', mezo:'#6D5BD0', me:'#0E9AA7' }; REST_FILL = { nap:70, train:34, fuel:62, mezo:50, me:58 }  (kit.js DOM / FILL)
```
Cases to keep: five links always, in order; the active domain from the first path segment; tapping a domain goes to its remembered tab, else tab 1; a path outside the domains lights Nap. New case: no element with `aria-haspopup="dialog"` (the switcher is gone).
- [ ] **Step 3: TopTabs** — renders `domain.tabs` as pill links with `activeTabRoute`, `aria-current="page"`, the `dots` prop (the A napom dot, description text "kész a tegnapi értékelés" preserved from `napomTabDot.test.tsx`), the unread count of `useMezoThread().unread` on the `/nap/uzenetek` tab, and `data-kalauz-anchor="train-tabs"` on the train domain's strip (`features/tutorial/registry/anchors.test.tsx` keeps passing). Not rendered when `!frame.isHub`.
- [ ] **Step 4: TitleBar** — port `AppHeader.tsx`: all hooks, the notification panel JSX and its effects move over **unchanged**; only the bar markup changes to the prototype's:
  - hub: line 1 = eyebrow (drop dot + `frame.eyebrow`) and five buttons in this order: Minden oldal (`t-grid`, `navigate('/minden#' + domain.id)` — check the existing route path in `router.tsx` and keep it), Mezo üzenetei (`t-chat`, badge `unreadMsgs`, → `/nap/uzenetek`), Értesítések (`t-bell`, badge, toggles the panel), Beállítások (`t-gear`, same `state.from` logic), the day orb (`<Drop pct={dayOrb.pct} …>`, `aria-label={dayOrb.label}`, → `/nap/napom/<today>`). Line 2 = `<h1>` title + the kalauz "?" (only when `kalauz.current`; unseen-T3 dot kept).
  - sub-page: back button (`frame.onBack ?? (() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(frame.fallback)))`), eyebrow + title + "?", bell.
  - Every `aria-label` of `AppHeader.test.tsx` / `AppHeader.ntfPeek.test.tsx` / `AppHeader.dayOrbTone.test.tsx` is preserved so those tests are renamed and re-pointed, not rewritten.
- [ ] **Step 5: PageHead hands back to the shell.** In `mozaik/index.tsx`:

```tsx
export function PageHead({ onBack, children }: { onBack: () => void; label?: string; glass?: boolean; children?: ReactNode }) {
  useFrameBack(onBack)
  return children ? <div className="mz-page-head uv-head">{children}</div> : null
}
```
`backNavigation.test.tsx` and `hubHeaders.test.tsx`: assert the back control is the title bar's `Vissza` button and that it calls the page's handler. Then list hand-rolled back buttons (`grep -rn "navigate(-1)" frontend/src --include=*.tsx | grep -v test`): each site that renders its own visible back control on a route **with** chrome switches to `useFrameBack(() => navigate(-1))` and drops its button; full-screen flows (`hideChrome` routes, the chat's own header on `hideHeader`) keep theirs.
- [ ] **Step 6: AppLayout** — replace `<AppHeader />` with `<TitleBar />` + `<TopTabs dots={{ '/nap/napom': morning }} />` inside the same `!hideHeader` gate, `<TabBar …/>` with `<BottomBar />` in the same `!hideChrome && !inSettings` gate, wrap the screen in `<FrameProvider>`. `QuickLogFab`: class `fo-fab` (CSS from `foly.js` `.fh-fab`), same handler, same `hideFab` gate.
- [ ] **Step 7: Layout specs.** Update `frontend/tests/layout/navigation.spec.ts`, `layout.spec.ts`, `tudastar-hub.spec.ts`, `fuel-learning.spec.ts` to drive the new bar (five domain links; top-tab pills) and add: at 320 px the hub title bar's buttons and title do not overlap (bounding boxes), the bottom bar's five items fit, no horizontal scroll on `/nap`, `/fuel/stack`, `/train/mai`, `/mezo`, `/me`.
- [ ] **Step 8:** both test modes + `pnpm test:layout` + `pnpm build` green; commit.

### Task 6: The opening animation

**Files:** `app/StartupSplash.tsx`, `app/StartupSplash.css`, `app/startupChoreography.ts` (+ `.test.ts`), `StartupSplash.test.tsx`, `tests/layout/startup.spec.ts`.

- [ ] **Step 1:** Keep the contract: `SPLASH_DURATION_MS = 3000`, the content behind is inert until the end, the dev-only `mezo.splash.skip` seam, `prefersStill()`. Replace the rAF orb choreography with the prototype's CSS timeline (`vilagos/keret.js`: `splash()` markup and the `.sp*` rules + `@keyframes spw spin spin0 spbar sprise spdrain spdx spdrop`), classes renamed `.fo-sp-*`. The five drops use `<Drop>` inside the same markup as `BottomBar` so they land on the bar pixel-exactly. Wordmark text stays `boop`.
- [ ] **Step 2: Tests.** `startupChoreography.ts` shrinks to the timing constants (`FADE_AT_MS = 2400`, `DROP_START_MS = 1080`, `DROP_STAGGER_MS = 170`); its test asserts the last drop lands before the fade (`DROP_START_MS + 4 * DROP_STAGGER_MS + 560 < FADE_AT_MS`). `StartupSplash.test.tsx`: renders five drops and one vessel with five layers; under reduced motion no element has a running animation and the splash unmounts at 3000 ms (fake timers); the skip seam still skips.
- [ ] **Step 3:** run, green, look at it in the browser at 390 and 320 against `#w-nap-indito`; commit.

### Task 7: Verify, document, ship

- [ ] **Step 1: Runtime pass** (`verify` skill): every tab route of the five domains, one deep page each, `/settings`, `/minden`, the notification panel open, kalauz open, the quick-log sheet, at 390 and 320 px, plus reduced motion — side by side with the prototype (`#w-<d>-mai`, `#w-<d>-atmenet`, `#w-nap-indito`). `/ritual` and `/me/sleep/night` still dark and unbroken. Console clean; zero missing `<use>` targets.
- [ ] **Step 2: Reverse parity list** pasted into the bead: each `AppHeader` / `TabBar` / `DomainSwitcher` control and state → where it is now, with a test or screenshot as evidence.
- [ ] **Step 3: Docs.** `docs/features/_platform-design-system.md` (frame, fonts, sprite, kit, light lock), `docs/features/today.md` header list, `docs/features/README.md` rows, `docs/milestones/roadmap.md` (dated entry + *Epics in flight*), bible Appendix (rules F1.1…), `vilagos/HANDOFF.md` (any deviation), `CLAUDE.md` §Design direction if it still says Üveg/dark, `.claude/skills/folyadek/SKILL.md` only if a trap was learned. `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs --errors-only` → 0 errors / 0 stale.
- [ ] **Step 4: Final gates.** `CI=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm test:layout`, `pnpm build` — paste the tails into the bead.
- [ ] **Step 5: Merge and deploy** (AGENTS.md §Git Workflow): `git pull --rebase origin main` on the branch, quick gates if anything came in; `git checkout --detach origin/main && git merge --no-ff feat/folyadek-alap -m "Merge feat/folyadek-alap — Folyadék F1: alap, keret, készlet (mezo-n4wf5.1)"`, regenerate the codemap, `git push origin HEAD:main`. Watch `deploy` for that commit until green; open `https://46.225.112.172.sslip.io/` and check the five domains, one sub-page and the splash. `ci` red → fix first.
- [ ] **Step 6: Close.** Republish the prototype if it changed; `bd close mezo-n4wf5.1` with the result summary; `node scripts/check-beads-backup.mjs --fix` + commit; `bd dolt push`; `git push`; delete the branch; Hungarian report walking the *Kész, ha…* list.

## Execution notes

- Order is strict for 0 → 1 → 2 → 3. Task 4 (kit) is independent of 2–3 and can run in parallel in its own files; Tasks 5 and 6 need 1, 2 and 4. `prototype.css` is edited only inside the planted markers (Task 3) and three single lines (Task 1); everything new goes to `folyadek.css`.
- Known risk: Task 3's sweep is the open-ended part (68 old CSS blocks tuned for dark). It is bounded by the route list and the zero-hits script, not by taste.
- Not in F1 (do not start): converting any page's content to the skeleton (F2–F7), removing `Boop` from pages, the rings, dead dark CSS (F9), the "boop" name and PWA icon (F8).
