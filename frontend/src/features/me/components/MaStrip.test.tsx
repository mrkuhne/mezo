import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MaStrip } from '@/features/me/components/MaStrip'
import { QueryWrapper } from '@/test/queryWrapper'
import { mockQuestDay } from '@/data/quest/questMock'
import { mockActivities } from '@/data/activity/activityMock'

const hooks = vi.hoisted(() => ({ useDailyQuests: vi.fn(), useQuestActions: vi.fn(), useActivities: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: hooks.useDailyQuests, useQuestActions: hooks.useQuestActions, useActivities: hooks.useActivities,
}))
vi.mock('@/features/today/sheets/ActivityLogSheet', () => ({
  ActivityLogSheet: ({ quest }: { quest?: { title: string } }) => <div data-testid="act-sheet">{quest?.title ?? 'free'}</div>,
}))
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()), localDateString: () => '2026-07-12',
}))

function Loc() { const l = useLocation(); return <span data-testid="loc">{l.pathname}</span> }
function renderStrip() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/growth']}>
        <Routes><Route path="*" element={<><MaStrip /><Loc /></>} /></Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}
beforeEach(() => {
  hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
  hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
  hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
})
afterEach(() => vi.clearAllMocks())

test('head counts done/total quests and sums today XP (done quests + activities)', () => {
  renderStrip()
  const done = mockQuestDay.filter((q) => q.status === 'completed')
  const xp = done.reduce((s, q) => s + q.xp, 0) + mockActivities.reduce((s, a) => s + a.xpAwarded, 0)
  expect(screen.getByText(`${done.length}/${mockQuestDay.length}`)).toBeInTheDocument()
  expect(screen.getByText(`+${xp} XP`)).toBeInTheDocument()
})

test('one chip per quest with the honest state class; activities render as ✎ chips; ＋ Tevékenység last', () => {
  const { container } = renderStrip()
  expect(container.querySelectorAll('.gr-chip:not(.act):not(.add)')).toHaveLength(mockQuestDay.length)
  expect(container.querySelectorAll('.gr-chip.act')).toHaveLength(mockActivities.length)
  const chips = container.querySelectorAll('.gr-chip')
  expect(chips[chips.length - 1].textContent).toBe('＋ Tevékenység')
  expect(container.querySelectorAll('.gr-chip.done')).toHaveLength(mockQuestDay.filter((q) => q.status === 'completed').length)
})

test('the head navigates to /nap/kuldetesek; a DERIVED open chip does too', async () => {
  renderStrip()
  await userEvent.click(screen.getByRole('button', { name: /Küldetések/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/nap/kuldetesek')
})

test('an ACTIVITY-mode open chip opens the activity sheet with that quest; ＋ Tevékenység opens it free', async () => {
  hooks.useDailyQuests.mockReturnValue({
    quests: [{ ...mockQuestDay[0], id: 'qa', status: 'offered', completionMode: 'ACTIVITY', title: 'Olvass 10 percet' }],
    levelUps: [], rerollsLeft: 1, mode: 'mock',
  })
  renderStrip()
  await userEvent.click(screen.getByRole('button', { name: 'Olvass 10 percet' }))
  expect(screen.getByTestId('act-sheet').textContent).toBe('Olvass 10 percet')
})

test('no quests today: the empty line + the ＋ Tevékenység chip', () => {
  hooks.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 0, mode: 'mock' })
  hooks.useActivities.mockReturnValue({ data: [], isPending: false })
  renderStrip()
  expect(screen.getByText(/Ma még nincs küldetés/)).toBeInTheDocument()
  expect(screen.getByText('0/0')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '＋ Tevékenység' })).toBeInTheDocument()
})

test('expired quest chip is not a button and says csendben lejárt', () => {
  hooks.useDailyQuests.mockReturnValue({
    quests: [{ ...mockQuestDay[0], id: 'qx', status: 'expired', title: 'Nyújtás' }], levelUps: [], rerollsLeft: 0, mode: 'mock',
  })
  const { container } = renderStrip()
  const gone = container.querySelector('.gr-chip.gone')!
  expect(gone.tagName).toBe('SPAN')
  expect(gone.textContent).toContain('Nyújtás · csendben lejárt')
})
