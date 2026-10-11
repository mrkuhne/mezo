import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CHALLENGE_LOADER_BODY,
  CHALLENGE_LOADER_TITLE,
  ChallengeGenerationLoader,
} from '@/features/train/components/ChallengeGenerationLoader'

// Folyadék (mezo-n4wf5.4): the game-style loader (rotating lines + a fake-progress bar) became
// one calm box on the Eligazítás quest card. What it must still do: announce itself politely,
// say the workout can start anyway, never pretend to measure progress, and leave nothing running.
describe('ChallengeGenerationLoader', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('renders as a polite live status with the title and the reassurance', () => {
    render(<ChallengeGenerationLoader />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(CHALLENGE_LOADER_TITLE)
    expect(status).toHaveTextContent(CHALLENGE_LOADER_BODY)
    expect(CHALLENGE_LOADER_BODY).toMatch(/Az edzés ettől még indulhat\.$/)
  })

  test('is the kit box led by the quest glyph — no fake-progress bar, no old loader classes', () => {
    render(<ChallengeGenerationLoader />)
    const status = screen.getByRole('status')
    expect(status.querySelector('.fo-box .fo-bub use[href="#t-quest"]')).not.toBeNull()
    expect(status.querySelector('[class*="mz-chload"]')).toBeNull()
    expect(status.querySelector('[role="progressbar"], progress')).toBeNull()
  })

  test('the copy is stable: it does not change while the generation runs', () => {
    render(<ChallengeGenerationLoader />)
    const before = screen.getByRole('status').textContent
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByRole('status').textContent).toBe(before)
  })

  test('starts no timer, so nothing is left behind on unmount', () => {
    const { unmount } = render(<ChallengeGenerationLoader />)
    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
