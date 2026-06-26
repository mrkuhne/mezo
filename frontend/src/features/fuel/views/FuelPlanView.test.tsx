import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FuelPlanView } from './FuelPlanView'
import { QueryWrapper } from '@/test/queryWrapper'
// FuelPlanView reads useTodayScenario() (now a ['medication'] query) for the Reta strip's
// current day, so the view needs a QueryClient as well as a router.
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelPlanView /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders weekly stats, reta strip and rhythm grid', () => {
  renderView()
  expect(screen.getByText(/Reta cycle · 7 nap/)).toBeInTheDocument()
  expect(screen.getByText('D3')).toBeInTheDocument()
  expect(screen.getByText('Heti supplement-térkép')).toBeInTheDocument()
})
test('Idők opens the gym schedule sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Idők' }))
  expect(await screen.findByText('Heti gym idők')).toBeInTheDocument()
})
