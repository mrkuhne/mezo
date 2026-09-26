// ============================================================
// Mezo · A kaja-ünneplés őre (mezo-bqwyo).
//
// Amit kikötünk: a ceremónia a MINTA szerint olvasható (csillagok, verdikt, számlálók, kiút),
// csökkentett mozgás mellett AZONNAL a végállapotot festi (nincs menet), és egyetlen számot
// sem talál ki — amit kap, azt mutatja.
// ============================================================
import { act, render, screen } from '@testing-library/react'
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
      fatG={21}
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
    expect(screen.getByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
    expect(screen.getByText('07:15')).toBeInTheDocument()
    // a három számláló a VÉGSŐ értéken áll (nem 0-n), mert nincs menet
    expect(container.querySelector('[data-fcx-count="kcal"]')).toHaveTextContent('689')
    expect(container.querySelector('[data-fcx-count="p"]')).toHaveTextContent('49')
    expect(container.querySelector('[data-fcx-count="c"]')).toHaveTextContent('74')
    expect(container.querySelector('[data-fcx-count="f"]')).toHaveTextContent('21')
    expect(screen.getByText('g zsír')).toBeInTheDocument()
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
        scoreOutOfTen={8.3} mealLabel="X" timeLabel="07:15" kcal={1} proteinG={1} carbsG={1} fatG={1}
        onClose={onClose} onDetails={onDetails} reducedMotion
      />,
    )
    await user.click(screen.getByRole('button', { name: /Részletek/ }))
    expect(onDetails).toHaveBeenCalledOnce()
  })

  test('a pont-gyűrű a §5 meleg kő: #FFE9A8 → #E0AC2F → #A9770F', () => {
    const { container } = setup()
    const stops = [...container.querySelectorAll('.fcx-ring stop')].map((el) => el.getAttribute('stop-color'))
    expect(stops).toEqual(['#FFE9A8', '#E0AC2F', '#A9770F'])
  })

  test('a lap a nap fölé csúszik: a háttérre koppintás is a naphoz visz vissza', async () => {
    const user = userEvent.setup()
    const { container, onClose } = setup()
    expect(container.querySelector('.fcx-screen .fcx-sheet')).not.toBeNull()
    await user.click(container.querySelector('.fcx-scrim') as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('a menet rövid: a lap felcsúszik, a számok és a csillagok a végértéken landolnak', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { container } = setup({ reducedMotion: false })
    const root = container.querySelector('.fcx-screen') as HTMLElement
    expect(root.style.getPropertyValue('--rise')).toBe('1')
    expect(root).not.toHaveClass('is-told')
    // mezo-7tj3j: az első frame horgonyoz (started = az első rAF-időbélyeg), utána mér.
    frames.shift()?.(0)
    frames.shift()?.(1200)
    expect(root).toHaveClass('is-b1')
    expect(root).not.toHaveClass('is-b2')
    act(() => { frames.shift()?.(1500) })
    expect(root).toHaveClass('is-told')
    expect(container.querySelector('[data-fcx-count="kcal"]')).toHaveTextContent('689')
    expect(container.querySelector('[data-fcx-count="f"]')).toHaveTextContent('21')
    expect(container.querySelector('[data-fcx-score]')).toHaveTextContent('8,3')
    expect(container.querySelectorAll('[data-fcx-star].is-lit')).toHaveLength(5)
    vi.restoreAllMocks()
  })

  // U10 (tulajdonos, 2026-09-26): a csillagok akkor indultak, amikor a fiók még emelkedett.
  // Előbb a lap landol, csak utána gyullad a gyűrű, a pont, a csillagok és a számlálók.
  test('ELŐBB a lap, AZTÁN a gyújtás: amíg a lap emelkedik, egy csillag sem ég, minden szám nulla', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { container } = setup({ reducedMotion: false })
    const root = container.querySelector('.fcx-screen') as HTMLElement
    const sheet = container.querySelector('.fcx-sheet') as HTMLElement
    const lit = () => container.querySelectorAll('[data-fcx-star].is-lit').length

    // mezo-7tj3j: az első frame horgonyoz (0 ms), a többi ahhoz mér.
    frames.shift()?.(0)
    // a lap félúton, majd majdnem fent: még emelkedik, és semmi sem gyulladt
    for (const ms of [100, 300, 490]) {
      frames.shift()?.(ms)
      expect(Number(root.style.getPropertyValue('--rise'))).toBeGreaterThan(0)
      expect(sheet.style.getPropertyValue('--p')).toBe('0')
      expect(lit()).toBe(0)
      expect(container.querySelector('[data-fcx-score]')).toHaveTextContent('0,0')
      expect(container.querySelector('[data-fcx-count="kcal"]')).toHaveTextContent('0')
    }
    // a lap landolt: a gyújtás CSAK most indul
    frames.shift()?.(500)
    expect(root.style.getPropertyValue('--rise')).toBe('0')
    expect(lit()).toBe(0)
    // a gyújtás közepén már égnek csillagok, a lap a helyén marad
    frames.shift()?.(900)
    expect(root.style.getPropertyValue('--rise')).toBe('0')
    expect(Number(sheet.style.getPropertyValue('--p'))).toBeGreaterThan(0)
    expect(lit()).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  test('csökkentett mozgás: nincs csúszás — a lap az első rendertől a helyén áll', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const { container } = setup()
    expect((container.querySelector('.fcx-screen') as HTMLElement).style.getPropertyValue('--rise')).toBe('0')
    expect(raf).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  test('üvegben: a lap egy arany üveglap, a számlálók 3D ikonokat viselnek', () => {
    const { container } = setup()
    expect(container.querySelector('.fcx-sheet')).toHaveClass('glass')
    const icons = [...container.querySelectorAll('.fcx-counters use')].map((u) => u.getAttribute('href'))
    expect(icons).toEqual(['#t-plate', '#t-protein', '#t-carb', '#t-fat'])
    expect(container.querySelector('.fcx-medal use')).toHaveAttribute('href', '#t-score')
    expect(container.querySelectorAll('.fcx-stars .fcx-star-on use')).toHaveLength(5)
    expect(screen.getByText('Mezo értékelése')).toBeInTheDocument()
  })

  test('a ceremónia BIRTOKOLJA a képernyőt: modális, saját címkével', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeInTheDocument()
  })
})
