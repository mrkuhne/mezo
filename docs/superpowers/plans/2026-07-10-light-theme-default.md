# Light Theme as Default + Light-Mode Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the light theme the app default everywhere (dark stays a Settings option), add light-mode card elevation (approved variant A), and fix every light-mode leftover.

**Architecture:** Frontend-only. The CSS theme structure stays as-is (`:root` = dark base, `[data-theme="light"]` = overrides); only the *default* flips in every layer (pre-paint script, provider, PWA manifest, `theme-color` meta). Card elevation lands as two new CSS tokens consumed by the central `.card` class — `drop-shadow` (not `box-shadow`) because the notch `clip-path` would clip a box-shadow.

**Tech Stack:** React 19 + Vite + vitest/RTL; design tokens in `frontend/src/styles/prototype.css`; Playwright MCP for the visual audit.

**Spec:** `docs/superpowers/specs/2026-07-10-light-theme-default-design.md` · **bd:** `mezo-sb6z` · **Branch:** `feat/light-theme-default`

## Global Constraints

- Read `docs/references/frontend_conventions.md` before touching `frontend/src` (house rule).
- Attribute semantics unchanged: `data-theme="light"` present = light; attribute absent = dark. Never add a `[data-theme="dark"]` CSS block.
- Stored preference wins over the default: `localStorage['mezo-theme']` = `'dark'` must keep the app dark (spec D5).
- Approved shadow (spec D3, tune max ±20% during audit): `drop-shadow(0 1px 2px rgba(10,15,20,0.06)) drop-shadow(0 4px 10px rgba(10,15,20,0.07))`; light card border `rgba(15,23,35,0.10)`. Dark mode: `filter: none`, border unchanged.
- Chips/tags get NO shadow — only `.card`.
- Gate before finishing: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — all green.
- Commit subjects carry the bd id, e.g. `feat(fe): ... (mezo-sb6z)`.
- Dev server for visual checks: `cd frontend && VITE_USE_MOCK=true pnpm dev --port 5181` (mock mode, no backend needed). Force light in the browser: `localStorage.setItem('mezo-theme','light')` + reload (after Task 1, light is the default with empty storage).

---

### Task 1: Default flip in every layer (TDD)

**Files:**
- Modify: `frontend/src/shared/lib/theme.ts`
- Modify: `frontend/src/shared/lib/theme.test.ts`
- Modify: `frontend/src/app/ThemeProvider.tsx:8`
- Modify: `frontend/src/app/ThemeProvider.test.tsx`
- Modify: `frontend/index.html` (theme-color meta + inline script)
- Modify: `frontend/vite.config.ts:19-20`

**Interfaces:**
- Produces: `DEFAULT_THEME: Theme` (= `'light'`) exported from `@/shared/lib/theme`; `applyTheme(theme)` additionally syncs `<meta name="theme-color">` (`light → #F4F6F8`, `dark → #0A0F14`).

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/shared/lib/theme.test.ts` content with:

```ts
import { readStoredTheme, writeStoredTheme, applyTheme, THEME_KEY, DEFAULT_THEME } from '@/shared/lib/theme'

beforeEach(() => {
  localStorage.clear()
  document.querySelector('meta[name="theme-color"]')?.remove()
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#F4F6F8">')
})

test('DEFAULT_THEME is light', () => {
  expect(DEFAULT_THEME).toBe('light')
})
test('readStoredTheme returns null when unset or invalid', () => {
  expect(readStoredTheme()).toBeNull()
  localStorage.setItem(THEME_KEY, 'banana')
  expect(readStoredTheme()).toBeNull()
})
test('write then read round-trips', () => {
  writeStoredTheme('light')
  expect(readStoredTheme()).toBe('light')
})
test('applyTheme sets data-theme=light and removes it for dark', () => {
  applyTheme('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  applyTheme('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
})
test('applyTheme syncs the browser-chrome theme-color meta', () => {
  const meta = document.querySelector('meta[name="theme-color"]')!
  applyTheme('dark')
  expect(meta.getAttribute('content')).toBe('#0A0F14')
  applyTheme('light')
  expect(meta.getAttribute('content')).toBe('#F4F6F8')
})
```

Replace the test in `frontend/src/app/ThemeProvider.test.tsx` (keep imports/Probe/beforeEach) with:

```tsx
test('defaults to light and toggles to dark, persisting + clearing data-theme', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:light')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  expect(localStorage.getItem('mezo-theme')).toBe('dark')
})

