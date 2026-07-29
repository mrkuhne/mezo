import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TodoCard } from '@/features/today/components/TodoCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Reggeli napfény', subtitle: 'ébredés után', time: null, xp: 5,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' }, ...over,
})

describe('TodoCard', () => {
  test('groups rows under their group heading, in first-appearance order', () => {
    const { container } = render(
      <TodoCard doneCount={2} xp={48} onAct={() => {}} items={[
        item({ id: 'a', group: 'Reggeli rutin', title: 'Ébredés időben' }),
        item({ id: 'b', group: 'Napi küldetések', source: 'quest' }),
        item({ id: 'c', group: 'Reggeli rutin', title: 'Gombakávé' }),
      ]} />,
    )
    const groups = [...container.querySelectorAll('.tdc-grp')].map(g => g.textContent)
    expect(groups).toEqual(['Reggeli rutin · 2', 'Napi küldetések · 1'])

    // Distinct titles on the two same-group fixtures let us pin row order too,
    // not just the group label/count above.
    const reggeliHeading = [...container.querySelectorAll('.tdc-grp')].find(
      (g) => g.textContent === 'Reggeli rutin · 2',
    )!
    const reggeliTitles = [...reggeliHeading.parentElement!.querySelectorAll('.itemrow-t1')].map(
      (t) => t.textContent,
    )
    expect(reggeliTitles).toEqual(['Ébredés időben', 'Gombakávé'])
  })

  test('the header shows done/total and the XP total', () => {
    render(<TodoCard doneCount={6} xp={48} onAct={() => {}} items={[item(), item({ id: 'b' })]} />)
    expect(screen.getByText(/6 \/ 8 kész/)).toBeInTheDocument()
    expect(screen.getByText('+48 XP')).toBeInTheDocument()
  })

  test('the progress bar width matches done/total', () => {
    const { container } = render(<TodoCard doneCount={1} xp={0} onAct={() => {}} items={[item(), item({ id: 'b' }), item({ id: 'c' })]} />)
    expect(container.querySelector<HTMLElement>('.tdc-bar i')?.style.width).toBe('25%')
  })

  test('a row action fires onAct with its own item', () => {
    const onAct = vi.fn()
    const target = item({ id: 'z', title: 'Gombakávé' })
    render(<TodoCard doneCount={0} xp={0} onAct={onAct} items={[item(), target]} />)
    within(screen.getByText('Gombakávé').closest('.itemrow')!).getByRole('button').click()
    expect(onAct).toHaveBeenCalledWith(target)
  })

  test('a row without an action renders no button', () => {
    render(<TodoCard doneCount={0} xp={0} onAct={() => {}} items={[item({ action: null })]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('renders nothing when there are no items', () => {
    const { container } = render(<TodoCard doneCount={0} xp={0} onAct={() => {}} items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders nothing on an all-done face — the done rows live in the fold, not here', () => {
    const { container } = render(<TodoCard doneCount={5} xp={40} onAct={() => {}} items={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
