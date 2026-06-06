import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportView } from './SportView'

const renderView = () => render(<SportView />)

test('own page-header: brand eyebrow + PageTitle', () => {
  renderView()
  expect(screen.getByText('Train · Sport')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Röplabda' })).toBeInTheDocument()
})

test('hero shows the venue Display and the RPE explainer', () => {
  renderView()
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()
  expect(screen.getByText(/RPE = Rate of Perceived Exertion/)).toBeInTheDocument()
})

test('default view is the weekly plan', () => {
  renderView()
  expect(screen.getByText(/Heti ritmus · 7\.5h court/)).toBeInTheDocument()
})

test('switching to Napló shows the session log header with avg jump count', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByText(/avg \d+ ugrás/)).toBeInTheDocument()
})

test('switching to Cross-load shows the read tool chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Cross-load' }))
  expect(screen.getByText('get_sport_load')).toBeInTheDocument()
})

test('the + Log header chip opens the SportLogSheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  expect(await screen.findByText('Sport log · Volleyball')).toBeInTheDocument()
})
