# Napív Redesign — S1 Foundation + S2 Circadian Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Napív design foundation — warm token set, new fonts, theme-attribute inversion, rounded shapes, frosted 4-tab bar + center „+" quick-log sheet, parity retirement — plus the circadian layer (daypart helper, sky band, motion utilities), leaving every screen functional and both test modes green.

**Architecture:** New Napív tokens are ADDED to `prototype.css` while legacy Deep-Current tokens stay (screens migrate in S3–S7); a handful of legacy tokens (`--canvas`, `--page-bg`, fonts) are re-valued so the whole app warms immediately; `.notch-*` chamfers are redefined to border-radius so every card softens without touching components. Theme attribute semantics invert (`:root` = light base, `data-theme="dark"` = dark override). The circadian sky band renders once in `PhoneFrame` under all views.

**Tech Stack:** React 19, Vite 8, Tailwind v4 (`@theme inline` bridge), plain CSS tokens in `frontend/src/styles/prototype.css`, Vitest + RTL, driving spec: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`.

## Global Constraints

- Worktree: `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd issue **mezo-8141**. Run all commands from the worktree.
- Commit in the worktree with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "..."` (the bd hook must not inject `.beads/issues.jsonl` from here). Conventional subjects carry `(mezo-8141)`.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — **both modes green**, build clean.
- Frontend conventions are law (`docs/references/frontend_conventions.md`): no `*Screen`/`*View` names, features import data hooks from `@/data/hooks` only, no new barrels, deep absolute `@/*` imports, colocated tests, `shared/ui` never imports `@/data/*`.
- Hungarian UI copy; new labels use sentence case, active verbs. Tab labels are exactly: `Ma · Edzés · Fuel · Én`.
- No new npm dependencies. CSS-first animations; every animation must be disabled under `@media (prefers-reduced-motion: reduce)`.
- Exact palette values come from spec §3.1 — copy them verbatim, never improvise hex values.

---

### Task 1: Napív token layer, fonts, and global shape softening

**Files:**
- Modify: `frontend/index.html:14-19` (font links)
- Modify: `frontend/src/styles/prototype.css` (`:root` block lines 3-93; `.notch-*` lines 156-162; append new section at end of file)
- Modify: `frontend/src/index.css` (append to `@theme inline`)
- Test: existing suites only (this task adds no behavior; classes/aria asserted by tests must not change)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--ink, --sub, --faint, --warm, --line, --surface, --coral, --coral-deep, --amber, --sage, --sage-deep, --lav, --lav-deep, --rose, --sky, --np-shadow-card, --np-shadow-row, --np-ease-ios, --np-ease-spring` available on `:root`; Tailwind utilities `bg-coral`, `text-ink`, etc.; fonts `Bricolage Grotesque` (display) + `Plus Jakarta Sans` (body) live app-wide via the existing `--ff-display`/`--ff-body` slots.

- [ ] **Step 1: Swap the Google Fonts link** in `frontend/index.html` (JetBrains Mono stays until S8 — `ToolChip` still uses it):

```html
<link
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Re-value the legacy font + canvas tokens** inside the existing `:root` block of `prototype.css` (only these four lines change in the legacy block for now; full light/dark restructuring is Task 2):

```css
  --ff-display: "Bricolage Grotesque", sans-serif;
  --ff-body:    "Plus Jakarta Sans", -apple-system, system-ui, sans-serif;
```

- [ ] **Step 3: Append the Napív token + transitional re-skin section** at the END of `prototype.css`:

```css
/* ===== Napív tokens (2026-07-13 redesign, spec: 2026-07-13-napiv-frontend-redesign-design.md) ===== */
:root {
  --surface: #FFFFFF;
  --warm: #F4EBDF;
  --line: #EFE5D8;
  --ink: #2B2118;
  --sub: #8A7A6A;
  --faint: #A5978A;
  --coral: #FF6B4A;      --coral-deep: #C4622F;
  --amber: #FFB347;
  --sage: #7FA48A;       --sage-deep: #5F7A52;
  --lav: #9B8FC4;        --lav-deep: #7A6DA8;
  --rose: #E27A8B;
  --sky: #6FA7D8;
  --np-shadow-card: 0 2px 4px rgba(43,33,24,.04), 0 12px 30px rgba(43,33,24,.08);
  --np-shadow-row: 0 8px 20px rgba(43,33,24,.05);
  --np-ease-ios: cubic-bezier(.32,.72,0,1);
  --np-ease-spring: cubic-bezier(.34,1.4,.44,1);
}

/* Transitional shape softening: chamfers become rounded corners app-wide.
   Radii follow spec §3.3 (rows 18-20px, cards 20-28px). */