test('a stored dark preference overrides the light default', () => {
  localStorage.setItem('mezo-theme', 'dark')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm test -- src/shared/lib/theme.test.ts src/app/ThemeProvider.test.tsx`
Expected: FAIL — `DEFAULT_THEME` not exported; `theme:light` not found (still defaults to dark); meta not synced.

- [ ] **Step 3: Implement**

`frontend/src/shared/lib/theme.ts` — full new content:

```ts
export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'
export const DEFAULT_THEME: Theme = 'light'

/** Browser/PWA chrome color per theme — keep in sync with --canvas in prototype.css
    and with the static meta in index.html / manifest in vite.config.ts. */
const THEME_COLOR: Record<Theme, string> = { light: '#F4F6F8', dark: '#0A0F14' }

export function readStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}
export function writeStoredTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
}
/** Dark is the CSS base => no attribute; light => data-theme="light". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
```

`frontend/src/app/ThemeProvider.tsx` line 8 — change the fallback:

```tsx
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? DEFAULT_THEME)
```

and extend the import on line 2:

```tsx
import { applyTheme, readStoredTheme, writeStoredTheme, DEFAULT_THEME, type Theme } from '@/shared/lib/theme'
```

`frontend/index.html` — the static meta becomes the light color:

```html
    <meta name="theme-color" content="#F4F6F8" />
```

and the pre-paint script defaults to light (attribute set unless the stored choice is exactly `'dark'`):

```html
    <script>
      (function () {
        var t = null
        try { t = localStorage.getItem('mezo-theme') } catch (e) {}
        /* Light is the default: only an explicit stored 'dark' keeps the attribute off
           (dark is the CSS base). Invalid/missing values fall through to light. */
        if (t !== 'dark') document.documentElement.setAttribute('data-theme', 'light')
      })()
    </script>
```

`frontend/vite.config.ts` lines 19–20 — light PWA chrome (canvas + light page-bg):

```ts
        theme_color: '#F4F6F8',
        background_color: '#DDE2E8',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- src/shared/lib/theme.test.ts src/app/ThemeProvider.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/theme.ts frontend/src/shared/lib/theme.test.ts \
        frontend/src/app/ThemeProvider.tsx frontend/src/app/ThemeProvider.test.tsx \
        frontend/index.html frontend/vite.config.ts
git commit -m "feat(fe): light theme becomes the app default, dark stays opt-in (mezo-sb6z)"
```

---

### Task 2: Card elevation tokens + `.card` + desktop bezel fix (CSS)

**Files:**
- Modify: `frontend/src/styles/prototype.css` (`:root` block ~line 77, light block ~line 133, `.card` at 416–419, `.app-root` at 169–173)

**Interfaces:**
- Produces: CSS tokens `--card-elevation`, `--card-border`, `--page-glow` (both theme blocks); `.card` consumes them. Components keep using the `.card` class unchanged.

- [ ] **Step 1: Add the tokens**

In `prototype.css` `:root` (dark base), after the `--page-bg` line:

```css
  /* Card elevation — light lifts cards off the canvas; dark stays flat.
     drop-shadow (not box-shadow): the notch clip-path would clip a box-shadow. */
  --card-elevation: none;
  --card-border: var(--border-subtle);
  /* Desktop bezel (letterbox) radial gradient center stop */
  --page-glow: #0c1218;
```

In the `:root[data-theme="light"]` block, after its `--page-bg` line:

```css
  /* Card elevation (approved variant A) */
  --card-elevation: drop-shadow(0 1px 2px rgba(10, 15, 20, 0.06)) drop-shadow(0 4px 10px rgba(10, 15, 20, 0.07));
  --card-border: rgba(15, 23, 35, 0.10);
  --page-glow: #E8EDF2;
```

- [ ] **Step 2: Consume them**

`.card` (line 416) becomes:

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--card-border);
  filter: var(--card-elevation);
}
```

`.app-root` (line 169) background becomes token-driven:

```css
.app-root {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, var(--page-glow) 0%, var(--page-bg) 70%);
}
```

- [ ] **Step 3: Visual smoke check (both themes)**

With the mock dev server running, in the browser (or Playwright): load `/train` with empty localStorage → light by default, cards visibly lifted, desktop letterbox around the phone frame is LIGHT gray (not black). Then `localStorage.setItem('mezo-theme','dark')` + reload → dark looks exactly as before (flat cards, dark bezel).

- [ ] **Step 4: Run the test suite (guards against CSS-import breakage)**

Run: `cd frontend && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/prototype.css
git commit -m "feat(fe): light-mode card elevation tokens + themed desktop bezel (mezo-sb6z)"
```

---

### Task 3: Hardcoded glass spots → theme-aware token

