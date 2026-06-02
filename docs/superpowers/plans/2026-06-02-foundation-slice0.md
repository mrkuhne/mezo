# Foundation (Slice 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Mezo frontend project and build the design-system foundation — tokens, signature primitives, the iPhone-screen app shell, 5-tab navigation, theme switching, and a pixel-parity verification harness — so every later feature slice (Today, Me, Fuel, Insights, Train) is built by composing finished primitives.

**Architecture:** Vite + React 19 + TypeScript SPA/PWA. The locked design lives in the handoff prototype (`/Users/daniel.kuhne/Downloads/design_handoff_mezo/`). We port `prototype/styles.css` **verbatim** as the design contract, add a Tailwind v4 `@theme inline` mapping on top so utilities resolve to the same runtime CSS variables, and rebuild the prototype's `window.*` components as real, typed, imported React components organized feature-sliced. Theme is dark-first; light is a `[data-theme="light"]` override flipped at runtime and persisted to `localStorage`.

**Tech Stack:** pnpm · Vite 6 · React 19 · TypeScript 5 · Tailwind CSS v4 (`@tailwindcss/vite`) · react-router-dom v7 · vite-plugin-pwa · Vitest + React Testing Library (jsdom) · Playwright (parity screenshots).

**Source-of-truth files (read while implementing):**
- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/styles.css` — every CSS value (725 lines).
- `.../prototype/src/icons.jsx` — the icon set (port verbatim to TSX).
- `.../prototype/src/frame.jsx` — PhoneFrame, StatusBar, TabBar, FAB, ToolChipRow, RefTag.
- `.../prototype/src/app.jsx` — shell/nav/theme wiring reference.
- `.../01-design-system.md`, `.../03-components.md` — token tables + component catalog.

**Conventions for every task:** TypeScript strict. Components in `PascalCase.tsx`, one primary export per file. Keep Hungarian copy verbatim. Min 44px touch targets. No `dangerouslySetInnerHTML`. Commit after each task with an English message ending in the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer (the beads pre-commit hook runs `bd export` — a single serialized commit is fine).

**Target file structure produced by this slice:**
```
index.html                 # fonts + no-flash theme restore script + #root
vite.config.ts             # react + tailwind + pwa + vitest config
tsconfig.json / tsconfig.node.json
package.json
public/logo.svg            # brand "M" glyph (PWA icon source)
src/
  main.tsx                 # React root + router + ThemeProvider
  index.css                # @import tailwindcss + @theme inline mapping + imports
  vite-env.d.ts
  test/setup.ts            # RTL + jest-dom
  styles/
    prototype.css          # VERBATIM copy of prototype/styles.css (design contract)
  lib/
    cn.ts                  # className join helper
    safeMarkdown.tsx       # safe **bold** inline renderer (replaces innerHTML)
    theme.ts               # theme storage + types
  app/
    ThemeProvider.tsx      # data-theme + localStorage, useTheme()
    PhoneFrame.tsx         # bezel + status bar + home indicator (dev/preview chrome)
    StatusBar.tsx          # clock + StatusIcons
    ScreenContent.tsx      # scroll area (under status bar, above tab bar)
    TabBar.tsx             # 5-tab bottom nav (NavLink active)
    Fab.tsx                # circular mic FAB
    AppLayout.tsx          # PhoneFrame > [Outlet in ScreenContent] + Fab + TabBar
    router.tsx             # routes: /today /train /fuel /insights /me
  components/ui/
    Icon.tsx               # typed icon set + BrandGlyph + StatusIcons
    Eyebrow.tsx  LabelMono.tsx  Display.tsx  PageTitle.tsx
    NotchCard.tsx
    Chip.tsx  ToolChip.tsx  ToolChipRow.tsx  RefTag.tsx
    Cta.tsx  ProgressBar.tsx
    Sheet.tsx
  features/
    today/TodayScreen.tsx        # placeholder
    train/TrainScreen.tsx        # placeholder
    fuel/FuelScreen.tsx          # placeholder
    insights/InsightsScreen.tsx  # placeholder
    me/MeScreen.tsx              # placeholder + temporary theme toggle
tests/parity/                    # Playwright config + screenshot harness
```

---

## Task 1: Project scaffold (pnpm + Vite + React + TS + Vitest)

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx` (temporary), `src/index.css` (temporary), `src/vite-env.d.ts`, `src/test/setup.ts`
- Modify: `.gitignore` (already has Node/dist entries from bd init — verify they cover `node_modules/`, `dist/`)

- [ ] **Step 1: Initialize package + install deps**

Run from repo root (`/Users/daniel.kuhne/MrKuhne/mezo`):
```bash
pnpm init
pnpm add react react-dom react-router-dom
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite vite-plugin-pwa \
  vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom \
  @playwright/test
pnpm exec playwright install chromium
```
Expected: `node_modules/` populated, `package.json` lists the deps. (Use whatever versions the resolver picks; these are all current major lines: Vite 6, React 19, Tailwind 4, Vitest 3, react-router 7.)

- [ ] **Step 2: Add scripts to `package.json`**

Merge into `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "parity": "playwright test --config tests/parity/playwright.config.ts"
  }
}
```

- [ ] **Step 3: Create TS configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tests/parity/playwright.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts` (with Vitest + path alias)**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mezo',
        short_name: 'Mezo',
        description: 'Holistic AI performance & health companion',
        theme_color: '#0A0F14',
        background_color: '#050709',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```
> Note: PWA icons are generated in Task 14. Until then `pnpm build` still works; the dev server ignores missing icons.

- [ ] **Step 5: Create `index.html` (fonts + no-flash theme restore)**