.notch-4  { clip-path: none; border-radius: 12px; }
.notch-8  { clip-path: none; border-radius: 16px; }
.notch-12 { clip-path: none; border-radius: 20px; }
.notch-16 { clip-path: none; border-radius: 24px; }
.notch-tl-12, .notch-br-12 { clip-path: none; border-radius: 20px; }
```

- [ ] **Step 4: Bridge the new tokens to Tailwind** — append inside the `@theme inline { … }` block of `frontend/src/index.css` (before the closing brace):

```css
  --color-ink: var(--ink);
  --color-sub: var(--sub);
  --color-faint: var(--faint);
  --color-warm: var(--warm);
  --color-line: var(--line);
  --color-surface: var(--surface);
  --color-coral: var(--coral);
  --color-coral-deep: var(--coral-deep);
  --color-amber: var(--amber);
  --color-sage: var(--sage);
  --color-sage-deep: var(--sage-deep);
  --color-lav: var(--lav);
  --color-lav-deep: var(--lav-deep);
  --color-rose: var(--rose);
  --color-sky: var(--sky);
```

- [ ] **Step 5: Gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build PASS; all vitest suites PASS in both modes (tests assert classes like `notch-12`, which still exist — only their CSS changed).

- [ ] **Step 6: Visual smoke** — `VITE_USE_MOCK=true pnpm dev --port 5181`, open `/today`, `/train`, `/fuel`, `/me`: corners are rounded everywhere, type is Bricolage/Jakarta, nothing is clipped or overlapping. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add frontend/index.html frontend/src/styles/prototype.css frontend/src/index.css
git -c core.hooksPath=/dev/null commit -m "feat(fe/design): Napív tokens, Bricolage+Jakarta fonts, rounded shape pass (mezo-8141)"
```

---

### Task 2: Theme attribute inversion — `:root` becomes the light base

**Files:**
- Modify: `frontend/src/styles/prototype.css:3-154` (swap the two token blocks)
- Modify: `frontend/src/shared/lib/theme.ts`
- Modify: `frontend/src/shared/lib/theme.test.ts`
- Modify: `frontend/index.html:12,20-28` (static theme-color meta + pre-paint script)
- Modify: `frontend/vite.config.ts:19-20` (manifest colors)
- Check/Modify: `frontend/src/app/navigation.test.tsx:25-…` ("Me screen theme toggle flips data-theme") and `frontend/src/app/ThemeProvider.test.tsx` (attribute expectations)

**Interfaces:**
- Consumes: Task 1 tokens (unchanged by this task).
- Produces: NEW semantics — `applyTheme('dark')` sets `data-theme="dark"`, `applyTheme('light')` removes the attribute; CSS `:root` holds light values, `:root[data-theme="dark"]` holds dark values. `THEME_COLOR = { light: '#FBF6EF', dark: '#0A0F14' }`. Every later slice relies on `:root` being light.

- [ ] **Step 1: Write the failing tests** — replace the two `applyTheme` tests in `frontend/src/shared/lib/theme.test.ts` (and update the `beforeEach` meta seed content to `#FBF6EF`):

```ts
test('applyTheme sets data-theme=dark and removes it for light', () => {
  applyTheme('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  applyTheme('light')
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
})
test('applyTheme syncs the browser-chrome theme-color meta', () => {
  const meta = document.querySelector('meta[name="theme-color"]')!
  applyTheme('dark')
  expect(meta.getAttribute('content')).toBe('#0A0F14')
  applyTheme('light')
  expect(meta.getAttribute('content')).toBe('#FBF6EF')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm vitest run src/shared/lib/theme.test.ts`
Expected: FAIL — attribute expectations inverted vs current implementation.

- [ ] **Step 3: Invert `theme.ts`**:

```ts
export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'
export const DEFAULT_THEME: Theme = 'light'

/** Browser/PWA chrome color per theme — keep in sync with --canvas in prototype.css
    and with the static meta in index.html / manifest in vite.config.ts. */
const THEME_COLOR: Record<Theme, string> = { light: '#FBF6EF', dark: '#0A0F14' }

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
/** Napív inversion (spec §6 R2): light is the CSS base => no attribute; dark => data-theme="dark". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
```

- [ ] **Step 4: Swap the CSS blocks in `prototype.css`.** Move every value currently in `:root[data-theme="light"]` (lines 96-154) into `:root`, and every displaced dark value into a new `:root[data-theme="dark"]` block; delete the `[data-theme="light"]` block. Also re-value the light canvas family to Napív warmth while you're in there. Resulting blocks (complete, replaces lines 3-154 token content — keep the comment headers):

