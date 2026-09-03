import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PerksCard } from '@/features/me/components/PerksCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

test('rows show Lv plaque, name, effect and skill; footer names the next milestone', () => {
  render(<PerksCard perks={achievementsMock.perks} next={{ name: 'Lát', level: 10 }} />)
  expect(screen.getByText('3 feloldva')).toBeInTheDocument()
  // Two perks share milestoneLevel 10 (armor_plating_1, afterburner_1) → getAllByText, not getByText.
  expect(screen.getAllByText('Lv10').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('Páncélzat')).toBeInTheDocument()
  expect(screen.getByText(/a következő: Lát Lv 10/)).toBeInTheDocument()
})
test('empty perks: the honest line; no next → footer without the second clause', () => {
  render(<PerksCard perks={[]} next={null} />)
  expect(screen.getByText('Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.')).toBeInTheDocument()
})