```html
<!doctype html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0F14" />
    <title>Mezo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap"
      rel="stylesheet"
    />
    <script>
      (function () {
        try {
          var t = localStorage.getItem('mezo-theme')
          if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
        } catch (e) {}
      })()
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create temporary entry files so the app boots**

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```
`src/index.css` (temporary — replaced in Task 2):
```css
@import "tailwindcss";
```
`src/App.tsx` (temporary — replaced in Task 13):
```tsx
export default function App() {
  return <div className="text-text-primary">Mezo boot OK</div>
}
```
`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 7: Write a smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('app boots', () => {
  render(<App />)
  expect(screen.getByText('Mezo boot OK')).toBeInTheDocument()
})
```

- [ ] **Step 8: Verify dev server, types, and tests**

Run:
```bash
pnpm dev --port 5173 &   # then open http://localhost:5173 — expect "Mezo boot OK"; kill after
pnpm test
pnpm build
```
Expected: `pnpm test` → 1 passed. `pnpm build` → succeeds (PWA icon warnings are OK for now).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(frontend): scaffold Vite + React + TS + Tailwind v4 + PWA + Vitest

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Design tokens + Tailwind theme mapping (the design contract)

**Files:**
- Create: `src/styles/prototype.css` (verbatim copy of the prototype stylesheet)
- Modify: `src/index.css` (Tailwind import + `@theme inline` mapping + import the prototype CSS)
- Test: `src/styles/tokens.test.tsx`

- [ ] **Step 1: Copy the prototype stylesheet verbatim**

```bash
cp "/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/styles.css" src/styles/prototype.css
```
This file is the **design contract** — do not edit its values. It contains: the `:root` token block (lines 3–79), the `:root[data-theme="light"]` overrides (81–135), the `.notch-*` clip-path utilities (137–142), base resets + the iPhone shell / status bar / tab bar / FAB / home-indicator (144–280), and every component class (`.eyebrow`, `.card`, `.chip`, `.toolchip`, `.cta-primary`, `.fab`, `.bar`, `.sheet`, `.reta-bar`, `.checkin-strip`, `.stepper`, `.rir-row`, `.macro-bar`, `.subnav`, etc., 282–725).

- [ ] **Step 2: Replace `src/index.css` with the Tailwind entry + token mapping**

Tailwind v4 utilities must resolve to the **same runtime variables** the prototype CSS uses (so `bg-surface-1` and the ported `.card` both honor the active theme). Use `@theme inline` so Tailwind emits `var(--…)` references rather than baking static values:

```css
@import "tailwindcss";
@import "./styles/prototype.css";

/* Map Tailwind v4 design tokens onto the prototype's runtime CSS variables.
   `inline` => utilities emit var(--…) refs, so [data-theme="light"] flips them live. */
@theme inline {
  --color-brand-deep: var(--brand-deep);
  --color-brand-core: var(--brand-core);
  --color-brand-primary: var(--brand-primary);
  --color-brand-glow: var(--brand-glow);
  --color-brand-tint: var(--brand-tint);

  --color-canvas: var(--canvas);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);

  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-quaternary: var(--text-quaternary);
  --color-text-inverse: var(--text-inverse);

  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--error);
  --color-info: var(--info);

  --color-cat-physiology: var(--cat-physiology);
  --color-cat-preference: var(--cat-preference);
  --color-cat-trigger: var(--cat-trigger);
  --color-cat-response: var(--cat-response);
  --color-cat-tendency: var(--cat-tendency);
  --color-cat-goal-state: var(--cat-goal-state);

  --color-anchor-canvas: var(--anchor-canvas);
  --color-anchor-surface: var(--anchor-surface);
  --color-anchor-accent: var(--anchor-accent);
  --color-anchor-text: var(--anchor-text);

  --font-display: var(--ff-display);
  --font-body: var(--ff-body);
  --font-mono: var(--ff-mono);
}
```

- [ ] **Step 3: Write a token test**