```css
:root {
  /* Brand · legacy teal (screens still on Deep Current use these until S3–S7) */
  --brand-deep: #064E5B;
  --brand-core: #0E7C7B;
  --brand-primary: #0E7C7B;
  --brand-glow: #0E7C7B;
  --brand-tint: #E6F7F4;

  /* Canvas / surfaces — warmed to Napív */
  --canvas: #FBF6EF;
  --surface-1: #FFFFFF;
  --surface-2: #F4EBDF;
  --surface-3: #EFE5D8;
  --surface-glass: rgba(0, 0, 0, 0.03);

  --border-subtle: rgba(43, 33, 24, 0.08);
  --border-strong: rgba(43, 33, 24, 0.18);
  --border-brand: rgba(14, 124, 123, 0.40);

  /* Text — warm ink */
  --text-primary: #2B2118;
  --text-secondary: #5F5346;
  --text-tertiary: #8A7A6A;
  --text-quaternary: #A5978A;
  --text-inverse: #FFFFFF;

  --text-on-media: #ECECF1;
  --text-on-media-dim: #9CA3AF;

  /* Semantic — AA on white */
  --success: #047857;
  --warning: #B45309;
  --error: #BE123C;
  --info: #1D4ED8;

  /* Pattern category palette — deepened */
  --cat-physiology: #1D4ED8;
  --cat-preference: #6D28D9;
  --cat-trigger:    #B45309;
  --cat-response:   #047857;
  --cat-tendency:   #BE185D;
  --cat-goal-state: #0E7C7B;

  --tool-read:    rgba(14, 124, 123, 0.55);
  --tool-compute: var(--warning);
  --tool-write:   var(--brand-glow);

  /* Reta phase gradient stops (unchanged) */
  --reta-d1: #5EEAD4; --reta-d2: #14B8A6; --reta-d3: #F59E0B; --reta-d4: #F59E0B;
  --reta-d5: #D97757; --reta-d6: #6B7280; --reta-d7: #4B5563;

  /* AnchorMode (light, warmer) */
  --anchor-canvas:  #FBF4EC;
  --anchor-surface: #F4E7D6;
  --anchor-accent:  #B45309;
  --anchor-text:    #3A2A1A;

  /* Fonts */
  --ff-display: "Bricolage Grotesque", sans-serif;
  --ff-body:    "Plus Jakarta Sans", -apple-system, system-ui, sans-serif;
  --ff-mono:    "JetBrains Mono", monospace;

  /* Spacing 8pt (unchanged) */
  --sp-xs: 4px;  --sp-sm: 8px;  --sp-md: 12px;
  --sp-lg: 16px; --sp-xl: 20px; --sp-2xl: 24px;
  --sp-3xl: 32px; --sp-4xl: 40px; --sp-5xl: 64px;

  /* Radii (unchanged slots) */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
  --r-xl: 20px; --r-2xl: 24px; --r-full: 9999px;

  --page-bg: #E6E1D8;
  --card-elevation: drop-shadow(0 1px 2px rgba(43, 33, 24, 0.06)) drop-shadow(0 4px 10px rgba(43, 33, 24, 0.07));
  --card-border: rgba(43, 33, 24, 0.10);
  --page-glow: #F0EBE2;
}

/* ===== Dark theme (opt-in; Pulse warm-graphite lands fully in S8 — until then legacy navy) ===== */
:root[data-theme="dark"] {
  --brand-deep: #064E5B;
  --brand-core: #0E7C7B;
  --brand-primary: #14B8A6;
  --brand-glow: #5EEAD4;
  --brand-tint: #CCFBF1;

  --canvas: #0A0F14;
  --surface-1: #121A22;
  --surface-2: #1A242E;
  --surface-3: #232F3B;
  --surface-glass: rgba(255, 255, 255, 0.04);

  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.12);
  --border-brand: rgba(94, 234, 212, 0.35);

  --text-primary: #ECECF1;
  --text-secondary: #9CA3AF;
  --text-tertiary: #6B7280;
  --text-quaternary: #4B5563;
  --text-inverse: #0A0F14;

  --success: #34D399;
  --warning: #F59E0B;
  --error: #F43F5E;
  --info: #60A5FA;

  --cat-physiology: #60A5FA;
  --cat-preference: #A78BFA;
  --cat-trigger:    #F59E0B;
  --cat-response:   #34D399;
  --cat-tendency:   #F472B6;
  --cat-goal-state: #5EEAD4;

  --tool-read:    rgba(94, 234, 212, 0.4);
  --tool-compute: var(--warning);
  --tool-write:   var(--brand-glow);

  --anchor-canvas:  #14110E;
  --anchor-surface: #1F1915;
  --anchor-accent:  #D97757;
  --anchor-text:    #E8DDD3;

  --page-bg: #050709;
  --card-elevation: none;
  --card-border: var(--border-subtle);
  --page-glow: #0c1218;
}
```

- [ ] **Step 5: Invert the pre-paint script + static meta in `index.html`**:

```html
<meta name="theme-color" content="#FBF6EF" />
```
```html
<script>
  (function () {
    var t = null
    try { t = localStorage.getItem('mezo-theme') } catch (e) {}
    /* Napív: light is the CSS base (no attribute). Only an explicit stored 'dark'
       adds data-theme="dark". Invalid/missing values fall through to light. */
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  })()
</script>
```

