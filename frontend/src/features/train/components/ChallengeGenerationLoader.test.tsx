import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CHALLENGE_LOADER_LINES,
  CHALLENGE_LOADER_ROTATE_MS,
  ChallengeGenerationLoader,
} from '@/features/train/components/ChallengeGenerationLoader'

describe('ChallengeGenerationLoader', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('renders as a polite live status with the first line and the progress bar', () => {
    render(<ChallengeGenerationLoader />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(CHALLENGE_LOADER_LINES[0])
    expect(status.querySelector('.mz-chload-fill')).toBeInTheDocument()
  })

  test('rotates to the next line after the interval and loops past the end', () => {
    render(<ChallengeGenerationLoader />)
    act(() => vi.advanceTimersByTime(CHALLENGE_LOADER_ROTATE_MS))
    expect(screen.getByRole('status')).toHaveTextContent(CHALLENGE_LOADER_LINES[1])
    // A full cycle from here lands back on the same line — the list loops.
    act(() => vi.advanceTimersByTime(CHALLENGE_LOADER_ROTATE_MS * CHALLENGE_LOADER_LINES.length))
    expect(screen.getByRole('status')).toHaveTextContent(CHALLENGE_LOADER_LINES[1])
  })

  test('cleans up its timer on unmount', () => {
    const { unmount } = render(<ChallengeGenerationLoader />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
