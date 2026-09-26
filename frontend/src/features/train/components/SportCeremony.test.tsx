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
    art: 't-bike' as const,
    color: '#c8e895',
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
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
  const stage = container.querySelector('.cer') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0.5')
  expect(container.querySelector('[data-cer-count="perc"]')).toHaveTextContent('30')
  expect(container.querySelector('[data-cer-count="rpe"]')).toHaveTextContent('5')
  expect(screen.getByText('perc')).toBeInTheDocument()
  expect(screen.getByText('RPE')).toBeInTheDocument()
  // 2 of 5 stars lit, the third half (2.5/5 = .5 progressed).
  const stars = container.querySelectorAll('.cer-stars i')
  expect(stars).toHaveLength(5)
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(2)
  expect(container.querySelectorAll('.cer-stars i.is-half')).toHaveLength(1)
})

test('the eyebrow reads the sport name uppercased plus MA', () => {
  render(<SportCeremony {...props({ sportName: 'Kerékpár' })} />)
  expect(screen.getByText('KERÉKPÁR · MA')).toBeInTheDocument()
})

test('the sr-only heading announces the stars with a Hungarian decimal comma and takes focus', () => {
  render(<SportCeremony {...props()} />)
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveTextContent('2,5 csillag az ötből')
  expect(heading).toHaveFocus()
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
  expect(container.querySelector('.cer-screen')).not.toHaveClass('is-told')
  rerender(<SportCeremony {...props({ reducedMotion: false, xpGained: 80 })} />)
  expect(raf).toHaveBeenCalledTimes(1)
})

test('the pass drives --p, the counters and the star classes, then reveals act two', () => {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb)
    return frames.length
  })
  const now = vi.spyOn(performance, 'now')
  now.mockReturnValue(0)
  const { container } = render(<SportCeremony {...props({ reducedMotion: false })} />)
  const stage = container.querySelector('.cer') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0')
  // mezo-7tj3j: az első frame horgonyoz (started = az első rAF-időbélyeg), utána mér.
  frames.shift()?.(0)
  // Halfway through the 2400 ms pass: cubic ease-out 1-(1-.5)^3 = .875 of the ratio.
  frames.shift()?.(1200)
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.4375, 5)
  expect(container.querySelector('.cer-screen')).not.toHaveClass('is-told')
  act(() => { frames.shift()?.(2400) })
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.5, 5)
  expect(container.querySelector('[data-cer-count="perc"]')).toHaveTextContent('30')
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(2)
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
})

// ---- act two: the +XP tile ----

test('no xpGained means no XP chip at all — never a fabricated number', () => {
  const { container } = render(<SportCeremony {...props()} />)
  expect(container.querySelector('.cer-xp')).toBeNull()
  expect(screen.queryByText('szerzett XP')).not.toBeInTheDocument()
})

test('the +XP chip shows only when the response carried XP, as a flat gold chip with the coin', () => {
  const { container } = render(<SportCeremony {...props({ xpGained: 240 })} />)
  expect(screen.getByText('+240')).toBeInTheDocument()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  expect(container.querySelector('.cer-xp.uv-flat use')).toHaveAttribute('href', '#t-coin')
})

// ---- the kcal tile: three states ----

test('the kcal tile is absent when kcal is unknown — no 0 kcal, no kcal counter either', () => {
  const { container } = render(<SportCeremony {...props()} />)
  expect(container.querySelector('.cer-kcal')).toBeNull()
  expect(container.querySelector('[data-cer-count="kcal"]')).toBeNull()
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
})

test('the kcal tile says it is an estimate when the wire says isEstimate', () => {
  render(<SportCeremony {...props({ kcal: { value: 420, isEstimate: true } })} />)
  expect(screen.getByText('Ennyit nyertél a mai mozgással')).toBeInTheDocument()
  expect(screen.getByText('Becslés, nem mérés')).toBeInTheDocument()
  expect(screen.queryByText('Saját értéked')).not.toBeInTheDocument()
  // The scene counter and the kcal-tile figure both show the real value.
  expect(screen.getAllByText('420').length).toBe(2)
})

test('the kcal tile says it is the athlete\'s own value when the wire says the override won', () => {
  render(<SportCeremony {...props({ kcal: { value: 640, isEstimate: false } })} />)
  expect(screen.getByText('Saját értéked')).toBeInTheDocument()
  expect(screen.queryByText('Becslés, nem mérés')).not.toBeInTheDocument()
})

// ---- the close CTA ----

test('the close CTA is a sage glass row carrying the sport\'s own 3D glyph and goes back to Mai', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const { container } = render(<SportCeremony {...props({ onClose, sportName: 'Foci', art: 't-football' })} />)
  expect(screen.getByText('Foci elmentve')).toBeInTheDocument()
  const cta = container.querySelector('.cer-go') as HTMLElement
  expect(cta).toHaveClass('glass', 'is-done')
  expect(cta.querySelector('use')).toHaveAttribute('href', '#t-football')
  await user.click(screen.getByRole('button', { name: /Vissza a mai napra/ }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

// ---- üveg (mezo-me75u.10): the glass ceremony family ----

test('it wears the U4 glass ceremony family: 3D stars, 3D counter icons, the kcal halo', () => {
  const { container } = render(<SportCeremony {...props({ kcal: { value: 300, isEstimate: true } })} />)
  expect(container.querySelector('.cer-screen')).toHaveClass('uv-cer', 'cer-sport')
  expect(container.querySelectorAll('.cer-stars i')[0].querySelectorAll('use')).toHaveLength(3)
  const icons = [...container.querySelectorAll('.cer-counters use')].map((u) => u.getAttribute('href'))
  expect(icons).toEqual(['#t-clock', '#t-flame', '#t-plate'])
  expect(container.querySelector('.cer-kcal')).toHaveClass('uv-halo')
  expect(container.querySelector('.cer-kcal use')).toHaveAttribute('href', '#t-bowl')
})

// ---- the honesty line ----

test('the honesty line names time and effort, not AI', () => {
  render(<SportCeremony {...props()} />)
  expect(screen.getByText(
    'A csillagok az edzésidőből és az erőfeszítésből számolnak, nem AI-értékelés.',
  )).toBeInTheDocument()
})

// ---- copy discipline ----

test('no emoji anywhere — the art is the 3D sprite', () => {
  const { container } = render(<SportCeremony {...props({ kcal: { value: 300, isEstimate: true }, xpGained: 50 })} />)
  const emoji = /\p{Extended_Pictographic}/u
  expect(container.textContent ?? '').not.toMatch(emoji)
})