**Files:**
- Modify: `frontend/src/features/insights/components/PatternCard.tsx:35`
- Modify: `frontend/src/features/fuel/components/MacroCells.tsx:41`
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx:52`

**Interfaces:**
- Consumes: existing `--surface-glass` token (dark `rgba(255,255,255,0.04)`, light `rgba(0,0,0,0.03)` — already themed in `prototype.css`).

**Deliberately NOT changed** (they sit on hardcoded dark "image placeholder" gradient bands that stay dark in both themes, like a photo): the `repeating-linear-gradient` white stripes in `RecipeCard.tsx:27` and `RecipeDetailPage.tsx:122`, and the dark fade overlays next to them. `PersonCard.tsx:42` (inset avatar ring) is judged in the Task 4 audit.

- [ ] **Step 1: Swap the three backgrounds**

In each of the three files, replace the hardcoded white-glass value with the token:

`PatternCard.tsx:35`: `background: 'rgba(255,255,255,0.02)'` → `background: 'var(--surface-glass)'`
`MacroCells.tsx:41`: `background: 'rgba(255,255,255,0.025)'` → `background: 'var(--surface-glass)'`
`RecipeDetailPage.tsx:52`: `background: 'rgba(255,255,255,0.025)'` → `background: 'var(--surface-glass)'`

- [ ] **Step 2: Visual check**

Light mode: `/insights` (pattern chips readable), `/fuel/recipes` + one recipe detail (macro cells now faintly gray, not invisible). Dark mode spot-check: same views unchanged to the eye.

- [ ] **Step 3: Run affected tests**

Run: `cd frontend && pnpm test -- src/features/insights src/features/fuel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/insights/components/PatternCard.tsx \
        frontend/src/features/fuel/components/MacroCells.tsx \
        frontend/src/features/fuel/pages/RecipeDetailPage.tsx
git commit -m "fix(fe): theme-aware glass backgrounds instead of hardcoded white rgba (mezo-sb6z)"
```

---

### Task 4: Full visual audit in light mode + fixes

**Files:**
- Modify: whatever the audit flags (expect small inline-style/token fixes in `frontend/src/features/**`)

**Interfaces:** none new — fixes reuse existing tokens (`--surface-glass`, `--border-subtle`, semantic colors).

- [ ] **Step 1: Walk every route in light mode (Playwright MCP, mock dev server, empty localStorage)**

Routes: `/today` · `/train` + `/train/gym` `/train/sport` `/train/futas` `/train/exercises` `/train/mesocycles` · `/train/session` · `/train/mesocycles/new` · `/fuel` + `/fuel/plan` `/fuel/stack` `/fuel/recipes` `/fuel/kamra` `/fuel/gyogyszer` · one `/fuel/recipes/:id` + its `/edit` · `/insights` + `/insights/weekly` `/insights/memoir` `/insights/knowledge` `/insights/chat` `/insights/predictions` `/insights/experiments` · `/me` + `/me/goals` `/me/weight` `/me/sleep` `/me/people` `/me/knowledge` · `/me/goals/new`.

Sheets (open via UI on top of their pages): Settings (Me), one Fuel sheet (e.g. stack picker), one Train sheet.

Screenshot each; flag: invisible/low-contrast text, white-on-white boxes, dark leftovers, glow effects designed for dark (`boxShadow` with bright colors), unreadable chips. Also check `PersonCard` avatars (`/me/people`).

- [ ] **Step 2: Fix what the audit flags**

Rules: reuse existing tokens; no layout changes; anything bigger than a color/border/shadow swap → file a follow-up `bd create` instead of fixing here. Keep a short list of files touched + one-line reason each (goes into the commit body).

- [ ] **Step 3: Dark-mode regression spot-check**

Set stored theme to dark, reload, and re-screenshot 4–5 representative pages (`/today`, `/train`, `/fuel`, `/insights`, `/me/people`): dark must look unchanged.

- [ ] **Step 4: Run the full suite in both modes**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "fix(fe): light-mode contrast/visibility fixes from full visual audit (mezo-sb6z)"
```

---

### Task 5: Docs, gates, ship

**Files:**
- Modify: `docs/features/_platform-design-system.md` (theme/default + elevation tokens section)
- Modify: `docs/milestones/roadmap.md` (milestone log line)

- [ ] **Step 1: Update the living docs**

`_platform-design-system.md`: default theme is now **light** (dark = opt-in via Settings; attribute semantics unchanged); document `--card-elevation` / `--card-border` / `--page-glow` tokens and the drop-shadow-vs-clip-path rationale; update any `file:line` pointers that moved.
`roadmap.md`: one milestone-log line: light theme default + card elevation ship (`mezo-sb6z`).

- [ ] **Step 2: Lint docs**

Run: `node scripts/lint-docs.mjs`
Expected: clean (no staleness flag on `_platform-design-system.md`).

- [ ] **Step 3: Full gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build + both modes green.

- [ ] **Step 4: Commit docs**

```bash
git add docs/features/_platform-design-system.md docs/milestones/roadmap.md
git commit -m "docs(design-system): light default + elevation tokens; roadmap log (mezo-sb6z)"
```

- [ ] **Step 5: Ship per house git flow**

```bash
git push -u origin feat/light-theme-default
gh pr create --title "feat(fe): light theme default + light-mode polish (mezo-sb6z)" \
  --body "Spec: docs/superpowers/specs/2026-07-10-light-theme-default-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
# wait for CI green, then:
git checkout main && git pull --rebase
git merge --no-ff feat/light-theme-default
bd dolt push && git push
git branch -d feat/light-theme-default && git push origin --delete feat/light-theme-default
bd close mezo-sb6z
```

Reminder (memory): do NOT `git pull --rebase` after the `--no-ff` merge — it flattens the merge commit.