- [ ] **Step 6: Update `frontend/vite.config.ts` manifest colors** to `theme_color: '#FBF6EF'`, `background_color: '#E6E1D8'`.

- [ ] **Step 7: Fix dependent tests.** Run the suite; update `ThemeProvider.test.tsx` and `navigation.test.tsx` ("Me screen theme toggle flips data-theme") assertions to the new semantics — toggling to dark must yield `document.documentElement.getAttribute('data-theme') === 'dark'`, light must yield `null`. Keep test intents identical, only invert attribute expectations.

- [ ] **Step 8: Gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS both modes. Then visual smoke: light renders warm (canvas `#FBF6EF`), Me → Profil → gear → theme toggle flips to the legacy dark navy and back.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/styles/prototype.css frontend/src/shared/lib/theme.ts frontend/src/shared/lib/theme.test.ts frontend/index.html frontend/vite.config.ts frontend/src/app/ThemeProvider.test.tsx frontend/src/app/navigation.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fe/design): invert theme attribute semantics — :root is Napiv light, data-theme=dark opts in (mezo-8141)"
```

---

### Task 3: Frosted 4-tab bar + center „+" FAB + Quick-log sheet + Insights ✨ entry

**Files:**
- Modify: `frontend/src/app/TabBar.tsx`
- Modify: `frontend/src/app/TabBar.test.tsx`
- Modify: `frontend/src/shared/ui/Icon.tsx` (add `'plus'` to the `IconName` union + a `case` for it)
- Rewrite: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` + `QuickInputSheet.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (header ✨ → `/insights` link)
- Modify: `frontend/src/app/navigation.test.tsx` (Insights now reached via the Today ✨ button)
- Check: `frontend/src/app/shell.test.tsx` (any five-tab assumptions)
- Modify: `frontend/src/styles/prototype.css` (append `.tab-bar` frosted re-skin + `.tab-fab`)

**Interfaces:**
- Consumes: `Sheet` from `@/shared/ui/Sheet` (props: `children`/`onClose`/`className`/`labelledBy`, render-prop close idiom, conditional mount); `Icon` union; Task 1 tokens.
- Produces: `TabBar` rendering 4 `NavLink`s (`Ma → /today`, `Edzés → /train`, `Fuel → /fuel`, `Én → /me`) + a center `<button aria-label="Gyors logolás">` that conditionally mounts `QuickInputSheet`; `QuickInputSheet({ onClose })` — 6 tiles navigating to `/fuel`, `/train`, `/fuel` (víz), `/me/weight`, `/fuel/stack`, `/today` and closing. Insights entry: a `Link` with `aria-label="Insights"` in the Today header.

- [ ] **Step 1: Write the failing TabBar tests** — replace `frontend/src/app/TabBar.test.tsx` content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter>)
}

test('renders the four tab labels and no Insights tab', () => {
  renderAt('/today')
  for (const label of ['Ma', 'Edzés', 'Fuel', 'Én']) expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('Insights')).not.toBeInTheDocument()
})
test('marks the current route tab active', () => {
  renderAt('/fuel')
  expect(screen.getByText('Fuel').closest('a')!.className).toContain('active')
  expect(screen.getByText('Ma').closest('a')!.className).not.toContain('active')
})
test('the center + button opens the quick-log sheet', async () => {
  renderAt('/today')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.getByText('Gyors logolás', { selector: 'h2' })).toBeInTheDocument()
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/app/TabBar.test.tsx` → FAIL (old five labels).

- [ ] **Step 3: Add the `plus` glyph to `Icon.tsx`** — extend the `IconName` union with `'plus'` and add a case following the file's existing pattern:

```tsx
case 'plus':
  return <path d="M12 5v14M5 12h14" />
```

- [ ] **Step 4: Implement the new `TabBar.tsx`:**

```tsx
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

interface Tab { id: string; label: string; icon: IconName }
const LEFT: Tab[] = [
  { id: 'today', label: 'Ma', icon: 'today' },
  { id: 'train', label: 'Edzés', icon: 'train' },
]
const RIGHT: Tab[] = [
  { id: 'fuel', label: 'Fuel', icon: 'fuel' },
  { id: 'me', label: 'Én', icon: 'me' },
]

function TabItem({ t }: { t: Tab }) {
  return (
    <NavLink to={`/${t.id}`} className={({ isActive }) => cn('tab-item', isActive && 'active')}>
      <span className="tab-dot" />
      <Icon name={t.icon} size={22} />
      <span>{t.label}</span>
    </NavLink>
  )
}

export function TabBar() {
  const [quickOpen, setQuickOpen] = useState(false)
  return (
    <>
      <nav className="tab-bar">
        {LEFT.map(t => <TabItem key={t.id} t={t} />)}
        <button type="button" className="tab-fab" aria-label="Gyors logolás" onClick={() => setQuickOpen(true)}>
          <Icon name="plus" size={26} />
        </button>
        {RIGHT.map(t => <TabItem key={t.id} t={t} />)}
      </nav>
      {quickOpen && <QuickInputSheet onClose={() => setQuickOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 5: Rewrite `QuickInputSheet.tsx`** to the 6-tile quick-log design (navigation-only in S1; real quick-actions wire up in S4/S6/S7):

```tsx
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'

