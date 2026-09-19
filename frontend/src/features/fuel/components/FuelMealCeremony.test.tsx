// ============================================================
// Mezo · A kaja-ünneplés őre (mezo-bqwyo).
//
// Amit kikötünk: a ceremónia a MINTA szerint olvasható (csillagok, verdikt, számlálók, kiút),
// csökkentett mozgás mellett AZONNAL a végállapotot festi (nincs menet), és egyetlen számot
// sem talál ki — amit kap, azt mutatja.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { FuelMealCeremony } from './FuelMealCeremony'

function setup(props: Partial<React.ComponentProps<typeof FuelMealCeremony>> = {}) {
  const onClose = vi.fn()
  const view = render(
    <FuelMealCeremony
      scoreOutOfTen={8.3}
      mealLabel="Túrós zabkása · áfonyával"
      timeLabel="07:15"
      kcal={689}
      proteinG={49}
      carbsG={74}
      onClose={onClose}
      reducedMotion
      {...props}
    />,
  )
  return { ...view, onClose }
}

describe('FuelMealCeremony', () => {
  test('csökkentett mozgás: az első render MÁR a végállapot — számok, csillagok, verdikt', () => {
    const { container } = setup()
    // a fejléc a képernyőolvasó bejelentése: hány csillag
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('5 csillag az ötből')
    expect(screen.getByText('Hibátlan választás.')).toBeInTheDocument()
    expect(screen.getByText('Túrós zabkása · áfonyával · 07:15')).toBeInTheDocument()
    // a három számláló a VÉGSŐ értéken áll (nem 0-n), mert nincs menet
    expect(container.querySelector('[data-fcx-count="kcal"]')).toHaveTextContent('689')
    expect(container.querySelector('[data-fcx-count="p"]')).toHaveTextContent('49')
    expect(container.querySelector('[data-fcx-count="c"]')).toHaveTextContent('74')
    // öt hely, ebből öt ég
    expect(container.querySelectorAll('[data-fcx-star]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-fcx-star].is-lit')).toHaveLength(5)
    // a pontszám magyar tizedesvesszővel, a /10 skálán
    expect(container.querySelector('.fcx-score')).toHaveTextContent('8,3')
  })

  test('gyengébb pontszám: kevesebb csillag ég, és a verdikt is ehhez igazodik', () => {
    const { container } = setup({ scoreOutOfTen: 5.2 })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('3 csillag az ötből')
    expect(screen.getByText('Rendben van.')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-fcx-star].is-lit')).toHaveLength(3)
  })

  test('a kiút egy koppintás, és a Részletek csak akkor van ott, ha van hova vinnie', async () => {
    const user = userEvent.setup()
    const onDetails = vi.fn()
    const { onClose, rerender } = setup()
    expect(screen.queryByRole('button', { name: /Részletek/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vissza a naphoz' }))
    expect(onClose).toHaveBeenCalledOnce()

    rerender(
      <FuelMealCeremony
        scoreOutOfTen={8.3} mealLabel="X" timeLabel="07:15" kcal={1} proteinG={1} carbsG={1}
        onClose={onClose} onDetails={onDetails} reducedMotion
      />,
    )
    await user.click(screen.getByRole('button', { name: /Részletek/ }))
    expect(onDetails).toHaveBeenCalledOnce()
  })

  test('a ceremónia BIRTOKOLJA a képernyőt: modális, saját címkével', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeInTheDocument()
  })
})
