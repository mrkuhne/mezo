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

/**
 * The live screen's face-independent landmark (mezo-puci): the daypart switcher. It replaced
 * the islands' „… · megnyitás" capsule buttons this file used to look for, and — unlike any
 * single daypart's content — it renders identically whatever the clock says.
 */
const switcher = () => screen.queryByRole('group', { name: 'Napszak' })

describe('TodayPage — sleep-anchor pending gate', () => {
  test('while useSleepGoal is pending, the layout-matched skeleton renders instead of a daypart', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { container } = renderToday()
    // The skeleton, not the live screen: no daypart switcher, but the same silhouette.
    expect(switcher()).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('.daytabs')).toBeTruthy()
    expect(container.querySelector('.cb-band')).toBeTruthy()
    expect(container.querySelector('.dayview')).toBeTruthy()
  })

  test('once useSleepGoal resolves, the live daypart screen renders instead', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: false })
    const { container } = renderToday()
    expect(switcher()).toBeInTheDocument()
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
    expect(switcher()).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  // Fix-round correction (mezo-mvb4.1): the pending branch used to return `<TodaySkeleton/>`
  // INSTEAD of the tree that renders `AppHero`, so a cold real-mode load painted a headerless
  // skeleton and then shoved the whole page down by the header's height the moment the anchor
  // resolved — the exact reflow the skeleton exists to prevent, and larger than the accepted
  // ~150-160 px content shrink. `.apphero` is a 65 px `position: sticky` row
  // (`prototype.css`: 48 px avatar + 8 px×2 padding + 1 px border). The TrainTodaySkeleton
  // precedent does not transfer: `TrainSection` renders `AppHero` above its `<Outlet>`, so
  // Train's skeleton never had a header to lose.
  test('the pending skeleton keeps the sticky identity header', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { container } = renderToday()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('.apphero')).toBeTruthy()
    // it is the real header, with Today's own ✨ utility — not a placeholder shaped like one
    expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument()
  })

  test('the header SURVIVES the resolve as the same DOM node — nothing is inserted above', () => {
    // The strongest form of the guarantee: same element, same position in both trees, so React
    // reconciles rather than remounts and the sticky row cannot shift the content below it.
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { rerender, container } = render(tree())
    const pendingHero = container.querySelector('.apphero')
    expect(pendingHero).toBeTruthy()

    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: false })
    rerender(tree())
    expect(container.querySelector('.apphero')).toBe(pendingHero)
    expect(container.querySelector('.apphero')?.previousElementSibling).toBeNull()
  })

  // Fix-round correction: `anchorMode` (`?day=rough`) is derived SYNCHRONOUSLY from the URL
  // (useTodayScenario), never from `useSleepGoal` — so it must win even while the anchor is
  // still pending, or a real-mode `/today?day=rough` visit flashes the generic skeleton
  // before the calm AnchorModeView. TodayPage.test.tsx:158 covers anchorMode too, but only
  // in mock mode, where `isPending` is never true — this is the only test that exercises
  // the actual combination the ordering bug lived in.
  test('anchorMode wins over a pending sleep anchor — no skeleton flash into the melt', () => {
    mocks.useSleepGoal.mockReturnValue({ goal: SLEEP_GOAL_GHOST, isPending: true })
    const { container } = renderToday('/today?day=rough')
    expect(screen.getByText(/Horgony mód/)).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(switcher()).toBeNull()
  })
})
