import { render, screen } from '@testing-library/react'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'

test('renders the header, pending + validated states, confidence and outcome', () => {
  render(<PredictionsPage />)
  expect(screen.getByText('Aktív predikciók')).toBeInTheDocument()
  expect(screen.getByText('2 validated · 60-day acc 68%')).toBeInTheDocument()
  expect(screen.getByText('Csütörtök Pull Day · Chest Row PR (107.5 × 8)')).toBeInTheDocument()
  expect(screen.getAllByText('◐ Pending').length).toBeGreaterThan(0)
  expect(screen.getByText('RPE 8.2 · vacsora 20:50')).toBeInTheDocument()
})
