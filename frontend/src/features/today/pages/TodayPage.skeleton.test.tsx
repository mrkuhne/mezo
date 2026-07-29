// ============================================================
// Mezo · TodayPage sleep-anchor pending gate (mezo-1khu). `useSleepGoal` resolves
// asynchronously in real mode; before it settles, `dayFace` would pick a face off
// the placeholder anchor and then visibly jump to the correct one once the real
// anchor lands. Mock mode resolves synchronously, so the pending window practically
// never happens there — this file controls `useSleepGoal` directly (module mock)
// rather than faking a delay, so the gate is exercised independent of dual-query
// mode plumbing.
// ============================================================
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { SLEEP_GOAL_GHOST } from '@/data/me/sleepGoal'

const mocks = vi.hoisted(() => ({ useSleepGoal: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  return { ...orig, useSleepGoal: mocks.useSleepGoal }
})

function tree(path = '/today') {
  return (
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <TodayPage />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>
  )
}

function renderToday(path?: string) {
  return render(tree(path))
}

afterEach(() => vi.clearAllMocks())

describe('TodayPage — sleep-anchor pending gate', () => {
  test('while useSleepGoal is pending, the layout-matched skeleton renders instead of a face', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { container } = renderToday()
    // The skeleton, not a face: no tablist (the real DayFaceStrip), no face tabs.
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('.dfs-pill')).toHaveLength(3)
  })

  test('once useSleepGoal resolves, the real face navigator renders instead', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: false })
    const { container } = renderToday()
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  test('pending → resolved is a LIVE transition on the same mount — hook order must stay stable', () => {
    // Not two separate mounts: the same component instance re-renders as the query
    // settles. If the gate ever moved above a hook (e.g. the `items` useMemo), this
    // is exactly the case that would throw "Rendered fewer hooks than expected".
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { rerender, container } = render(tree())
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()

    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: false })
    rerender(tree())
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  // Fix-round correction: `anchorMode` (`?day=rough`) is derived SYNCHRONOUSLY from the URL
  // (useTodayScenario), never from `useSleepGoal` — so it must win even while the anchor is
  // still pending, or a real-mode `/today?day=rough` visit flashes the generic skeleton
  // before the calm AnchorModeView. TodayPage.test.tsx:158 covers anchorMode too, but only
  // in mock mode, where `isPending` is never true — this is the only test that exercises
  // the actual combination the ordering bug lived in.
  test('anchorMode wins over a pending sleep anchor — no skeleton flash into AnchorModeView', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { container } = renderToday('/today?day=rough')
    expect(screen.getByText('Anchor mode · csendben')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(container.querySelectorAll('.dfs-pill')).toHaveLength(0)
  })
})
