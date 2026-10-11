import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { SportCeremony } from '@/features/train/components/SportCeremony'
import type { SportScore } from '@/features/train/logic/sportScore'

// 0.5 ratio → starsFor(0.5) = round(5)/2 = 2.5
const SCORE: SportScore = { ratio: 0.5, stars: 2.5 }

function props(overrides: Partial<Parameters<typeof SportCeremony>[0]> = {}) {
  return {
    score: SCORE,
    sportName: 'Kerékpár',
    minutes: 30,
    rpe: 5,
    kcal: null,
    xpGained: null,
    onClose: vi.fn(),
    reducedMotion: true,
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

// ---- reduced motion: final state, no pass ----

test('reduced motion paints the final state instantly: told, counters at the real values, stars lit to the score', () => {
  const { container } = render(<SportCeremony {...props()} />)
  expect(container.querySelector('.fo-cer')).toHaveClass('b1', 'b2', 'b3', 'told', 'inst')
  const stage = container.querySelector('[data-cer-stage]') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0.5')
  const facts = [...container.querySelectorAll('.ec-tally > div')].map((d) => d.textContent)
  // Wording: the felt effort in everyday words, never „RPE".
  expect(facts).toEqual(['30perc', '5megélt terhelés · 10-ből'])
  expect(screen.queryByText('RPE')).not.toBeInTheDocument()
  // 2 of 5 stars lit, the third half (2.5/5 = .5 progressed).
  const stars = container.querySelectorAll('.fo-cer-stars i')
  expect(stars).toHaveLength(5)
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(2)
  expect(container.querySelectorAll('.fo-cer-stars i.is-half')).toHaveLength(1)
})

test('the stage\'s overline names the sport, the day and the stars with a Hungarian decimal comma', () => {
  const { container } = render(<SportCeremony {...props({ sportName: 'Kerékpár' })} />)
  expect(container.querySelector('.fo-cer-stage .fo-hero-lbl')).toHaveTextContent('Kerékpár · ma · 2,5 csillag az ötből')
  expect(screen.getByText('A kehely az edzésidőből és az erőfeszítésből telt meg.')).toBeInTheDocument()
})

test('the screen draws its own title row (the route is chrome-free); the title takes focus and the back is the way out', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const { container } = render(<SportCeremony {...props({ onClose })} />)
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveTextContent('Mozgás lezárva')
  expect(heading).toHaveFocus()
  expect(container.querySelector('.ec-top small')).toHaveTextContent('Kerékpár · ma')
  await user.click(container.querySelector('.ec-top .fo-back') as HTMLElement)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('the verdict sentence comes from the star count (the same ladder as the gym ceremony)', () => {
  render(<SportCeremony {...props({ score: { ratio: 0.9, stars: 4.5 } })} />)
  expect(screen.getByText('Erős nap.')).toBeInTheDocument()
})

// ---- the single pass ----

test('the rAF pass runs exactly once — a re-render never restarts it', () => {
  const frames: FrameRequestCallback[] = []
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb)
    return frames.length
  })
  const { container, rerender } = render(<SportCeremony {...props({ reducedMotion: false })} />)
  expect(raf).toHaveBeenCalledTimes(1)
  expect(container.querySelector('.fo-cer')).not.toHaveClass('told')
  rerender(<SportCeremony {...props({ reducedMotion: false, xpGained: 80 })} />)
  expect(raf).toHaveBeenCalledTimes(1)
})

test('the pass drives --p, the star classes and — in its last stretch — the counters, then tells the reading', () => {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb)
    return frames.length
  })
  const now = vi.spyOn(performance, 'now')
  now.mockReturnValue(0)
  const { container } = render(<SportCeremony {...props({ reducedMotion: false, kcal: { value: 420, isEstimate: true } })} />)
  const stage = container.querySelector('[data-cer-stage]') as HTMLElement
  const root = container.querySelector('.fo-cer') as HTMLElement
  const counts = () => [...container.querySelectorAll('.ec-tally [data-cer-count]')].map((el) => el.textContent)
  expect(stage.style.getPropertyValue('--p')).toBe('0')
  expect(counts()).toEqual(['0', '0', '0'])
  // mezo-7tj3j: az első frame horgonyoz (started = az első rAF-időbélyeg), utána mér.
  frames.shift()?.(0)
  // Halfway through the 1700 ms star phase (the gym ceremony's own timing): cubic ease-out .875 of the ratio.
  frames.shift()?.(850)
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.4375, 5)
  expect(root).not.toHaveClass('b1')
  expect(counts()).toEqual(['0', '0', '0'])
  // 2100 ms: the verdict and the numbers are in; the counters are on their way.
  frames.shift()?.(2100)
  expect(root).toHaveClass('b1')
  expect(root).toHaveClass('b2')
  expect(root).not.toHaveClass('told')
  act(() => { frames.shift()?.(2700) })
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.5, 5)
  expect(counts()).toEqual(['30', '5', '420'])
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(2)
  expect(root).toHaveClass('told')
})

// ---- the XP row (the level-up overlay is not raised on this path any more) ----

