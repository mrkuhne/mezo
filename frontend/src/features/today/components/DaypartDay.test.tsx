import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { DaypartDay, type DayHero } from '@/features/today/components/DaypartDay'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { QueryWrapper } from '@/test/queryWrapper'

const hero: DayHero = {
  tone: 'gym', emoji: '🏋️', tag: 'GYM · Pull', time: '13:00', title: 'Pull A',
  facts: ['6 gyakorlat', '~55 perc'], logged: false, ctaLabel: 'Indítsuk', onLog: () => {},
}

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'fuel:lunch', source: 'fuel', face: 'nap', status: 'open', tone: 'fuel', emoji: '🥗',
  tag: 'ÉTKEZÉS', title: 'Ebéd', subtitle: '~650 kcal', time: null, xp: 0,
  group: 'Étkezés', action: { kind: 'nav', to: '/fuel', label: 'Logold' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderDay = (over: Partial<Parameters<typeof DaypartDay>[0]> = {}) =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <DaypartDay
          hero={hero}
          facts={[{ label: 'Fehérje', value: '84', unit: '/160 g', delta: { text: '76 g van hátra', tone: 'warn' } }]}
          mesoLine="3. mezóhét"
          open={[item()]}
          done={[]}
          doneXp={0}
          celebrations={[]}
          onAct={() => {}}
          onCustom={() => {}}
          {...over}
        />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('DaypartDay', () => {
  test('the session hero renders with its CTA', async () => {
    const onLog = vi.fn()
    renderDay({ hero: { ...hero, onLog } })
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.getByText(/Pull A/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Indítsuk' }))
    expect(onLog).toHaveBeenCalled()
  })

  // mezo-v84m — a finished session must not keep offering its start CTA. The hero stays
  // (the day still happened at 13:00), the button is replaced by the done footnote.
  test('a logged session drops the CTA for a done footnote', () => {
    const onLog = vi.fn()
    const { container } = renderDay({
      hero: { ...hero, logged: true, loggedSummary: 'Kész · 18 szett', onLog },
    })
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Indítsuk' })).toBeNull()
    expect(container.querySelector('.td-foot.is-done')?.textContent).toContain('Kész · 18 szett')
    expect(onLog).not.toHaveBeenCalled()
  })

  test('a logged session with no summary still reads Kész', () => {
    const { container } = renderDay({ hero: { ...hero, logged: true } })
    expect(screen.queryByRole('button', { name: 'Indítsuk' })).toBeNull()
    expect(container.querySelector('.td-foot.is-done')?.textContent).toContain('Kész')
  })

  test('a rest day reads Pihenő and offers Saját edzés', async () => {
    const onCustom = vi.fn()
    renderDay({ hero: null, onCustom })
    expect(screen.getByText('Pihenő')).toBeInTheDocument()
    expect(screen.getByText('Ma nincs tervezett edzés')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saját edzés' }))
    expect(onCustom).toHaveBeenCalled()
  })

  test('the niggle warning renders as a plain footnote below the CTA', () => {
    const { container } = renderDay({ heroWarn: 'Bal váll — figyelj a tempóra' })
    expect(screen.getByText(/Bal váll/)).toBeInTheDocument()
    expect(container.querySelector('.td-foot.is-warn')).toBeInTheDocument()
  })

  test('rows are visible with no unfolding', () => {
    renderDay()
    expect(screen.getByText('Ebéd')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
  })
})
