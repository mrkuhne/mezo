import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import type { DayHero } from '@/features/today/components/IslandDay'
import { IslandDay } from '@/features/today/components/IslandDay'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'quest:a', source: 'quest', face: 'all', status: 'open', tone: 'body', emoji: '⚡',
  tag: 'QUEST', title: 'Vízcél', subtitle: null, time: null, xp: 10,
  group: 'Napi küldetések', action: { kind: 'nav', to: '/x', label: '+250 ml' } as TodayItem['action'], linkUrl: null, ...over,
})

const gymHero: DayHero = {
  tone: 'gym', emoji: '🏋️', tag: 'GYM', time: '13:00', title: 'Pull A',
  facts: ['6 gyakorlat', '55 perc'], logged: false, ctaLabel: 'Indítsuk', onLog: vi.fn(),
}

const renderDay = (over: Partial<Parameters<typeof IslandDay>[0]> = {}) =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <IslandDay
            hero={gymHero}
            facts={[{ label: 'Fehérje ma', value: '62', unit: 'g', delta: { text: 'cél 160 g', tone: 'warn' } }]}
            mesoLine="5. mezóhét"
            open={[item()]}
            done={[]}
            doneXp={0}
            listOpen={false}
            onToggleList={() => {}}
            note={null}
            celebrations={[]}
            onAct={() => {}}
            onCustom={() => {}}
            {...over}
          />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

describe('IslandDay', () => {
  test('gym hero renders time + title and the CTA fires onLog', async () => {
    const onLog = vi.fn()
    renderDay({ hero: { ...gymHero, onLog } })
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.getByText(/Pull A/)).toBeInTheDocument()
    expect(screen.getByText('5. mezóhét')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Indítsuk' }))
    expect(onLog).toHaveBeenCalled()
  })

  test('rest day renders Pihenő and Saját edzés fires onCustom', async () => {
    const onCustom = vi.fn()
    renderDay({ hero: null, onCustom })
    expect(screen.getByText('Pihenő')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saját edzés' }))
    expect(onCustom).toHaveBeenCalled()
  })

  test('warn chip renders only with heroWarn', () => {
    const { unmount } = renderDay({ heroWarn: 'váll-niggle: óvatos bemelegítés' })
    expect(screen.getByText(/váll-niggle/)).toBeInTheDocument()
    unmount()
    renderDay()
    expect(screen.queryByText(/váll-niggle/)).toBeNull()
  })

  test('facts strip renders the protein cell', () => {
    const { container } = renderDay()
    expect(container.querySelector('.isl-fact-d.is-warn')!.textContent).toBe('cél 160 g')
  })

  test('open list shows the companion note head', () => {
    renderDay({ listOpen: true, note: { window: '13:00', kind: 'nudge', text: 'Szép tempó.' } })
    expect(screen.getByText('Szép tempó.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'összecsuk ↑' })).toBeInTheDocument()
  })
})
