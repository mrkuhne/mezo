import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { QueryWrapper } from '@/test/queryWrapper'

describe('RoutinesTab', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders both chains, strengths and perfect-day counters', () => {
    render(<QueryWrapper><RoutinesTab /></QueryWrapper>)
    expect(screen.getByText('Reggeli lánc')).toBeInTheDocument()
    expect(screen.getByText('Esti lánc')).toBeInTheDocument()
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    expect(screen.getByText(/Tökéletes reggelek/)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // perfectMorningDays30 seed
  })
})
