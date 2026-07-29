import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ItemCard } from '@/shared/ui/ItemCard'

describe('ItemCard', () => {
  test('renders eyebrow tag, time, title and one metapill per truthy fact', () => {
    const { container } = render(
      <ItemCard tone="gym" emoji="🏋️" tag="GYM" time="17:00" title="Pull Day"
        facts={['5 gyakorlat', null, '~78 perc', false]} logged={false} />,
    )
    expect(screen.getByText('GYM')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pull Day' })).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(2)
    expect(container.querySelector('.todaycard-gym')).toBeTruthy()
  })

  test('without ctaLabel the card is read-only — no button', () => {
    render(<ItemCard tone="run" emoji="🏃" tag="FUTÁS" title="6 km" facts={[]} logged={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('with ctaLabel + onLog renders the CTA and fires it', async () => {
    const onLog = vi.fn()
    render(<ItemCard tone="run" emoji="🏃" tag="FUTÁS" title="6 km" facts={[]}
      logged={false} ctaLabel="Naplózd a futást" onLog={onLog} />)
    screen.getByRole('button', { name: /Naplózd a futást/ }).click()
    expect(onLog).toHaveBeenCalledOnce()
  })

  test('logged swaps the shield to a check, adds MEGVAN and renders the DoneBar instead of pills/CTA', () => {
    const { container } = render(
      <ItemCard tone="sport" emoji="🏐" tag="RÖPI" time="18:00" title="Röplabda"
        facts={['90 perc']} logged loggedSummary="RPE 7 · 90p" loggedDetail="18:05-kor logolva"
        stateLabel="MA" ctaLabel="Logold" onLog={() => {}} />,
    )
    expect(screen.getByText(/RÖPI · MEGVAN/)).toBeInTheDocument()
    expect(screen.getByText('RPE 7 · 90p')).toBeInTheDocument()
    expect(screen.getByText('18:05-kor logolva')).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(0)
    expect(container.querySelector('.todaycard-cta')).toBeNull()
    expect(container.querySelector('.todaycard.logged')).toBeTruthy()
  })

  test('stateLabel renders while open and is suppressed once logged', () => {
    const { rerender, container } = render(
      <ItemCard tone="gym" emoji="🏋️" tag="GYM" title="Pull Day" facts={[]} logged={false} stateLabel="TERVEZETT" />,
    )
    expect(container.querySelector('.todaycard-state')?.textContent).toBe('TERVEZETT')
    rerender(<ItemCard tone="gym" emoji="🏋️" tag="GYM" title="Pull Day" facts={[]} logged loggedSummary="Kész" stateLabel="TERVEZETT" />)
    expect(container.querySelector('.todaycard-state')).toBeNull()
  })
})
