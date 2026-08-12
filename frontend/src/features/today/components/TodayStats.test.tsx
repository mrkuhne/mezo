import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TodayStats } from '@/features/today/components/TodayStats'
import type { IslandFact } from '@/features/today/logic/islandFacts'

const weight: IslandFact = {
  label: 'Súly', value: '78,6', unit: 'kg',
  delta: { text: '−0,6 a héten · cél 73,0', tone: 'good' },
}
const hrv: IslandFact = { label: 'HRV', value: '64', unit: 'ms' }

describe('TodayStats', () => {
  test('üres listán semmit nem renderel (strip-filozófia: nincs forrás → nincs cella)', () => {
    const { container } = render(<TodayStats facts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('minden cella EGY dobozban ül', () => {
    const { container } = render(<TodayStats facts={[weight, hrv]} />)
    expect(container.querySelectorAll('.td-stats')).toHaveLength(1)
    expect(container.querySelectorAll('.td-stat')).toHaveLength(2)
  })

  test('érték, egység, címke és delta mind megjelenik', () => {
    render(<TodayStats facts={[weight]} />)
    expect(screen.getByText('78,6')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('Súly')).toBeInTheDocument()
    expect(screen.getByText('−0,6 a héten · cél 73,0')).toBeInTheDocument()
  })

  test('a delta hangneme osztályba fordul', () => {
    const { container } = render(<TodayStats facts={[weight]} />)
    expect(container.querySelector('.td-stat-d')).toHaveClass('is-good')
  })

  test('delta nélküli cella nem hagy üres helyet', () => {
    const { container } = render(<TodayStats facts={[hrv]} />)
    expect(container.querySelector('.td-stat-d')).toBeNull()
  })

  test('a rács a cellák számát követi', () => {
    const { container } = render(<TodayStats facts={[weight, hrv]} />)
    const box = container.querySelector('.td-stats') as HTMLElement
    expect(box.style.gridTemplateColumns).toBe('repeat(2, 1fr)')
  })
})
