import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('lists the saved custom workouts with recipe meta + the new-CTA', () => {
  render(
    <QueryWrapper><MemoryRouter><CustomWorkoutSheet onClose={() => {}} /></MemoryRouter></QueryWrapper>,
  )
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
  expect(screen.getByText('3 gyakorlat · 9 szett')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Új összeállítása/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenőnapi felső szerkesztése' })).toBeInTheDocument()
})