const ACTIONS = [
  { label: 'Étkezés', sub: 'recept vagy szabad', emoji: '🍽', to: '/fuel' },
  { label: 'Edzés', sub: 'indítás · jegyzet', emoji: '🏋️', to: '/train' },
  { label: 'Víz', sub: '+250 ml', emoji: '💧', to: '/fuel' },
  { label: 'Súly', sub: 'reggeli mérés', emoji: '⚖️', to: '/me/weight' },
  { label: 'Stack', sub: 'bevettem', emoji: '💊', to: '/fuel/stack' },
  { label: 'Check-in', sub: 'hogy vagyok', emoji: '❤️', to: '/today' },
] as const

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Sheet onClose={onClose} labelledBy="quicklog-title">
      {close => (
        <div className="quicklog">
          <h2 id="quicklog-title">Gyors logolás</h2>
          <p className="quicklog-sub">bármikor, két koppintás</p>
          <div className="quicklog-grid">
            {ACTIONS.map(a => (
              <button key={a.label} type="button" className="quicklog-tile"
                onClick={() => { close(); navigate(a.to) }}>
                <span className="quicklog-emoji" aria-hidden>{a.emoji}</span>
                <span className="quicklog-label">{a.label}</span>
                <span className="quicklog-hint">{a.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

Rewrite `QuickInputSheet.test.tsx` to match:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}
function renderSheet(onClose = () => {}) {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
    </MemoryRouter>,
  )
}

test('renders all six quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Edzés', 'Víz', 'Súly', 'Stack', 'Check-in'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('a tile closes the sheet and navigates to its target', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Súly'))
  expect(onClose).toHaveBeenCalled()
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})
```

(The `Sheet` primitive's render-prop `close` triggers the slide-down then calls `onClose` — if the animation defers `onClose` in jsdom, assert with `await vi.waitFor(() => expect(onClose).toHaveBeenCalled())`.)

- [ ] **Step 6: Append the frosted bar + FAB + quicklog CSS** to the Napív section of `prototype.css` (the old opaque `.tab-bar` rule stays higher in the file; this later block wins — delete the old block only in S8 cleanup):

```css
/* Napív tab bar — frosted floating capsule (supersedes mezo-ci5's opaque bar; blur+tint solves both recorded failure modes) */
.tab-bar {
  position: absolute; left: 14px; right: 14px; bottom: 14px;
  border-radius: 999px; border-top: none;
  background: color-mix(in srgb, var(--canvas) 66%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 14px 34px rgba(43,33,24,.16), inset 0 0 0 1px rgba(255,255,255,.55);
  padding: 10px 18px;
}
@supports not (backdrop-filter: blur(1px)) {
  .tab-bar { background: color-mix(in srgb, var(--canvas) 96%, transparent); }
}
.tab-fab {
  width: 56px; height: 56px; border-radius: 50%; border: 4px solid var(--canvas);
  margin-top: -34px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--coral), var(--amber)); color: #fff;
  box-shadow: 0 12px 26px rgba(255,107,74,.5), inset 0 1.5px 0 rgba(255,255,255,.35);
  cursor: pointer;
}
.quicklog { padding: 4px 6px 10px; }
.quicklog h2 { font-family: var(--ff-display); font-size: 19px; font-weight: 800; }
.quicklog-sub { font-size: 12px; color: var(--faint); font-weight: 600; margin-top: 2px; }
.quicklog-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 16px; }
.quicklog-tile {
  border-radius: 22px; padding: 16px 8px 14px; text-align: center;
  border: 1.5px solid var(--line); background: var(--canvas); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.quicklog-emoji { width: 42px; height: 42px; border-radius: 50%; background: var(--warm); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 6px; }
.quicklog-label { font-size: 12px; font-weight: 800; color: var(--ink); }
.quicklog-hint { font-size: 10px; color: var(--faint); font-weight: 700; }
```

Also check `.screen-content`'s `padding-bottom` (currently 96px for the docked bar): the floating capsule needs ~110px clearance — bump it in the same CSS section: `.screen-content { padding-bottom: 118px; }`.

- [ ] **Step 7: Add the Insights ✨ entry to `TodayPage.tsx`.** In the Today header row (the top brand/search row), add:

```tsx
<Link to="/insights" aria-label="Insights" className="icon-btn">
  <Icon name="sparkle" size={18} />
</Link>
```

with imports `import { Link } from 'react-router-dom'` and `Icon` if missing, plus append the `.icon-btn` class to the Napív CSS section:

```css
.icon-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--surface); box-shadow: var(--np-shadow-row); display: inline-flex; align-items: center; justify-content: center; color: var(--sub); }
```

- [ ] **Step 8: Update `navigation.test.tsx`** — the Insights navigation test now clicks the Today header button: `await userEvent.click(screen.getByLabelText('Insights'))` (route assertions unchanged). Fix any five-tab assumption in `shell.test.tsx`.

- [ ] **Step 9: Gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS both modes. Visual smoke: floating frosted bar, FAB opens the sheet, tiles navigate, ✨ reaches Insights, Insights sub-nav still fully works via URL.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/TabBar.tsx frontend/src/app/TabBar.test.tsx frontend/src/shared/ui/Icon.tsx frontend/src/features/quickinput/sheets/ frontend/src/features/today/pages/TodayPage.tsx frontend/src/app/navigation.test.tsx frontend/src/app/shell.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(fe/shell): frosted 4-tab bar with center quick-log FAB, Insights moves behind Today sparkle (mezo-8141)"
```

---

### Task 4: Retire the old-prototype parity harness (spec R3)

**Files:**
- Delete: `frontend/tests/parity/` (whole folder: `foundation.spec.ts`, `playwright.config.ts`, `README.md`)
- Modify: `frontend/package.json` (remove the `parity` script; KEEP `@playwright/test` devDependency — S8 reuses it for self-baselines)
- Modify: `CLAUDE.md` (root — remove the `pnpm parity` line from Build & Test)
- Check: `grep -rn "parity" docs/ CLAUDE.md frontend/package.json` — update `docs/infrastructure/local-dev-testing.md` and `docs/features/_platform-design-system.md` §8 mentions to state parity is retired by the Napív redesign (self-baselines return in S8).

**Interfaces:**
- Consumes: nothing. Produces: no `pnpm parity` script; CI must not reference it (check `.github/workflows/ci.yml` with `grep -n parity .github/workflows/*.yml` — if present, remove that step).

- [ ] **Step 1:** `git rm -r frontend/tests/parity` and delete the `"parity"` line from `frontend/package.json` scripts.
- [ ] **Step 2:** `grep -rn "parity" CLAUDE.md docs/ .github/ frontend/package.json` — edit every hit that instructs running it (root `CLAUDE.md` Build & Test block; `docs/infrastructure/local-dev-testing.md`; design-system doc §8) to note: *"pixel-parity vs the Phase-1 prototype retired 2026-07-13 by the Napív redesign (mezo-8141); visual self-baselines return in S8"*. Leave historical spec files untouched.
- [ ] **Step 3: Gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS.
- [ ] **Step 4: Commit**

```bash
git add -A
git -c core.hooksPath=/dev/null commit -m "chore(fe/test): retire old-prototype pixel-parity harness per Napiv spec R3 (mezo-8141)"
```

---

### Task 5: `daypart` helper (S2 start — pure logic, TDD)

**Files:**
- Create: `frontend/src/shared/lib/daypart.ts`
- Test: `frontend/src/shared/lib/daypart.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Daypart = 'reggel' | 'delutan' | 'este'`; `daypartForHour(hour: number): Daypart`; `daypartNow(now?: Date): Daypart`. Task 6 and S3's greeting logic consume these exact names.

- [ ] **Step 1: Write the failing test** (`daypart.test.ts`):

```ts
import { daypartForHour, daypartNow } from '@/shared/lib/daypart'

test('bands follow spec §3.4: reggel 04-11, delutan 12-17, este 18-03', () => {
  expect(daypartForHour(4)).toBe('reggel')
  expect(daypartForHour(11)).toBe('reggel')
  expect(daypartForHour(12)).toBe('delutan')
  expect(daypartForHour(17)).toBe('delutan')
  expect(daypartForHour(18)).toBe('este')
  expect(daypartForHour(23)).toBe('este')
  expect(daypartForHour(0)).toBe('este')
  expect(daypartForHour(3)).toBe('este')
})
test('daypartNow reads the hour from the given date', () => {
  expect(daypartNow(new Date('2026-07-13T06:30:00'))).toBe('reggel')
  expect(daypartNow(new Date('2026-07-13T14:00:00'))).toBe('delutan')
  expect(daypartNow(new Date('2026-07-13T21:00:00'))).toBe('este')
})
```

- [ ] **Step 2:** `pnpm vitest run src/shared/lib/daypart.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `daypart.ts`:

```ts
/** Circadian daypart bands (Napív spec §3.4): reggel 04:00–11:59 · délután 12:00–17:59 · este 18:00–03:59. */
export type Daypart = 'reggel' | 'delutan' | 'este'

export function daypartForHour(hour: number): Daypart {
  if (hour >= 4 && hour < 12) return 'reggel'
  if (hour >= 12 && hour < 18) return 'delutan'
  return 'este'
}

export function daypartNow(now: Date = new Date()): Daypart {
  return daypartForHour(now.getHours())
}
```

- [ ] **Step 4:** Re-run → PASS. Full gate (`pnpm test` both modes) → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/daypart.ts frontend/src/shared/lib/daypart.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/lib): daypart helper for the circadian layer (mezo-8141)"
```

---

### Task 6: Circadian sky band + daypart canvas tints in the shell

**Files:**
- Modify: `frontend/src/app/PhoneFrame.tsx`
- Test: `frontend/src/app/shell.test.tsx` (add daypart assertions)
- Modify: `frontend/src/styles/prototype.css` (Napív section: sky + tints)

**Interfaces:**
- Consumes: `daypartNow` from Task 5.
- Produces: `.phone-screen` carries `data-day="reggel|delutan|este"` (re-computed every 60s) and contains a `<div class="sky" aria-hidden="true" />` as its first painted layer; S3+ screens may key styling off `[data-day]`.

- [ ] **Step 1: Write the failing test** — add to `frontend/src/app/shell.test.tsx`:

```tsx
import { daypartNow } from '@/shared/lib/daypart'

test('the phone screen carries the current daypart and renders the sky band', () => {
  render(<MemoryRouter initialEntries={['/today']}><AppLayout /></MemoryRouter>)
  const screenEl = document.querySelector('.phone-screen')!
  expect(screenEl.getAttribute('data-day')).toBe(daypartNow())
  expect(screenEl.querySelector('.sky')).not.toBeNull()
})
```

(Match the file's existing render helper/providers — reuse whatever wrapper the sibling tests use.)

- [ ] **Step 2:** Run `pnpm vitest run src/app/shell.test.tsx` → FAIL.
- [ ] **Step 3: Implement in `PhoneFrame.tsx`:**

```tsx
import { cn } from '@/shared/lib/cn'
import { useEffect, useState, type ReactNode } from 'react'
import { StatusBar } from '@/app/StatusBar'
import { daypartNow, type Daypart } from '@/shared/lib/daypart'

export function PhoneFrame({ children, anchor = false, clock }: { children: ReactNode; anchor?: boolean; clock?: string }) {
  const [daypart, setDaypart] = useState<Daypart>(() => daypartNow())
  useEffect(() => {
    const id = setInterval(() => setDaypart(daypartNow()), 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="app-root">
      <div className="phone">
        <div className={cn('phone-screen', anchor && 'anchor')} data-day={daypart}>
          <div className="sky" aria-hidden="true" />
          <div className="dynamic-island" />
          <StatusBar clock={clock} />
          {children}
          <div className="home-indicator" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the circadian CSS** to the Napív section of `prototype.css` (values verbatim from spec §3.4):

```css
/* ===== Circadian atmosphere (every screen; spec §3.4) ===== */
.sky {
  position: absolute; top: 0; left: 0; right: 0; height: 295px; z-index: 0;
  pointer-events: none; transition: background 1s ease;
  -webkit-mask-image: linear-gradient(#000 55%, transparent);
  mask-image: linear-gradient(#000 55%, transparent);
}
.phone-screen { transition: background 1s ease; }
.phone-screen[data-day="reggel"] {
  background: #FCF1DF;
}
.phone-screen[data-day="reggel"] .sky {
  background: radial-gradient(440px 310px at 18% 0%, rgba(255,158,66,.45), transparent 72%),
              linear-gradient(180deg, #FFDDAE, #FFEDD4 55%, transparent);
}
.phone-screen[data-day="delutan"] .sky {
  background: radial-gradient(420px 260px at 50% -6%, rgba(255,199,115,.16), transparent 70%),
              linear-gradient(180deg, #FAF3E6, #FBF6EF 65%, transparent);
}
.phone-screen[data-day="este"] {
  background: #F3EDF2;
}
.phone-screen[data-day="este"] .sky {
  background: radial-gradient(440px 310px at 82% 2%, rgba(155,143,196,.4), transparent 72%),
              linear-gradient(180deg, #E2D9EF, #F0E9E9 62%, transparent);
}
/* Dark theme: the sky dims until the Pulse dark pass (S8) designs its own night variants. */
:root[data-theme="dark"] .sky { opacity: .18; }
/* AnchorMode: rough days mute the atmosphere (full anchor remap lands with Today in S3). */
.phone-screen.anchor .sky { opacity: .35; filter: saturate(.6); }
```

Verify stacking: `.sky` must not cover content. If `.screen-content` has no `position`, add `.screen-content { position: relative; z-index: 1; }` to the same section (and the same for `.status-bar` if it paints under).

- [ ] **Step 5:** Re-run shell test → PASS. Full gate both modes → PASS.
- [ ] **Step 6: Visual smoke with forced dayparts** — in the running app's DevTools: `document.querySelector('.phone-screen').setAttribute('data-day','reggel')` then `'este'` — the band + canvas shift warm-gold / neutral / lavender on every tab.
- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/PhoneFrame.tsx frontend/src/app/shell.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(fe/shell): circadian sky band + daypart canvas tints on every screen (mezo-8141)"
```

---

### Task 7: Motion utility classes + reduced-motion kill-switch

**Files:**
- Modify: `frontend/src/styles/prototype.css` (Napív section)

**Interfaces:**
- Consumes: Task 1 easing tokens.
- Produces: utility classes S3–S7 will apply: `.np-anim` (staggered rise via `--i`), `.np-press` (spring press), keyframes `np-rise`, `np-pop`, `np-grow`, `np-draw`; all disabled under reduced motion.

- [ ] **Step 1: Append the motion vocabulary:**

```css
/* ===== Napív motion vocabulary (spec §3.5) ===== */
@keyframes np-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes np-pop  { 0% { opacity: 0; transform: scale(.3); } 70% { transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
@keyframes np-grow { to { transform: scaleX(1); } }
@keyframes np-draw { to { stroke-dashoffset: 0; } }

.np-anim { opacity: 0; animation: np-rise .55s var(--np-ease-ios) forwards; animation-delay: calc(var(--i, 0) * 70ms); }
.np-press { transition: transform .18s var(--np-ease-spring); }
.np-press:active { transform: scale(.955); }

@media (prefers-reduced-motion: reduce) {
  .np-anim { animation: none; opacity: 1; }
  .np-press, .np-press:active { transition: none; transform: none; }
  .sky, .phone-screen { transition: none; }
}
```

- [ ] **Step 2: Gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS (no component consumes these yet; this is the S3–S7 contract).
- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(fe/design): Napiv motion utility classes with reduced-motion kill-switch (mezo-8141)"
```

---

### Task 8: Slice close — living docs, lint, full gate, handoff

**Files:**
- Modify: `docs/features/_platform-design-system.md` (§1 one-liner + tokens, §2.1 shell/tab-bar/quick-log, §2.2 theme semantics, new circadian entry in §2, §5 QuickInput seam row, §8 parity note, §9 gotchas, §10 key files)
- Check: `node scripts/lint-docs.mjs`

**Interfaces:** none — documentation of Tasks 1–7.

- [ ] **Step 1: Update `docs/features/_platform-design-system.md`** in place (overwrite, no changelog):
  - §1: system renamed **"Napív"** (Deep Current v2 superseded 2026-07-13, spec link `2026-07-13-napiv-frontend-redesign-design.md`); token vocabulary summary (warm neutrals + coral/amber/sage/lav/rose/sky domain accents; Bricolage + Jakarta; pills + 20–28px radii).
  - §2.1: tab bar = frosted floating capsule, 4 tabs (`Ma · Edzés · Fuel · Én`) + center „+" FAB → `QuickInputSheet` (remounted); Insights entry = Today header ✨.
  - §2.2: **theme semantics inverted** — `:root` is the light base, `data-theme="dark"` opts into dark; pre-paint script + `theme.ts` + manifest all flipped; the old "never add data-theme=dark" gotcha in §9 is replaced by "never add data-theme=light".
  - §2 new item: circadian atmosphere (`daypart.ts` bands, `.sky`, `[data-day]` tints, dark/anchor dimming).
  - §5: QuickInput seam row updated (trigger = TabBar FAB).
  - §8: parity retired (R3); §10: add `daypart.ts`, updated file notes.
- [ ] **Step 2:** `node scripts/lint-docs.mjs` → 0 errors (fix staleness flags it reports for the touched doc).
- [ ] **Step 3: Full gate one last time** — `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS both modes.
- [ ] **Step 4: bd + commit + push**

```bash
bd update mezo-8141 --notes "S1+S2 landed: Napiv tokens/fonts/theme-inversion/rounded pass, frosted 4-tab bar + quick-log FAB, Insights via Today sparkle, parity retired, daypart+sky+motion utilities. Next: S3 Today plan."
git add docs/features/_platform-design-system.md docs/superpowers/plans/2026-07-13-napiv-s1-s2-foundation.md
git -c core.hooksPath=/dev/null commit -m "docs(features): design-system doc rewritten for Napiv S1+S2 foundation (mezo-8141)"
git push -u origin feat/frontend-design-rethink
```

---

## Out of scope here (their own plans, in order)

S3 Today (napív component, hero, brief collapse, Growth-row, anchor remap) → S4 Train → S5 Active workout (Live-Activity island) → S6 Fuel → S7 Me → S8 Insights re-skin + Pulse dark theme + Deep-Current class cleanup + visual self-baselines. Each plan is written when its slice starts, against the then-current code.