`src/styles/tokens.test.tsx` — assert the dark default and light override resolve on `:root`:
```tsx
import { beforeAll } from 'vitest'

beforeAll(() => {
  // jsdom doesn't run @import; inject the raw variable blocks the test asserts on.
  const style = document.createElement('style')
  style.textContent = `
    :root { --canvas:#0A0F14; --surface-1:#121A22; --brand-glow:#5EEAD4; }
    :root[data-theme="light"] { --canvas:#F4F6F8; --surface-1:#FFFFFF; --brand-glow:#0E7C7B; }
  `
  document.head.appendChild(style)
})

test('dark tokens are the default', () => {
  document.documentElement.removeAttribute('data-theme')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--canvas').trim()).toBe('#0A0F14')
})

test('light theme overrides tokens', () => {
  document.documentElement.setAttribute('data-theme', 'light')
  const s = getComputedStyle(document.documentElement)
  expect(s.getPropertyValue('--surface-1').trim()).toBe('#FFFFFF')
  document.documentElement.removeAttribute('data-theme')
})
```
> Why inject rather than import: jsdom does not resolve CSS `@import`. This test guards the **contract values** we depend on; true visual fidelity is verified by the Playwright parity harness (Task 15), not jsdom.

- [ ] **Step 4: Run tests + visually verify**

```bash
pnpm test
```
Expected: token tests pass. Then `pnpm dev`, open the app — body background should be the dark canvas radial gradient and text the light primary color (the temporary App text is now on the dark canvas).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): port design tokens + map Tailwind v4 theme to runtime vars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: lib helpers — `cn()` and safe `**bold**` renderer

**Files:**
- Create: `src/lib/cn.ts`, `src/lib/safeMarkdown.tsx`
- Test: `src/lib/cn.test.ts`, `src/lib/safeMarkdown.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/lib/cn.test.ts`:
```ts
import { cn } from './cn'

test('joins truthy class names and skips falsy', () => {
  expect(cn('a', false, 'b', undefined, null, 'c')).toBe('a b c')
})
test('returns empty string for no truthy parts', () => {
  expect(cn(false, undefined)).toBe('')
})
```
`src/lib/safeMarkdown.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { SafeMarkdown } from './safeMarkdown'

test('renders **bold** as <strong> without raw HTML injection', () => {
  const { container } = render(<SafeMarkdown text="hello **world**" />)
  expect(container.querySelector('strong')?.textContent).toBe('world')
})
test('escapes/ignores embedded HTML (no XSS)', () => {
  const { container } = render(<SafeMarkdown text={'<img src=x onerror=alert(1)> **safe**'} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  expect(container.querySelector('strong')?.textContent).toBe('safe')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test src/lib
```
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/lib/cn.ts`:
```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
```
`src/lib/safeMarkdown.tsx` — splits on `**…**` and emits text/`<strong>` React nodes; raw HTML stays inert text because React escapes it (no `dangerouslySetInnerHTML`):
```tsx
import { Fragment, type ReactNode } from 'react'

/** Renders a tiny markdown subset (**bold**) as React nodes. Anything else,
 *  including raw HTML, is rendered as plain escaped text. */
export function SafeMarkdown({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part)
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): add cn() and SafeMarkdown (XSS-safe **bold** renderer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Theme system — storage, provider, `useTheme`

**Files:**
- Create: `src/lib/theme.ts`, `src/app/ThemeProvider.tsx`
- Test: `src/lib/theme.test.ts`, `src/app/ThemeProvider.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/lib/theme.test.ts`:
```ts
import { readStoredTheme, writeStoredTheme, applyTheme, THEME_KEY } from './theme'

beforeEach(() => localStorage.clear())

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
```
`src/app/ThemeProvider.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>theme:{theme}</button>
}

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })

test('defaults to dark and toggles to light, persisting + setting data-theme', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByText('theme:light')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  expect(localStorage.getItem('mezo-theme')).toBe('light')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test src/lib/theme.test.ts src/app/ThemeProvider.test.tsx
```
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement storage + provider**

`src/lib/theme.ts`:
```ts
export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'

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
/** Dark is the default => no attribute; light => data-theme="light". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
}
```
`src/app/ThemeProvider.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, readStoredTheme, writeStoredTheme, type Theme } from '@/lib/theme'

interface ThemeContextValue { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'dark')

  useEffect(() => { applyTheme(theme); writeStoredTheme(theme) }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState(p => (p === 'dark' ? 'light' : 'dark')), [])

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/theme.test.ts src/app/ThemeProvider.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): theme storage + ThemeProvider (dark-first, persisted)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Icon set (typed) + BrandGlyph + StatusIcons

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Test: `src/components/ui/Icon.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/ui/Icon.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { Icon, BrandGlyph } from './Icon'

test('renders an svg for a known icon name', () => {
  const { container } = render(<Icon name="today" />)
  expect(container.querySelector('svg')).toBeTruthy()
})
test('applies the size prop to width/height', () => {
  const { container } = render(<Icon name="mic" size={10} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('width')).toBe('10')
  expect(svg.getAttribute('height')).toBe('10')
})
test('BrandGlyph renders an svg', () => {
  const { container } = render(<BrandGlyph />)
  expect(container.querySelector('svg')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test src/components/ui/Icon.test.tsx
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement — port `icons.jsx` verbatim to TSX**

Open `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/icons.jsx` and reproduce every `case` exactly (same SVG paths). Add a typed `IconName` union and TS types. The full source is in the prototype file; the union must include every case there:
`today, train, fuel, insights, me, mic, camera, plus, minus, check, x, chevron-right, chevron-down, chevron-up, send, heart, bookmark, settings, search, drop, pill, warning, sparkle, anchor, graph, tool, sun, moon, voice-wave`.

`src/components/ui/Icon.tsx` skeleton (fill EVERY case from the prototype, paths verbatim):
```tsx
export type IconName =
  | 'today' | 'train' | 'fuel' | 'insights' | 'me'
  | 'mic' | 'camera' | 'plus' | 'minus' | 'check' | 'x'
  | 'chevron-right' | 'chevron-down' | 'chevron-up' | 'send' | 'heart'
  | 'bookmark' | 'settings' | 'search' | 'drop' | 'pill' | 'warning'
  | 'sparkle' | 'anchor' | 'graph' | 'tool' | 'sun' | 'moon' | 'voice-wave'

interface IconProps { name: IconName; size?: number; color?: string; strokeWidth?: number }

export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.5 }: IconProps) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'today':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6.5 L12 12 L15.5 14" />
          <path d="M3.5 12 L5 12" />
          <path d="M19 12 L20.5 12" />
        </svg>
      )
    // … reproduce ALL remaining cases from prototype/src/icons.jsx verbatim …
    default:
      return null
  }
}

export function BrandGlyph({ size = 24, color = 'var(--brand-glow)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 19 V5 L8 13 L12 8 L16 13 L21 5 V19" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatusIcons() {
  return (
    <div className="status-icons">
      <svg viewBox="0 0 18 12"><path d="M0 10 H3 V12 H0 Z M5 7 H8 V12 H5 Z M10 4 H13 V12 H10 Z M15 0 H18 V12 H15 Z" /></svg>
      <svg viewBox="0 0 18 14"><path d="M9 0 C5 0 1.5 1.5 0 3.5 L2 5.5 C3 4 6 3 9 3 C12 3 15 4 16 5.5 L18 3.5 C16.5 1.5 13 0 9 0 Z M9 5 C7 5 5 5.5 4 6.5 L6 8.5 C7 7.5 8 7 9 7 C10 7 11 7.5 12 8.5 L14 6.5 C13 5.5 11 5 9 5 Z M9 9 C8.5 9 8 9.2 7.5 9.7 L9 11.5 L10.5 9.7 C10 9.2 9.5 9 9 9 Z" /></svg>
      <svg viewBox="0 0 26 12"><rect x="0" y="1" width="22" height="10" rx="2.5" stroke="white" strokeWidth="1" fill="none" /><rect x="2" y="3" width="18" height="6" rx="1" /><rect x="23" y="4" width="2" height="4" rx="1" /></svg>
    </div>
  )
}
```
> Verbatim fidelity matters: copy each `<svg>` body from the prototype exactly. The parity harness (Task 15) will catch any path mismatch on the tab bar icons.

- [ ] **Step 4: Run tests**

```bash
pnpm test src/components/ui/Icon.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): port typed icon set + BrandGlyph + StatusIcons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Text primitives — Eyebrow, LabelMono, Display, PageTitle

**Files:**
- Create: `src/components/ui/Eyebrow.tsx`, `LabelMono.tsx`, `Display.tsx`, `PageTitle.tsx`
- Test: `src/components/ui/text.test.tsx`

These map onto the verbatim classes `.eyebrow`/`.eyebrow.brand`, `.label-mono`, `.h-display.size-*`, `.page-title` (in `src/styles/prototype.css`).

- [ ] **Step 1: Write failing tests**

`src/components/ui/text.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { Eyebrow } from './Eyebrow'
import { LabelMono } from './LabelMono'
import { Display } from './Display'
import { PageTitle } from './PageTitle'

test('Eyebrow renders text and brand modifier', () => {
  const { rerender } = render(<Eyebrow>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow')
  rerender(<Eyebrow brand>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow brand')
})
test('LabelMono renders', () => {
  render(<LabelMono>SÚLY</LabelMono>)
  expect(screen.getByText('SÚLY').className).toBe('label-mono')
})
test('Display applies size class', () => {
  render(<Display size="xl">42</Display>)
  expect(screen.getByText('42').className).toBe('h-display size-xl')
})
test('PageTitle renders an h1', () => {
  render(<PageTitle>Ma</PageTitle>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma')
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm test src/components/ui/text.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`src/components/ui/Eyebrow.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function Eyebrow({ children, brand = false, className }: { children: ReactNode; brand?: boolean; className?: string }) {
  return <span className={cn('eyebrow', brand && 'brand', className)}>{children}</span>
}
```
`src/components/ui/LabelMono.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function LabelMono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('label-mono', className)}>{children}</span>
}
```
`src/components/ui/Display.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type DisplaySize = 'xl' | 'lg' | 'md' | 'sm'
export function Display({ children, size = 'md', className }: { children: ReactNode; size?: DisplaySize; className?: string }) {
  return <div className={cn('h-display', `size-${size}`, className)}>{children}</div>
}
```
`src/components/ui/PageTitle.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('page-title', className)}>{children}</h1>
}
```

- [ ] **Step 4: Run tests** — `pnpm test src/components/ui/text.test.tsx` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): text primitives (Eyebrow, LabelMono, Display, PageTitle)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Surface primitive — NotchCard

**Files:**
- Create: `src/components/ui/NotchCard.tsx`
- Test: `src/components/ui/NotchCard.test.tsx`

Maps onto `.card`, `.card.glass`, `.notch-8`/`.notch-12`, `.accent-strip` (verbatim CSS).

- [ ] **Step 1: Write failing test**

`src/components/ui/NotchCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { NotchCard } from './NotchCard'

test('default card has card + notch-8 classes', () => {
  render(<NotchCard>body</NotchCard>)
  const el = screen.getByText('body')
  expect(el.className).toContain('card')
  expect(el.className).toContain('notch-8')
})
test('glass + notch=12 + accent renders modifiers and the accent strip', () => {
  render(<NotchCard glass notch={12} accent="warning">body</NotchCard>)
  const el = screen.getByText('body')
  expect(el.className).toContain('glass')
  expect(el.className).toContain('notch-12')
  expect(el.querySelector('.accent-strip')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/components/ui/NotchCard.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { CSSProperties, ReactNode } from 'react'

type Notch = 4 | 8 | 12
type Accent = 'brand' | 'warning' | 'error' | 'tendency'
const ACCENT_COLOR: Record<Accent, string> = {
  brand: 'var(--brand-glow)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  tendency: 'var(--cat-tendency)',
}

interface NotchCardProps {
  children: ReactNode
  notch?: Notch
  glass?: boolean
  accent?: Accent
  className?: string
  style?: CSSProperties
}

export function NotchCard({ children, notch = 8, glass = false, accent, className, style }: NotchCardProps) {
  return (
    <div
      className={cn('card', glass && 'glass', `notch-${notch}`, className)}
      style={{ position: accent ? 'relative' : undefined, ...style }}
    >
      {accent && (
        <span
          className="accent-strip"
          style={{ background: ACCENT_COLOR[accent], boxShadow: `0 0 8px ${ACCENT_COLOR[accent]}` }}
        />
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run tests** — PASS (2).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): NotchCard surface primitive (notch, glass, accent strip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Chips — Chip, ToolChip, ToolChipRow, RefTag

**Files:**
- Create: `src/components/ui/Chip.tsx`, `ToolChip.tsx`, `ToolChipRow.tsx`, `RefTag.tsx`
- Test: `src/components/ui/chips.test.tsx`

Maps onto `.chip`(+`.brand/.warning/.error`), `.toolchip`(+`.read/.compute/.write`); `ToolChipRow`/`RefTag` mirror `frame.jsx`.

- [ ] **Step 1: Write failing tests**

`src/components/ui/chips.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'
import { ToolChip } from './ToolChip'
import { ToolChipRow } from './ToolChipRow'
import { RefTag } from './RefTag'

test('Chip applies variant', () => {
  render(<Chip variant="warning">NIGGLE</Chip>)
  expect(screen.getByText('NIGGLE').className).toBe('chip warning notch-4')
})
test('ToolChip applies tool type and shows name', () => {
  render(<ToolChip type="read" name="sleep_db" />)
  const el = screen.getByText(/sleep_db/)
  expect(el.className).toContain('toolchip')
  expect(el.className).toContain('read')
})
test('ToolChip shows args when given', () => {
  render(<ToolChip type="compute" name="calc" args="tdee" />)
  expect(screen.getByText(/\(tdee\)/)).toBeInTheDocument()
})
test('ToolChipRow renders one chip per tool', () => {
  render(<ToolChipRow tools={[{ type: 'read', name: 'a' }, { type: 'write', name: 'b' }]} />)
  expect(screen.getByText(/a/)).toBeInTheDocument()
  expect(screen.getByText(/b/)).toBeInTheDocument()
})
test('RefTag formats [kind] label', () => {
  render(<RefTag kind="ref" label="Alvás" />)
  expect(screen.getByText(/\[ref\]/)).toBeInTheDocument()
  expect(screen.getByText(/Alvás/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/components/ui/Chip.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type ChipVariant = 'default' | 'brand' | 'warning' | 'error'
export function Chip({ children, variant = 'default', className }: { children: ReactNode; variant?: ChipVariant; className?: string }) {
  return <span className={cn('chip', variant !== 'default' && variant, 'notch-4', className)}>{children}</span>
}
```
`src/components/ui/ToolChip.tsx`:
```tsx
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

export type ToolType = 'read' | 'compute' | 'write'
export interface Tool { type: ToolType; name: string; args?: string }

export function ToolChip({ type, name, args, className }: Tool & { className?: string }) {
  return (
    <span className={cn('toolchip', type, 'notch-4', className)}>
      <Icon name="tool" size={10} />
      {name}
      {args && <span style={{ opacity: 0.7 }}>({args})</span>}
    </span>
  )
}
```
`src/components/ui/ToolChipRow.tsx`:
```tsx
import type { Tool } from './ToolChip'
import { ToolChip } from './ToolChip'

export function ToolChipRow({ tools }: { tools: Tool[] }) {
  return (
    <div className="row gap-sm flex-wrap" style={{ marginBottom: 10 }}>
      {tools.map((t, i) => (
        <ToolChip key={i} {...t} />
      ))}
    </div>
  )
}
```
`src/components/ui/RefTag.tsx`:
```tsx
export function RefTag({ kind, label }: { kind: string; label: string }) {
  return (
    <span className="toolchip" style={{ padding: '2px 6px', fontSize: 9 }}>
      [{kind}]&nbsp;{label}
    </span>
  )
}
```

- [ ] **Step 4: Run tests** — PASS (5).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): Chip, ToolChip, ToolChipRow, RefTag (AI-transparency motif)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Buttons + ProgressBar — Cta, ProgressBar

**Files:**
- Create: `src/components/ui/Cta.tsx`, `src/components/ui/ProgressBar.tsx`
- Test: `src/components/ui/cta.test.tsx`, `src/components/ui/progressbar.test.tsx`

Maps onto `.cta-primary`(+`.notch-8`), `.cta-ghost`, `.bar`/`.bar-fill`(+`.glow/.warning/.error`).

- [ ] **Step 1: Write failing tests**

`src/components/ui/cta.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CtaPrimary, CtaGhost } from './Cta'

test('CtaPrimary fires onClick and carries classes', async () => {
  const onClick = vi.fn()
  render(<CtaPrimary onClick={onClick}>INDÍTÁS</CtaPrimary>)
  const btn = screen.getByRole('button', { name: 'INDÍTÁS' })
  expect(btn.className).toContain('cta-primary')
  expect(btn.className).toContain('notch-8')
  await userEvent.click(btn)
  expect(onClick).toHaveBeenCalledOnce()
})
test('CtaGhost renders', () => {
  render(<CtaGhost>MÉGSE</CtaGhost>)
  expect(screen.getByRole('button', { name: 'MÉGSE' }).className).toContain('cta-ghost')
})
```
`src/components/ui/progressbar.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'

test('clamps value to 0..100 and applies tone fill', () => {
  const { container } = render(<ProgressBar value={150} tone="warning" />)
  const fill = container.querySelector('.bar-fill') as HTMLElement
  expect(fill.className).toContain('warning')
  expect(fill.style.width).toBe('100%')
})
test('negative value clamps to 0', () => {
  const { container } = render(<ProgressBar value={-20} />)
  expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('0%')
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/components/ui/Cta.tsx`:
```tsx
import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function CtaPrimary({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-primary', 'notch-8', className)} {...rest}>{children}</button>
}
export function CtaGhost({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-ghost', 'notch-8', className)} {...rest}>{children}</button>
}
```
`src/components/ui/ProgressBar.tsx`:
```tsx
import { cn } from '@/lib/cn'

type Tone = 'glow' | 'warning' | 'error'
export function ProgressBar({ value, tone = 'glow', className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('bar', className)}>
      <div className={cn('bar-fill', tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests** — PASS (4).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): CtaPrimary, CtaGhost, ProgressBar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Sheet primitive (bottom modal)

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Test: `src/components/ui/Sheet.test.tsx`

Maps onto `.sheet-backdrop`, `.sheet`(24px top corners), `.sheet-handle`. Behavior: closes on backdrop click and Escape; renders a drag handle; content scrolls.

- [ ] **Step 1: Write failing tests**

`src/components/ui/Sheet.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from './Sheet'

test('renders handle + children', () => {
  render(<Sheet onClose={() => {}}><p>tartalom</p></Sheet>)
  expect(screen.getByText('tartalom')).toBeInTheDocument()
  expect(document.querySelector('.sheet-handle')).toBeTruthy()
})
test('closes on backdrop click', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.click(document.querySelector('.sheet-backdrop')!)
  expect(onClose).toHaveBeenCalledOnce()
})
test('does not close when clicking inside the sheet', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>belül</p></Sheet>)
  await userEvent.click(screen.getByText('belül'))
  expect(onClose).not.toHaveBeenCalled()
})
test('closes on Escape', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/components/ui/Sheet.tsx`:
```tsx
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SheetProps {
  children: ReactNode
  onClose: () => void
  className?: string
  labelledBy?: string
}

export function Sheet({ children, onClose, className, labelledBy }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={cn('sheet', className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  )
}
```
> Background scroll-lock is handled by the verbatim CSS rule `.phone-screen:has(.sheet-backdrop) .screen-content { overflow:hidden }` ported in Task 2 — no JS needed.

- [ ] **Step 4: Run tests** — PASS (4).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): Sheet bottom-modal primitive (backdrop/esc close, a11y dialog)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: App shell — PhoneFrame, StatusBar, ScreenContent, Fab

**Files:**
- Create: `src/app/StatusBar.tsx`, `src/app/PhoneFrame.tsx`, `src/app/ScreenContent.tsx`, `src/app/Fab.tsx`
- Test: `src/app/shell.test.tsx`

Maps onto `.app-root`, `.phone`, `.phone-screen`(+`.anchor`), `.dynamic-island`, `.status-bar`, `.screen-content`, `.home-indicator`, `.fab`(+`.pulsing`). Mirrors `frame.jsx`.

- [ ] **Step 1: Write failing tests**

`src/app/shell.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBar } from './StatusBar'
import { PhoneFrame } from './PhoneFrame'
import { Fab } from './Fab'

test('StatusBar shows default clock and status icons', () => {
  const { container } = render(<StatusBar />)
  expect(screen.getByText('13:42')).toBeInTheDocument()
  expect(container.querySelector('.status-icons')).toBeTruthy()
})
test('PhoneFrame applies anchor class when anchor', () => {
  const { container } = render(<PhoneFrame anchor><div /></PhoneFrame>)
  expect(container.querySelector('.phone-screen.anchor')).toBeTruthy()
})
test('Fab fires onClick and renders mic icon', async () => {
  const onClick = vi.fn()
  const { container } = render(<Fab onClick={onClick} />)
  expect(container.querySelector('svg')).toBeTruthy()
  await userEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/app/StatusBar.tsx`:
```tsx
import { StatusIcons } from '@/components/ui/Icon'

export function StatusBar({ clock = '13:42' }: { clock?: string }) {
  return (
    <div className="status-bar">
      <span>{clock}</span>
      <StatusIcons />
    </div>
  )
}
```
`src/app/PhoneFrame.tsx` — bezel chrome for the preview frame (kept for Phase-1 pixel-parity; a later PWA polish task can drop the bezel on real mobile via media query):
```tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'
import { StatusBar } from './StatusBar'

export function PhoneFrame({ children, anchor = false, clock }: { children: ReactNode; anchor?: boolean; clock?: string }) {
  return (
    <div className="app-root">
      <div className="phone">
        <div className={cn('phone-screen', anchor && 'anchor')}>
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
`src/app/ScreenContent.tsx`:
```tsx
import type { ReactNode } from 'react'
export function ScreenContent({ children }: { children: ReactNode }) {
  return <div className="screen-content">{children}</div>
}
```
`src/app/Fab.tsx`:
```tsx
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui/Icon'

export function Fab({ onClick, pulsing = false }: { onClick: () => void; pulsing?: boolean }) {
  return (
    <button className={cn('fab', pulsing && 'pulsing')} onClick={onClick} aria-label="Gyors rögzítés">
      <Icon name="mic" size={26} />
    </button>
  )
}
```

- [ ] **Step 4: Run tests** — PASS (3).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): app shell — PhoneFrame, StatusBar, ScreenContent, Fab

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: TabBar (5-tab bottom nav)

**Files:**
- Create: `src/app/TabBar.tsx`
- Test: `src/app/TabBar.test.tsx`

Maps onto `.tab-bar`, `.tab-item`(+`.active`), `.tab-dot`, active icon glow. Uses react-router `NavLink` so the active tab tracks the route. Tab order + labels + icons from `frame.jsx`: today/Today, train/Train, fuel/Fuel, insights/Insights, me/Me.

- [ ] **Step 1: Write failing test**

`src/app/TabBar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter>)
}

test('renders all five tab labels', () => {
  renderAt('/today')
  for (const label of ['Today', 'Train', 'Fuel', 'Insights', 'Me'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('marks the current route tab active', () => {
  renderAt('/fuel')
  const fuel = screen.getByText('Fuel').closest('a')!
  expect(fuel.className).toContain('active')
  const today = screen.getByText('Today').closest('a')!
  expect(today.className).not.toContain('active')
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/app/TabBar.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from '@/components/ui/Icon'

interface Tab { id: string; label: string; icon: IconName }
const TABS: Tab[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'fuel', label: 'Fuel', icon: 'fuel' },
  { id: 'insights', label: 'Insights', icon: 'insights' },
  { id: 'me', label: 'Me', icon: 'me' },
]

export function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <NavLink key={t.id} to={`/${t.id}`} className={({ isActive }) => cn('tab-item', isActive && 'active')}>
          <span className="tab-dot" />
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Run tests** — PASS (2).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(frontend): TabBar 5-tab bottom nav with route-driven active state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Router + placeholder screens + wire the shell

**Files:**
- Create: `src/features/today/TodayScreen.tsx`, `src/features/train/TrainScreen.tsx`, `src/features/fuel/FuelScreen.tsx`, `src/features/insights/InsightsScreen.tsx`, `src/features/me/MeScreen.tsx`, `src/app/AppLayout.tsx`, `src/app/router.tsx`
- Modify: `src/main.tsx` (mount router + ThemeProvider), delete temporary `src/App.tsx` + `src/App.test.tsx`
- Test: `src/app/navigation.test.tsx`

- [ ] **Step 1: Write failing navigation test**

`src/app/navigation.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './router'
import { ThemeProvider } from './ThemeProvider'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)
}

test('redirects / to Today', () => {
  renderApp('/')
  expect(screen.getByRole('heading', { level: 1, name: /today/i })).toBeInTheDocument()
})
test('navigates between tabs by clicking the bottom nav', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByText('Insights'))
  expect(screen.getByRole('heading', { level: 1, name: /insights/i })).toBeInTheDocument()
})
test('FAB opens and the sheet closes again', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors rögzítés' }))
  expect(screen.getByText(/QuickInput placeholder/i)).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByText(/QuickInput placeholder/i)).not.toBeInTheDocument()
})
test('Me screen theme toggle flips data-theme', async () => {
  renderApp('/me')
  document.documentElement.removeAttribute('data-theme')
  await userEvent.click(screen.getByRole('button', { name: /téma/i }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement placeholder screens**

Each placeholder renders a `PageTitle` (so navigation is assertable) inside a `page-header`. Real content arrives in later slices.

`src/features/today/TodayScreen.tsx`:
```tsx
import { PageTitle } from '@/components/ui/PageTitle'
import { Eyebrow } from '@/components/ui/Eyebrow'
export function TodayScreen() {
  return (
    <div className="page-header">
      <div className="col gap-xs">
        <Eyebrow brand>MA</Eyebrow>
        <PageTitle>Today</PageTitle>
      </div>
    </div>
  )
}
```
`src/features/train/TrainScreen.tsx`, `fuel/FuelScreen.tsx`, `insights/InsightsScreen.tsx` — identical shape with their own eyebrow/title (`Edzés`/Train, `Tüzelő`/Fuel, `Felismerések`/Insights). Reproduce the TodayScreen structure, swapping the strings.

`src/features/me/MeScreen.tsx` — placeholder + a temporary theme toggle (the real toggle lives in the Me-slice Settings sheet later):
```tsx
import { PageTitle } from '@/components/ui/PageTitle'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { CtaGhost } from '@/components/ui/Cta'
import { useTheme } from '@/app/ThemeProvider'

export function MeScreen() {
  const { theme, toggle } = useTheme()
  return (
    <div className="col" style={{ padding: '0 24px' }}>
      <div className="page-header" style={{ padding: '14px 0 18px' }}>
        <div className="col gap-xs">
          <Eyebrow brand>PROFIL</Eyebrow>
          <PageTitle>Me</PageTitle>
        </div>
      </div>
      <CtaGhost onClick={toggle} aria-label={`Téma váltása (most: ${theme})`}>
        Téma: {theme}
      </CtaGhost>
    </div>
  )
}
```

- [ ] **Step 4: Implement layout + router**

`src/app/AppLayout.tsx` — composes the shell: PhoneFrame > ScreenContent(Outlet) + Fab + TabBar, and owns the QuickInput sheet open-state:
```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PhoneFrame } from './PhoneFrame'
import { ScreenContent } from './ScreenContent'
import { TabBar } from './TabBar'
import { Fab } from './Fab'
import { Sheet } from '@/components/ui/Sheet'

export function AppLayout() {
  const [quickOpen, setQuickOpen] = useState(false)
  return (
    <PhoneFrame>
      <ScreenContent>
        <Outlet />
      </ScreenContent>
      <Fab onClick={() => setQuickOpen(true)} />
      {quickOpen && (
        <Sheet onClose={() => setQuickOpen(false)}>
          <p>QuickInput placeholder</p>
        </Sheet>
      )}
      <TabBar />
    </PhoneFrame>
  )
}
```
`src/app/router.tsx`:
```tsx
import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { TodayScreen } from '@/features/today/TodayScreen'
import { TrainScreen } from '@/features/train/TrainScreen'
import { FuelScreen } from '@/features/fuel/FuelScreen'
import { InsightsScreen } from '@/features/insights/InsightsScreen'
import { MeScreen } from '@/features/me/MeScreen'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen /> },
      { path: 'train', element: <TrainScreen /> },
      { path: 'fuel', element: <FuelScreen /> },
      { path: 'insights', element: <InsightsScreen /> },
      { path: 'me', element: <MeScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]
```

- [ ] **Step 5: Wire `main.tsx`, remove temporary files**

```bash
git rm src/App.tsx src/App.test.tsx
```
`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './app/ThemeProvider'
import { routes } from './app/router'
import './index.css'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Run tests + visually verify**

```bash
pnpm test
pnpm dev   # click each tab; FAB opens the sheet; Me toggles dark/light
```
Expected: all tests pass; navigating tabs swaps the title; the bottom nav highlights the active tab with the glow; theme toggle flips the whole UI and survives reload.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(frontend): router + 5 placeholder screens + wired app shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: PWA icons + install manifest

**Files:**
- Create: `public/logo.svg`, generated `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-512x512.png`
- Modify: `package.json` (add the assets-generator dev dep + a script)

- [ ] **Step 1: Create the source logo SVG (brand "M" on canvas)**

`public/logo.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0A0F14"/>
  <path d="M96 360 V152 L192 280 L256 192 L320 280 L416 152 V360"
    fill="none" stroke="#5EEAD4" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Generate PNG icon sizes from the SVG**

```bash
pnpm add -D @vite-pwa/assets-generator
pnpm exec pwa-assets-generator --preset minimal-2023 public/logo.svg
```
Expected: PNG assets emitted under `public/` (192, 512, maskable). If the preset emits different filenames, align the `manifest.icons` `src` entries in `vite.config.ts` to the generated names.

- [ ] **Step 3: Verify the build picks up the PWA assets**

```bash
pnpm build
pnpm preview   # open the app; DevTools → Application → Manifest shows name "Mezo" + icons, no errors
```
Expected: manifest valid, icons resolve, installable.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(frontend): PWA manifest icons (brand glyph) + assets generator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Pixel-parity harness (Playwright vs prototype)

**Files:**
- Create: `tests/parity/playwright.config.ts`, `tests/parity/foundation.spec.ts`, `tests/parity/README.md`

This harness renders **our app** and **the prototype** at the same 440×956 viewport and saves screenshots for side-by-side comparison. It is the verification tool referenced in the spec — run it after each slice. (The same screenshots can be viewed via the chrome-devtools MCP for inline comparison.)

- [ ] **Step 1: Create the Playwright config**

`tests/parity/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: 'pnpm dev --port 4317',
    url: 'http://localhost:4317',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
```

- [ ] **Step 2: Create the parity spec**

`tests/parity/foundation.spec.ts` — screenshots each tab of our app and the prototype's matching screen. The prototype is a local file; load it via `file://`.
```ts
import { test } from '@playwright/test'
import { pathToFileURL } from 'node:url'

const PROTOTYPE = pathToFileURL(
  '/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/Mezo Prototype.html',
).href
const TABS = ['today', 'train', 'fuel', 'insights', 'me'] as const

for (const tab of TABS) {
  test(`our app — ${tab}`, async ({ page }) => {
    await page.goto(`http://localhost:4317/${tab}`)
    await page.waitForTimeout(400) // fonts/transition settle
    await page.screenshot({ path: `tests/parity/__shots__/app-${tab}.png` })
  })
}

test('prototype — default (Today)', async ({ page }) => {
  await page.goto(PROTOTYPE)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'tests/parity/__shots__/prototype-today.png' })
})
```
> Driving the prototype's own tabs/sheets requires clicking its bottom nav (no routes). For Foundation we only need the Today baseline + our five screens. Later slices extend this spec to click into each prototype tab/sub-view before shooting.

- [ ] **Step 3: Create the harness README + ignore the shots**

`tests/parity/README.md`:
```md
# Parity harness
`pnpm parity` renders the app (localhost:4317) and the prototype (file://) at 440×956
and writes PNGs to `tests/parity/__shots__/`. Compare app-*.png against the prototype
visually (or via the chrome-devtools MCP). Screenshots are git-ignored.
```
Append to `.gitignore`:
```
tests/parity/__shots__/
```

- [ ] **Step 4: Run the harness + verify**

```bash
pnpm parity
```
Expected: PNGs written for `app-today/train/fuel/insights/me` and `prototype-today`. Open `app-today.png` and `prototype-today.png` — the iPhone shell, status bar, dark canvas, bottom tab bar (icons + glow on the active tab), and FAB must match. Note any mismatch as a follow-up beads issue.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(frontend): Playwright parity harness (app vs prototype @440x956)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Definition of Done (Slice 0)

- `pnpm test` green; `pnpm build` succeeds; `pnpm parity` produces screenshots.
- App boots into Today; all 5 tabs navigate; active tab shows the glow + dot; FAB opens a sheet that closes on backdrop/Escape.
- Dark + light themes both correct, toggled from Me, persisted to `localStorage` (`mezo-theme`), no flash on reload.
- Design tokens, notch utilities, and signature primitives (NotchCard, Chip, ToolChip, ToolChipRow, RefTag, Eyebrow, LabelMono, Display, PageTitle, Cta, ProgressBar, Sheet, TabBar, Fab, Icon set) exist and match the prototype values.
- No `dangerouslySetInnerHTML` anywhere (SafeMarkdown is the only `**bold**` renderer).
- App shell pixel-parity with the prototype at 440×956 (status bar, tab bar, FAB).

**Next slice:** Today — compose these primitives into the home screen (briefing card, reta phase bar, check-in strip, workout teaser, sport card, fuel timeline preview, quick stats) + CheckInSheet + QuickInputSheet + AnchorMode.

---

## Self-Review

**Spec coverage** (against `2026-06-02-mezo-phase1-frontend-design.md`): Stack (Task 1) · feature-sliced structure (file tree + Tasks 6–13) · Tailwind v4 `@theme` from design tokens (Task 2) · dark-first + light override + `localStorage`/no-flash (Tasks 1,2,4) · signature primitives notch/accent/tool-chips/eyebrows (Tasks 6–10) · provenance block — *deferred*: it first appears on the Today/Train screens, so it is built in those slices, not Foundation (noted here intentionally) · mock-data hooks — *deferred*: no screen consumes data in Foundation; introduced in the Today slice · no `dangerouslySetInnerHTML` (Task 3) · Playwright/MCP parity at 440×956 (Task 15) · light navigation + primitive tests (Tasks throughout) · beads tracking (this plan = the Foundation epic; child issues per task).

**Placeholder scan:** No "TBD/TODO/handle edge cases" steps; every code step shows complete code, except the two deliberate verbatim-copy steps (Icon cases from `icons.jsx`, component classes already copied wholesale in Task 2) which reference an exact existing source file rather than re-printing it — these are concrete, not placeholders.

**Type consistency:** `IconName` (Task 5) is consumed by `TabBar` (Task 12) and `Fab`/`ToolChip`. `Tool`/`ToolType` defined in `ToolChip` (Task 8) reused by `ToolChipRow`. `Theme`/`THEME_KEY`/`readStoredTheme`/`writeStoredTheme`/`applyTheme` (Task 4 lib) consumed by `ThemeProvider`; `useTheme` returns `{ theme, setTheme, toggle }`, used by `MeScreen` (Task 13). `routes` (Task 13) consumed by `main.tsx` and `navigation.test.tsx`. Names are consistent across tasks.
