import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WeightView } from './WeightView'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts the Phase-1 mock weight hero/trends, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('WeightView renders the Súly header, trend cells, and a log entry point', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('7 nap')).toBeInTheDocument()
  expect(screen.getByText('4 hét')).toBeInTheDocument()
  // the log CTA opens the WeightLogSheet
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument() // WeightLogSheet title
})
