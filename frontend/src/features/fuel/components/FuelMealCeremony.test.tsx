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
import { CEREMONY_MS } from '@/shared/ui/folyadek'
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
    // a címsor a képernyő bejelentése; a csillagszám a színpad felirata
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A napod része lett')
    expect(screen.getByText('5 csillag az ötből')).toBeInTheDocument()
    expect(screen.getByText('Hibátlan választás.')).toBeInTheDocument()
    expect(screen.getByText('Túrós zabkása · áfonyával · 07:15')).toBeInTheDocument()
    // a négy számláló a VÉGSŐ értéken áll (nem 0-n), mert nincs menet
    const counts = [...container.querySelectorAll('[data-cer-count]')].map((el) => el.textContent)
    expect(counts).toEqual(['689', '49', '74', '21'])
    expect(screen.getByText('g zsír')).toBeInTheDocument()
    // öt hely, ebből öt ég
    expect(container.querySelectorAll('[data-cer-star]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-cer-star].is-lit')).toHaveLength(5)
    // a pontszám magyar tizedesvesszővel a kehelyben, a /10 skálán
    expect(container.querySelector('.fg-cup text')).toHaveTextContent('8,3')
    expect(screen.getByRole('img', { name: 'Mezo értékelése: 8,3 a tízes skálán' })).toBeInTheDocument()
  })

  test('gyengébb pontszám: kevesebb csillag ég, és a verdikt is ehhez igazodik', () => {
    const { container } = setup({ scoreOutOfTen: 5.2 })
    expect(screen.getByText('3 csillag az ötből')).toBeInTheDocument()
    expect(screen.getByText('Rendben van.')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-cer-star].is-lit')).toHaveLength(3)
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

  test('EGY szám, EGY kerekítés: a menet a csillagokig fut, a kehely szintje a pontszám maga', () => {
    const { container } = setup()
    const stage = container.querySelector('[data-cer-stage]') as HTMLElement
    // 8,3 → 5 csillag: a menet vége 1 (5/5), a kehely 83%-ig telik (--p × --k)
    expect(Number(stage.style.getPropertyValue('--p'))).toBe(1)
    expect(Number(stage.style.getPropertyValue('--k'))).toBeCloseTo(0.83)
  })

  test('a címsor „Bezárás" gombja is a naphoz visz vissza', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Bezárás' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('a menet a kit EGY menete: előbb nullák, a végén a számok és a csillagok a végértéken landolnak', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
    const { container } = setup({ reducedMotion: false })
    const root = container.querySelector('.fo-cer') as HTMLElement
    const stage = container.querySelector('[data-cer-stage]') as HTMLElement
    const lit = () => container.querySelectorAll('[data-cer-star].is-lit').length
    expect(root).not.toHaveClass('told')
    expect(stage.style.getPropertyValue('--p')).toBe('0')
    expect(lit()).toBe(0)
    expect(container.querySelector('[data-cer-count]')).toHaveTextContent('0')
    // mezo-7tj3j: az első frame horgonyoz (started = az első rAF-időbélyeg), utána mér.
    frames.shift()?.(0)
    frames.shift()?.(CEREMONY_MS.stars / 2)
    expect(Number(stage.style.getPropertyValue('--p'))).toBeGreaterThan(0)
    expect(lit()).toBeGreaterThan(0)
    expect(root).not.toHaveClass('b1')
    frames.shift()?.(CEREMONY_MS.b1)
    expect(root).toHaveClass('b1')
    expect(lit()).toBe(5)
    act(() => { frames.shift()?.(CEREMONY_MS.total) })
    expect(root).toHaveClass('told')
    const counts = [...container.querySelectorAll('[data-cer-count]')].map((el) => el.textContent)
    expect(counts).toEqual(['689', '49', '74', '21'])
    vi.restoreAllMocks()
  })

  test('csökkentett mozgás: nincs menet — a végállapot az első rendertől áll', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const { container } = setup()
    expect(container.querySelector('.fo-cer')).toHaveClass('told', 'inst')
    expect(raf).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  test('folyadékban: nincs üveglap és gyűrű — a csillagok és a kehely a jelkészletből, a régi bőr nélkül', () => {
    const { container } = setup()
    expect(container.querySelector('.glass, [class*="fcx-"], [class*="uv-"]')).toBeNull()
    expect(container.querySelector('circle')).toBeNull()
    expect(container.querySelectorAll('.fg-cst .on use')).toHaveLength(5)
    expect(container.querySelector('.fg-cst .on use')).toHaveAttribute('href', '#t-star')
    expect(screen.getByText('Mezo értékelése')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Ez került a napodba/ })).toBeInTheDocument()
  })

  test('a ceremónia BIRTOKOLJA a képernyőt: modális, saját címkével', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Az étkezésed elkészült' })).toBeInTheDocument()
  })
})
