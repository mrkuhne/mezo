import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StartupSplash } from '@/app/StartupSplash'

// Visszaöltöztetés (mezo-ju4j6.3): a jel STATIKUS agyag-gömb, nem élő 3D jelenet, ezért a
// „készen van-e már" varrat (és a hozzá tartozó 5 másodperces vészkijárat) tárgytalan lett —
// a StartupSplash.readiness.test.tsx vele együtt szűnt meg. Amit a felhasználó lát, az
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
  // The startup deadline plus PhoneFrame's existing daypart clock.
  expect(vi.getTimerCount()).toBe(2)
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  first.unmount()
  const second = render(<StartupSplash>Dashboard</StartupSplash>)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

// A jel az agyag-készlet gömbje (style bible §6) — se emoji, se a Titán 3D jelenet.
test('the mark is the clay orb spot, and the wordmark stays "boop"', () => {
  const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
  expect(container.querySelector('.startup-splash use')!.getAttribute('href')).toBe('#s-orb')
  expect(container.querySelector('.startup-splash canvas')).toBeNull()
  expect(container.querySelector('.startup-splash .titan-svg')).toBeNull()
  expect(container.querySelector('.startup-splash__wordmark')!.textContent).toBe('boop')
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
