import { readFileSync } from 'node:fs'
import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StartupSplash } from '@/app/StartupSplash'

// A jel CSS-idővonal, nem élő jelenet, ezért „készen van-e már" varrat nincs. Amit a felhasználó lát, az
// VÁLTOZATLAN, és pont az marad itt kikötve: három másodperc, aztán az app.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('blocks interaction until exactly 3 seconds, then reveals the mounted app', () => {
  const { container } = render(<StartupSplash><button>Dashboard</button></StartupSplash>)
  expect(screen.getByRole('status', { name: 'Boop betöltése' })).toBeInTheDocument()
  expect(container.querySelector('[inert]')).toContainElement(screen.getByText('Dashboard'))
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(2999))
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
  expect(container.querySelector('[inert]')).toBeNull()
})

test('does not replay when the routed content changes', () => {
  const { rerender } = render(<StartupSplash>Dashboard</StartupSplash>)
  act(() => vi.advanceTimersByTime(3000))
  rerender(<StartupSplash>Edzés</StartupSplash>)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Edzés')).toBeVisible()
})

test('StrictMode still reveals once and unmount clears the pending timer', () => {
  const first = render(<StrictMode><StartupSplash>Dashboard</StartupSplash></StrictMode>)
  // The startup deadline and PhoneFrame's existing daypart clock — StrictMode's double effect
  // run leaves exactly one of each (the motion is CSS now, no animation-frame loop).
  expect(vi.getTimerCount()).toBe(2)
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  first.unmount()
  const second = render(<StartupSplash>Dashboard</StartupSplash>)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

// Folyadék F1 (mezo-n4wf5.1): egy edény, öt réteg, öt csepp — és a szó-logó marad „boop".
test('one vessel with five layers, five drops in the bar, the wordmark stays "boop"', () => {
  const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
  const sp = container.querySelector('.fo-sp')!
  expect(sp.querySelectorAll('.fo-sp-ves')).toHaveLength(1)
  const layers = [...sp.querySelectorAll<HTMLElement>('.fo-sp-stk > i')]
  expect(layers.map((l) => l.dataset.layer)).toEqual(['nap', 'train', 'fuel', 'mezo', 'me'])
  expect(layers.map((l) => l.style.getPropertyValue('--c2'))).toEqual(['#1877F2', '#F2683A', '#149E6E', '#6B4FE0', '#0E94B8'])
  expect(sp.querySelectorAll('.fo-nav .fo-drop')).toHaveLength(5)
  expect(sp.querySelector('.fo-sp-wm')!.textContent).toBe('boop')
  // no old orb / orbit / canvas leftovers
  expect(container.querySelector('.startup-splash, canvas, .titan-svg')).toBeNull()
})

test('the bar of drops is non-interactive and Nap is the active one', () => {
  const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
  const bar = container.querySelector('.fo-sp .fo-nav')!
  expect(bar.getAttribute('aria-hidden')).toBe('true')
  expect(bar.querySelectorAll('a, button, [tabindex]')).toHaveLength(0)
  const items = [...bar.querySelectorAll('.fo-nav-item')]
  expect(items.map((i) => i.classList.contains('on'))).toEqual([true, false, false, false, false])
})

// Final review, I2: the scene dissolves into the real bar, so its active (larger) drop is the
// domain the app OPENS on — read once from the URL, the stage lives outside the router.
test('the active drop follows the domain the app opens on', () => {
  window.history.replaceState(null, '', '/fuel/recipes')
  try {
    const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
    const on = [...container.querySelectorAll('.fo-sp .fo-nav-item.on')]
    expect(on.map((i) => i.getAttribute('data-domain'))).toEqual(['fuel'])
  } finally {
    window.history.replaceState(null, '', '/')
  }
})

// Final review, I2: the stage paints no ground of its own — the fading scene is the only opaque
// layer, so it dissolves into the mounted app instead of an empty frame.
test('over the phone shell the stage frame is transparent: no ground, no bezel, no sky', () => {
  const css = readFileSync('src/app/StartupSplash.css', 'utf8')
  const scope = String.raw`\.startup-content:has\(\.phone-screen\) \+ \.startup-stage `
  const rule = css.match(new RegExp(String.raw`${scope}\.app-root,[^{]*\{([^}]*)\}`))!
  expect(rule[0]).toMatch(new RegExp(String.raw`${scope}\.phone,`))
  expect(rule[0]).toMatch(new RegExp(String.raw`${scope}\.phone-screen\[data-domain\]\[data-day\]`))
  expect(rule[1]).toMatch(/background:\s*none/)
  expect(css).toMatch(new RegExp(String.raw`${scope}\.sky,\s*${scope}\.uv-aurora\s*\{\s*display:\s*none`))
  // a frameless surface (login, admin) keeps the opaque stage: nothing un-scoped strips it
  expect(css).not.toMatch(/^\.startup-stage \.(app-root|phone)\b/m)
})

test('the timeline numbers reach the stylesheet from the one table', () => {
  const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
  const style = (container.querySelector('.fo-sp') as HTMLElement).style
  expect(['--sp-end', '--sp-fade', '--sp-drop-start', '--sp-stagger', '--sp-fall'].map((v) => style.getPropertyValue(v)))
    .toEqual(['3000ms', '2400ms', '1080ms', '170ms', '560ms'])
})

// Reduced motion: the base CSS is the final frame and EVERY animation/transition sits inside the
// no-preference media block, so nothing runs; the splash just ends at 3 s (the timer test above).
test('all motion lives inside the no-preference media query', () => {
  const css = readFileSync('src/app/StartupSplash.css', 'utf8')
  const start = css.indexOf('@media (prefers-reduced-motion: no-preference)')
  expect(start).toBeGreaterThan(-1)
  const end = css.indexOf('\n}\n', start) + 3
  const outside = css.slice(0, start) + css.slice(end)
  expect(outside.replace(/@keyframes[\s\S]*$/m, '')).not.toMatch(/animation|transition/)
})

test('reduced motion still ends at exactly 3 seconds', () => {
  const matchMedia = window.matchMedia
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query,
    addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  try {
    const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
    expect(container.querySelector('.fo-sp')!.getAttribute('data-motion')).toBe('still')
    act(() => vi.advanceTimersByTime(2999))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  } finally {
    window.matchMedia = matchMedia
  }
})

// ── A harness-varrat (mezo-u1n6l) ────────────────────────────────────────────────
// A layout-harness minden route-ot HIDEG betöltéssel jár be, és a bevezető 3 másodpercig
// `aria-hidden`-re teszi az egész tartalmat — egy szerep-alapú lekérdezés (getByRole) ezért
// csak 3,3 másodperc után talál bármit. Öt domain × 3,3 s = ~17 s a 30 s-os teszt-keretből,
// és CI-terhelés alatt ez borította a navigation.spec.ts-t (mindig a KÉSŐBBI domaineknél).
// A varrat ezt veszi le a harness válláról — és CSAK fejlesztői build alatt létezik.

test('fejlesztői buildben a harness kihagyhatja a bevezetőt', () => {
  localStorage.setItem('mezo.splash.skip', '1')
  try {
    render(<StartupSplash><button>Dashboard</button></StartupSplash>)
    // nincs bevezető, és az app AZONNAL elérhető — szerep szerint is
    expect(screen.queryByRole('status', { name: 'Boop betöltése' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
  } finally {
    localStorage.removeItem('mezo.splash.skip')
  }
})

test('a varrat KIKAPCSOLT állapotban semmit nem változtat', () => {
  render(<StartupSplash><button>Dashboard</button></StartupSplash>)
  expect(screen.getByRole('status', { name: 'Boop betöltése' })).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('éles buildben a zászló hatástalan — a bevezető akkor is fut', () => {
  vi.stubEnv('DEV', false)
  localStorage.setItem('mezo.splash.skip', '1')
  try {
    render(<StartupSplash><button>Dashboard</button></StartupSplash>)
    expect(screen.getByRole('status', { name: 'Boop betöltése' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  } finally {
    localStorage.removeItem('mezo.splash.skip')
    vi.unstubAllEnvs()
  }
})
