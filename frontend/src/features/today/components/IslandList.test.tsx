import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { IslandList } from '@/features/today/components/IslandList'
import type { TodayItem } from '@/features/today/logic/todayItems'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Reggeli napfény', subtitle: 'ébredés után', time: null, xp: 5,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' } as TodayItem['action'], linkUrl: null, ...over,
})

const renderList = (ui: Partial<Parameters<typeof IslandList>[0]> = {}) =>
  render(
    <MemoryRouter>
      <IslandList
        open={[item()]}
        done={[]}
        doneHeading="Kész ma"
        onAct={() => {}}
        onClose={() => {}}
        {...ui}
      />
    </MemoryRouter>,
  )

describe('IslandList', () => {
  test('groups render in first-appearance order with heading text', () => {
    const { container } = renderList({
      open: [
        item({ id: 'a', group: 'Reggeli rutin', title: 'Ébredés időben' }),
        item({ id: 'b', group: 'Napi küldetések', source: 'quest' }),
        item({ id: 'c', group: 'Reggeli rutin', title: 'Gombakávé' }),
      ],
    })
    const groups = [...container.querySelectorAll('.isl-grouph')].map((g) => g.textContent)
    expect(groups[0]).toContain('Reggeli rutin · 2')
    expect(groups[1]).toContain('Napi küldetések · 1')
  })

  test('the quest group heading carries the growth link', () => {
    renderList({
      open: [item({ id: 'q', group: 'Napi küldetések', source: 'quest' })],
      growth: { done: 2, total: 5, xp: 30 },
    })
    const link = screen.getByRole('link', { name: /Küldetések kezelése/ })
    expect(link).toHaveAttribute('href', '/me/growth')
    expect(link.textContent).toContain('2/5')
  })

  test('a pill fires onAct with the item; a stripped action renders no button', async () => {
    const onAct = vi.fn()
    const it = item({ id: 'x', title: 'Vízcél' })
    renderList({ open: [it, item({ id: 'y', title: 'Passzív', action: null })], onAct })
    await userEvent.click(screen.getByRole('button', { name: /Pipa/ }))
    expect(onAct).toHaveBeenCalledWith(it)
    const passive = screen.getByText('Passzív').closest('.itemrow')!
    expect(within(passive as HTMLElement).queryByRole('button')).toBeNull()
  })

  test('done rows render under the done heading and dayXp closes the group', () => {
    renderList({
      done: [item({ id: 'd', status: 'done', title: 'Reggeli mérés' })],
      doneHeading: 'Ahogy a nap telt',
      dayXp: 85,
    })
    expect(screen.getByText(/Ahogy a nap telt/)).toBeInTheDocument()
    expect(screen.getByText('Reggeli mérés')).toBeInTheDocument()
    expect(screen.getByText('Ma összesen +85 XP')).toBeInTheDocument()
  })

  test('összecsuk fires onClose; habitPending withdraws only habit pills', async () => {
    const onClose = vi.fn()
    renderList({
      open: [
        item({ id: 'h', title: 'Habit sor', action: { kind: 'habit', habit: {} as never, label: 'Pipa' } }),
        item({ id: 'q', title: 'Quest sor', source: 'quest', action: { kind: 'quest', quest: {} as never, label: '+250 ml' } }),
      ],
      habitPending: true,
      onClose,
    })
    expect(screen.queryByRole('button', { name: 'Pipa' })).toBeNull()
    expect(screen.getByRole('button', { name: '+250 ml' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'összecsuk ↑' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('head and focus slots render above and under a Fókusz heading', () => {
    renderList({ head: <div data-testid="head-slot" />, focus: <div data-testid="focus-slot" /> })
    expect(screen.getByTestId('head-slot')).toBeInTheDocument()
    expect(screen.getByTestId('focus-slot')).toBeInTheDocument()
    expect(screen.getByText('Fókusz')).toBeInTheDocument()
  })
})
