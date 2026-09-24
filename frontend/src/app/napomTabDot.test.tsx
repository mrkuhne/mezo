// A napom tab dot is LIVE (mezo-yjzhw.4, review round 1): once yesterday's overnight review is on
// screen, `markSeen` fires `napom:seen` and AppLayout's `useMorningMode` drops the dot at once —
// not on some later, unrelated re-render.
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seenKey } from '@/features/today/logic/napom'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T09:00:00'))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

test('the morning dot disappears as soon as yesterday’s scored review has been viewed', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap/rutin'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)

  // mock yesterday (2026-09-23) is a past day → the scored fixture, with a review → morning mode
  const tab = await screen.findByRole('link', { name: 'A napom' })
  expect(tab).toHaveAccessibleDescription('kész a tegnapi értékelés')

  await act(async () => { await router.navigate('/nap/napom/2026-09-23') })
  expect(await screen.findByText('MEZO · A NAPODRÓL')).toBeInTheDocument()
  expect(localStorage.getItem(seenKey('2026-09-23'))).toBe('1')
  await waitFor(() => expect(screen.getByRole('link', { name: 'A napom' })).not.toHaveAttribute('aria-describedby'))
  expect(document.querySelector('.tb-dot')).toBeNull()
})
