import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StartupSplash } from '@/app/StartupSplash'
import { TitanCompanion } from '@/features/today/components/TitanCompanion'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('blocks interaction until exactly 3 seconds, then reveals the mounted app', () => {
  const { container } = render(<StartupSplash><button>Dashboard</button></StartupSplash>)
  expect(screen.getByRole('status', { name: 'Mezo betöltése' })).toBeInTheDocument()
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

test('reduced motion uses the existing SVG and still finishes after 3 seconds', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const { container } = render(<StartupSplash>Dashboard</StartupSplash>)
  expect(container.querySelector('.startup-splash .titan-svg')).not.toBeNull()
  expect(container.querySelector('.startup-splash canvas')).toBeNull()
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('the splash and Dashboard SVGs have independent gradient references', () => {
  const { container } = render(
    <StartupSplash><TitanCompanion states={[]} onOpenSignals={() => {}} /></StartupSplash>,
  )
  const marks = Array.from(container.querySelectorAll('.titan-svg'))
  expect(marks).toHaveLength(2)
  const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const mark of marks) {
    const ownIds = Array.from(mark.querySelectorAll('[id]'), (element) => element.id)
    for (const element of mark.querySelectorAll('[fill^="url"]')) {
      expect(ownIds).toContain(element.getAttribute('fill')!.slice(5, -1))
    }
  }
})
