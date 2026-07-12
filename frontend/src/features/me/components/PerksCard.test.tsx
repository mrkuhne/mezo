import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PerksCard } from '@/features/me/components/PerksCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

test('renders each perk row with name, effect copy and SKILL · LVn', () => {
  render(<PerksCard perks={achievementsMock.perks} />)
  expect(screen.getByText('Perkek — mérföldkövek')).toBeInTheDocument()
  expect(screen.getByText('3 feloldva')).toBeInTheDocument()
  expect(screen.getByText('Páncélzat')).toBeInTheDocument()
  expect(screen.getByText('10 hét töretlen — sérülésállóság nő')).toBeInTheDocument()
  expect(screen.getByText('robustness · LV10')).toBeInTheDocument()
  expect(screen.getByText('max_strength · LV5')).toBeInTheDocument()
})

test('empty perks render the empty-state copy', () => {
  render(<PerksCard perks={[]} />)
  expect(screen.getByText('0 feloldva')).toBeInTheDocument()
  expect(screen.getByText(/Még nincs feloldott perk/)).toBeInTheDocument()
})
