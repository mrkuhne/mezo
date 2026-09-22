import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'
import { ExperimentDetailPage } from '@/features/insights/pages/ExperimentDetailPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
test('active experiment opens as a full page and returns to its selected list', async () => {
  render(<MemoryRouter initialEntries={['/mezo/experiments']}><Routes>
    <Route path="/mezo/experiments" element={<ExperimentsPage />} />
    <Route path="/mezo/experiments/:id" element={<ExperimentDetailPage />} />
  </Routes></MemoryRouter>, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: 'Aktív' }))
  await userEvent.click(screen.getByRole('link', { name: 'Glikogén-feltöltés volleyball előtt' }))
  expect(screen.getByRole('heading', { name: 'Hol tartunk?' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByRole('button', { name: 'Aktív' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('✓ Megerősítve')).not.toBeInTheDocument()
})
