import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { DayGroups, type DayGroupsProps } from '@/features/today/components/DayGroups'
import type { TodayItem } from '@/features/today/logic/todayItems'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Mobilitás', subtitle: '8 perc', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Indítsd' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const manualHabitItem = item({
  id: 'habit:manual',
  source: 'habit',
  action: { kind: 'habit', habit: { mode: 'MANUAL' } as never, label: 'Pipa' } as TodayItem['action'],
})

const renderGroups = (over: Partial<DayGroupsProps> = {}) =>
  render(
    <MemoryRouter>
      <DayGroups
        open={[item(), item({ id: 'q:1', group: 'Napi küldetések', title: 'Vízbevitel' })]}
        done={[item({ id: 'habit:d', status: 'done', title: 'Mérés' })]}
        doneLabel="✓ 1 kész ma · +45 XP"
        onAct={() => {}}
        {...over}
      />
    </MemoryRouter>,
  )

describe('DayGroups', () => {
  test('every open row is visible without opening anything', () => {
    renderGroups()
    expect(screen.getByText('Mobilitás')).toBeInTheDocument()
    expect(screen.getByText('Vízbevitel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /összecsuk|még \d+/ })).toBeNull()
  })

  test('groups keep first-appearance order and carry their count', () => {
    const { container } = renderGroups()
    const heads = [...container.querySelectorAll('.td-sech')].map((h) => h.textContent)
    expect(heads[0]).toContain('Reggeli rutin · 1')
    expect(heads[1]).toContain('Napi küldetések · 1')
  })

  test('done rows are behind the fold and open on click', async () => {
    renderGroups()
    expect(screen.queryByText('Mérés')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /1 kész ma/ }))
    expect(screen.getByText('Mérés')).toBeInTheDocument()
  })

  test('the fold reports its state to assistive tech', async () => {
    renderGroups()
    const fold = screen.getByRole('button', { name: /1 kész ma/ })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
  })

  test('the evening total closes the opened done block', async () => {
    renderGroups({ dayXp: 120 })
    await userEvent.click(screen.getByRole('button', { name: /1 kész ma/ }))
    expect(screen.getByText('Ma összesen +120 XP')).toBeInTheDocument()
  })

  test('no done items means no fold', () => {
    renderGroups({ done: [] })
    expect(screen.queryByRole('button', { name: /kész/ })).toBeNull()
  })

  test('a row action dispatches its own item', async () => {
    const onAct = vi.fn()
    const row = item({ id: 'habit:z', title: 'Súlymérés' })
    renderGroups({ open: [row], onAct })
    await userEvent.click(screen.getByRole('button', { name: 'Indítsd' }))
    expect(onAct).toHaveBeenCalledWith(row)
  })

  test('habitPending withdraws habit pills only', () => {
    renderGroups({
      open: [item({ id: 'habit:h', action: { kind: 'habit', habit: {} as never, label: 'Indítsd' } as TodayItem['action'] }), item({ id: 'q:2', group: 'Napi küldetések', title: 'Víz', action: { kind: 'quest', quest: {} as never, label: '+250 ml' } as TodayItem['action'] })],
      habitPending: true,
    })
    expect(screen.queryByRole('button', { name: 'Indítsd' })).toBeNull()
    expect(screen.getByRole('button', { name: '+250 ml' })).toBeInTheDocument()
  })

  test('the quest heading carries the ONE Today → Growth route', () => {
    renderGroups({ growth: { done: 2, total: 5, xp: 120 } })
    expect(screen.getByRole('link', { name: /Küldetések kezelése/ })).toHaveAttribute('href', '/me/growth')
  })

  test('head and focus slots render as given', () => {
    // DayGroups no longer wraps `focus` in its own „Fókusz" heading — the slot's own
    // content (IntentionBanner) brings its own `TodayList` now (mezo-e26w); that heading
    // is asserted in IntentionBanner.test.tsx instead.
    renderGroups({ head: <div>jegyzet</div>, focus: <div>vezérelv</div> })
    expect(screen.getByText('jegyzet')).toBeInTheDocument()
    expect(screen.getByText('vezérelv')).toBeInTheDocument()
  })

  test('minden csoport EGY dobozban ül, és a MANUAL szokás karikát kap', () => {
    const { container } = render(
      <DayGroups open={[manualHabitItem]} done={[]} doneLabel="✓ 0 kész" onAct={() => {}} />,
    )
    expect(container.querySelectorAll('.td-list')).toHaveLength(1)
    expect(container.querySelector('.td-tick')).toBeInTheDocument()
  })
})
