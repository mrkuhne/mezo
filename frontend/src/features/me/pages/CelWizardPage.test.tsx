import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelWizardPage } from '@/features/me/pages/CelWizardPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderWiz = () => render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals/new']}>
  <Routes><Route path="/me/goals/new" element={<CelWizardPage />} /><Route path="/me/goals" element={<div>HUB</div>} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /></Routes>
</MemoryRouter></QueryWrapper>)

test('walks all five steps: extrinsic why gets the reframe offer, proposal pillars toggle, activation lands on the goal page', async () => {
  renderWiz()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
  fireEvent.change(screen.getByLabelText('Miért fontos? · egy mondat'), { target: { value: 'hogy jobban nézzek ki a strandon' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByText('⚠ Külső keret')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Egészség-keret · elfogadom' }))
  expect(screen.getByText('✓ Belső keret · egészség + képesség')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  const toggles = screen.getAllByRole('button', { name: / ki$/ })
  expect(toggles.length).toBeGreaterThanOrEqual(2)
  fireEvent.click(toggles[0])
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  expect(screen.getAllByText('HA').length).toBeGreaterThanOrEqual(1)
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  expect(screen.getByText('Így indul')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aktiválás' }))
  await waitFor(() => expect(screen.getByText('GOAL PAGE')).toBeInTheDocument())
})

test('Mentés tervezettként returns to the hub', async () => {
  renderWiz()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Spanyol C1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))
  await waitFor(() => expect(screen.getByText('HUB')).toBeInTheDocument())
})
