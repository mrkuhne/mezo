import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { MezoPersonalPage } from '@/features/settings/pages/MezoPersonalPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
function mount(mode: 'about' | 'communication' | 'context') {
  return render(<QueryWrapper><MemoryRouter><MezoPersonalPage mode={mode} /></MemoryRouter></QueryWrapper>)
}
test('own introduction is editable and saved without overwriting instructions', async () => {
  mount('about')
  const input = screen.getByLabelText('Saját bemutatkozás')
  fireEvent.change(input, { target: { value: 'A következetesség fontos nekem.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Változtatások mentése' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mentve'))
  expect(input).toHaveValue('A következetesség fontos nekem.')
})
test('communication separates explicit instruction from learned inclusion', () => {
  mount('communication')
  expect(screen.getByLabelText('Saját instrukció')).toHaveAttribute('maxLength', '4000')
  expect(screen.getByRole('checkbox', { name: 'Tanult kommunikációs profil használata' })).toBeChecked()
})
test('context identifies its scope and exposes source correction links', () => {
  mount('context')
  expect(screen.getByText(/nem a teljes rendszerprompt/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Alapadatok javítása' })).toHaveAttribute('href', '/settings/account')
})
