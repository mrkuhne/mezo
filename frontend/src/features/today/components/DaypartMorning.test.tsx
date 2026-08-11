import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { DaypartMorning } from '@/features/today/components/DaypartMorning'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { QueryWrapper } from '@/test/queryWrapper'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Mobilitás', subtitle: '8 perc', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Indítsd' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderMorning = (over: Partial<Parameters<typeof DaypartMorning>[0]> = {}) =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <DaypartMorning
          hero={{ value: '7,2', unit: 'óra alvás', sub: 'céltól −18 perc' }}
          facts={[{ label: 'Súly', value: '78,4', unit: 'kg', delta: { text: '−0,3 kg · 7 nap', tone: 'good' } }]}
          open={[item(), item({ id: 'habit:b', title: 'Fehérjés reggeli' })]}
          done={[item({ id: 'habit:d', status: 'done', title: 'Mérés' })]}
          doneXp={40}
          celebrations={[]}
          onAct={() => {}}
          {...over}
        />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('DaypartMorning', () => {
  test('hero and facts render', () => {
    renderMorning()
    expect(screen.getByText('7,2')).toBeInTheDocument()
    expect(screen.getByText('óra alvás')).toBeInTheDocument()
    expect(screen.getByText('céltól −18 perc')).toBeInTheDocument()
    expect(screen.getByText('Súly')).toBeInTheDocument()
  })

  test('EVERY open row is visible with no unfolding — no promoted CTA duplicate', () => {
    renderMorning()
    expect(screen.getByText('Mobilitás')).toBeInTheDocument()
    expect(screen.getByText('Fehérjés reggeli')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
    // the chain's first step appears exactly once — as a row, not also as a hero CTA
    expect(screen.getAllByText('Mobilitás')).toHaveLength(1)
  })

  test('the done fold carries the morning label', () => {
    renderMorning()
    expect(screen.getByRole('button', { name: /✓ 1 kész ma · \+40 XP/ })).toBeInTheDocument()
  })

  test('a row action dispatches through onAct', async () => {
    const onAct = vi.fn()
    const row = item({ id: 'habit:z', title: 'Súlymérés' })
    renderMorning({ open: [row], onAct })
    await userEvent.click(screen.getByRole('button', { name: 'Indítsd' }))
    expect(onAct).toHaveBeenCalledWith(row)
  })

  test('empty facts ghost the strip', () => {
    const { container } = renderMorning({ facts: [] })
    expect(container.querySelector('.isl-facts')).toBeNull()
  })
})