test('no xpGained means no XP row at all — never a fabricated number', () => {
  const { container } = render(<SportCeremony {...props()} />)
  expect(container.querySelector('.ec-xp')).toBeNull()
  expect(screen.queryByText(/szerzett XP/)).not.toBeInTheDocument()
})

test('the XP the save earned is a row ON the closing screen, with the coin: „+N szerzett XP · a mai mozgásért"', () => {
  const { container } = render(<SportCeremony {...props({ xpGained: 240 })} />)
  const row = container.querySelector('.ec-numbers .ec-xp .fo-row') as HTMLElement
  expect(row.querySelector('strong')).toHaveTextContent('+240 szerzett XP')
  expect(row.querySelector('small')).toHaveTextContent('a mai mozgásért')
  expect(row.querySelector('use')).toHaveAttribute('href', '#t-coin')
})

// ---- the kcal tile: three states ----

test('the kcal tile is absent when kcal is unknown — no 0 kcal, no kcal counter either', () => {
  const { container } = render(<SportCeremony {...props()} />)
  expect(container.querySelector('.ec-kcal')).toBeNull()
  expect(container.querySelectorAll('.ec-tally [data-cer-count]')).toHaveLength(2)
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
  expect(screen.queryByText('A mai mozgással')).not.toBeInTheDocument()
})

test('the kcal tile says it is an estimate when the wire says isEstimate', () => {
  const { container } = render(<SportCeremony {...props({ kcal: { value: 420, isEstimate: true } })} />)
  expect(screen.getByText('A mai mozgással')).toBeInTheDocument()
  expect(screen.getByText('+420 kcal került a mai keretedbe')).toBeInTheDocument()
  expect(screen.getByText('Becslés, nem mérés')).toBeInTheDocument()
  expect(screen.queryByText('Saját értéked')).not.toBeInTheDocument()
  // The counter and the tile both show the real value.
  expect([...container.querySelectorAll('.ec-tally > div')].map((d) => d.textContent)).toEqual(['30perc', '5megélt terhelés · 10-ből', '420kcal'])
})

test('the kcal tile says it is the athlete\'s own value when the wire says the override won', () => {
  render(<SportCeremony {...props({ kcal: { value: 640, isEstimate: false } })} />)
  expect(screen.getByText('Saját értéked')).toBeInTheDocument()
  expect(screen.queryByText('Becslés, nem mérés')).not.toBeInTheDocument()
})

// ---- the way out ----

test('the foot is a short „Vissza a mai napra" with „<sport> · elmentve" under it, and goes back to Mai', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const { container } = render(<SportCeremony {...props({ onClose, sportName: 'Foci' })} />)
  const foot = container.querySelector('.ec-sport > .fo-foot.nonav > .fo-fcol') as HTMLElement
  expect(foot.querySelector('.fo-btn')).toHaveTextContent(/^Vissza a mai napra$/)
  expect(foot.querySelector('.fo-fsub')).toHaveTextContent('Foci · elmentve')
  await user.click(foot.querySelector('.fo-btn') as HTMLElement)
  expect(onClose).toHaveBeenCalledTimes(1)
})

// ---- Folyadék (mezo-n4wf5.4): the liquid ceremony family ----

test('it wears the Folyadék ceremony: sprite stars over the cup, numbered cards, the gold kcal row — nothing of the glass skin', () => {
  const { container } = render(<SportCeremony {...props({ kcal: { value: 300, isEstimate: true }, xpGained: 50 })} />)
  expect(container.querySelector('.fo-page')).toHaveClass('ec-page', 'ec-sport', 'nonav', 'has-foot')
  expect(container.querySelectorAll('.fo-cer-stars i')[0].querySelectorAll('use')).toHaveLength(3)
  expect(container.querySelector('.fo-cup svg')?.getAttribute('viewBox')).toBe('0 -34 200 166')
  // A sport session sets no record: the cup never spills here.
  expect(container.querySelectorAll('.fo-cup .sp')).toHaveLength(0)
  expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1A mai számok', '2A mai mozgással'])
  expect(container.querySelector('.ec-kcal')).toHaveClass('fo-card', 'gold')
  expect(container.querySelector('.ec-kcal .fo-bub use')).toHaveAttribute('href', '#t-bowl')
  expect(container.querySelector('[class^="cer-"], [class*=" cer-"], .glass, [class*="uv-"]')).toBeNull()
})

// ---- the honesty line ----

test('the honesty line names time and effort, not a machine\'s judgement', () => {
  render(<SportCeremony {...props()} />)
  expect(screen.getByText(
    'A csillagok az edzésidőből és az erőfeszítésből számolnak, nem gépi értékelés.',
  )).toBeInTheDocument()
  expect(screen.queryByText(/AI-értékelés/)).not.toBeInTheDocument()
})

// ---- copy discipline ----

test('no emoji anywhere — the art is the sprite', () => {
  const { container } = render(<SportCeremony {...props({ kcal: { value: 300, isEstimate: true }, xpGained: 50 })} />)
  const emoji = /\p{Extended_Pictographic}/u
  expect(container.textContent ?? '').not.toMatch(emoji)
})
