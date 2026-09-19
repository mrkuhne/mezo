// ============================================================
// Mezo · A kaja-ünneplés gazdája (mezo-bqwyo).
//
// Amit őrizünk: a mentés MEGNYITJA a ceremóniát (ez a feature lényege), pontszám nélkül
// viszont NEM (őszinte-null), és a kiút tényleg leszedi a képernyőről.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MealCeremonyProvider, useMealCeremony, type MealCelebration } from './MealCeremonyProvider'

const MEAL: MealCelebration = {
  mealId: 'm-1', score: 0.83, label: 'Túrós zabkása', timeLabel: '07:15',
  kcal: 689, proteinG: 49, carbsG: 74, hasBreakdown: true,
}

function Saver({ meal }: { meal: MealCelebration }) {
  const { celebrateMeal } = useMealCeremony()
  return <button type="button" onClick={() => celebrateMeal(meal)}>Mentés</button>
}

describe('MealCeremonyProvider', () => {
  test('a mentés megnyitja az ünneplést, a kiút pedig leveszi', async () => {
    const user = userEvent.setup()
    render(<MealCeremonyProvider><Saver meal={MEAL} /></MealCeremonyProvider>)
    expect(screen.queryByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(screen.getByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeInTheDocument()
    // a 0..1-es drót-pontszám a /10 skálán jelenik meg
    expect(document.querySelector('.fcx-score')).toHaveTextContent('8,3')
    expect(screen.getByText('Túrós zabkása · 07:15')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Vissza a naphoz' }))
    expect(screen.queryByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeNull()
  })

  test('PONTSZÁM NÉLKÜL nincs ceremónia — a csillag nem születhet a semmiből', async () => {
    const user = userEvent.setup()
    render(<MealCeremonyProvider><Saver meal={{ ...MEAL, score: null }} /></MealCeremonyProvider>)
    await user.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(screen.queryByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeNull()
  })

  test('a Részletek a shell útvonalára visz, és közben bezárja a ceremóniát', async () => {
    const user = userEvent.setup()
    const onDetails = vi.fn()
    render(
      <MealCeremonyProvider onDetails={onDetails}><Saver meal={MEAL} /></MealCeremonyProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Mentés' }))
    await user.click(screen.getByRole('button', { name: /Részletek/ }))
    expect(onDetails).toHaveBeenCalledWith('m-1')
    expect(screen.queryByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeNull()
  })

  test('provider nélkül a hívás néma no-op — a naplózás sosem bukhat el rajta', async () => {
    const user = userEvent.setup()
    render(<Saver meal={MEAL} />)
    await user.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
