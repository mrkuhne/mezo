import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { IslandMorning } from '@/features/today/components/IslandMorning'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { briefing } from '@/data/today/today'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Mobilitás videó', subtitle: '8 perc', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Indítsd' } as TodayItem['action'], linkUrl: null, ...over,
})

const renderMorning = (over: Partial<Parameters<typeof IslandMorning>[0]> = {}) => {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <IslandMorning
              hero={{ value: '7,2', unit: 'óra alvás', sub: '0,3 órával a célod alatt' }}
              facts={[{ label: 'Súly', value: '78,6', unit: 'kg', delta: { text: '↘ −0,4 a héten', tone: 'good' } }]}
              next={item()}
              open={[item(), item({ id: 'habit:b', title: 'Protein reggeli' }), item({ id: 'habit:c', title: 'Vízcél' })]}
              done={[item({ id: 'habit:d', status: 'done', title: 'Mérés' })]}
              doneXp={45}
              listOpen={false}
              onToggleList={() => {}}
              briefing={briefing}
              celebrations={[]}
              onAct={() => {}}
              {...over}
            />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

describe('IslandMorning', () => {
  test('hero value, unit and sub render', () => {
    renderMorning()
    expect(screen.getByText('7,2')).toBeInTheDocument()
    expect(screen.getByText('óra alvás')).toBeInTheDocument()
    expect(screen.getByText('0,3 órával a célod alatt')).toBeInTheDocument()
  })

  test('facts strip renders the delta; absent when facts empty', () => {
    const { container, unmount } = renderMorning()
    expect(container.querySelector('.isl-fact-d.is-good')!.textContent).toContain('−0,4')
    unmount()
    const { container: c2 } = renderMorning({ facts: [] })
    expect(c2.querySelector('.isl-facts')).toBeNull()
  })

  test('the CTA fires onAct with the promoted item', async () => {
    const onAct = vi.fn()
    const next = item({ id: 'habit:next' })
    renderMorning({ next, onAct })
    await userEvent.click(screen.getByRole('button', { name: 'Mobilitás videó' }))
    expect(onAct).toHaveBeenCalledWith(next)
  })

  test('még N › excludes the promoted item and opens the list', async () => {
    const onToggleList = vi.fn()
    renderMorning({ onToggleList })
    await userEvent.click(screen.getByRole('button', { name: 'még 2 ›' }))
    expect(onToggleList).toHaveBeenCalledWith(true)
  })

  test('doneline shows count+xp and is hidden at zero done', () => {
    const { unmount } = renderMorning()
    expect(screen.getByText('✓ 1 kész ma · +45 XP')).toBeInTheDocument()
    unmount()
    renderMorning({ done: [], doneXp: 0 })
    expect(screen.queryByText(/kész ma/)).toBeNull()
  })

  test('open list state renders the briefing head, Fókusz group and összecsuk', () => {
    renderMorning({ listOpen: true })
    expect(screen.getByText(/reggeli briefing/i)).toBeInTheDocument()
    expect(screen.getByText('Fókusz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'összecsuk ↑' })).toBeInTheDocument()
  })
})
