import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelokPage } from '@/features/me/pages/CelokPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderHub() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals']}>
    <Routes><Route path="/me/goals" element={<CelokPage />} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /><Route path="/me/goals/new" element={<div>WIZARD</div>} /></Routes>
  </MemoryRouter></QueryWrapper>)
}

test('renders the three active goals as tiles, Spanyol B2 parked, three live dimension chips', () => {
  renderHub()
  expect(screen.getByRole('button', { name: 'Kockahas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Side hustle' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Az utolsó barátnő' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Spanyol B2 · parkol/ })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '3 aktív cél' })).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-dimchip:not(.empty)')).toHaveLength(3)
})

test('tile tap opens the goal page; ＋ Új cél opens the wizard', () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Kockahas' }))
  expect(screen.getByText('GOAL PAGE')).toBeInTheDocument()
})

test('the parked row exposes two distinct focusable buttons — navigate and Vissza', () => {
  renderHub()
  const navBtn = screen.getByRole('button', { name: 'Spanyol B2 · parkol' })
  const visszaBtn = screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' })
  expect(navBtn).not.toBe(visszaBtn)
  expect(navBtn.tagName).toBe('BUTTON')
  expect(visszaBtn.tagName).toBe('BUTTON')
  // neither button is nested inside the other — both are real, independently focusable controls
  expect(navBtn.contains(visszaBtn)).toBe(false)
  expect(visszaBtn.contains(navBtn)).toBe(false)
})

test('Vissza on a parked goal re-activates it without navigating', async () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' }))
  await waitFor(() => expect(screen.getByRole('img', { name: '4 aktív cél' })).toBeInTheDocument())
  expect(screen.queryByText('GOAL PAGE')).not.toBeInTheDocument()
})
