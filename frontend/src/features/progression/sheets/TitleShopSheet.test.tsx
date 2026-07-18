import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { QueryWrapper } from '@/test/queryWrapper'

afterEach(() => vi.unstubAllEnvs())
const renderSheet = () =>
  render(
    <QueryWrapper>
      <TitleShopSheet onClose={() => {}} />
    </QueryWrapper>,
  )

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('ladder segment: unlocked titles equipable, locked ones marked', () => {
    renderSheet()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('🪙 240')).toBeInTheDocument()
    expect(screen.getByText('A Fegyelmezett')).toBeInTheDocument()
    expect(screen.getByText('Viselve')).toBeInTheDocument() // equipped seed title
    expect(screen.getByText('A Vasakarat')).toBeInTheDocument() // Lv 16 → locked 🔒
  })

  test('shop segment: buy flow deducts coins and equips', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    const row = screen.getByText('Csirkemell Csodája').closest('.row') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'Megveszem' }))
    await waitFor(() => expect(screen.getByText('🪙 90')).toBeInTheDocument())
    // Gainz Nagyúr (600) is now unaffordable → its buy button is disabled
    const gainz = screen.getByText('Gainz Nagyúr').closest('.row') as HTMLElement
    expect(within(gainz).getByRole('button', { name: 'Megveszem' })).toBeDisabled()
  })

  test('shop segment sells the streak saver', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    expect(screen.getByText('🧊 Streak-mentő')).toBeInTheDocument()
    expect(screen.getByText(/nálad: 1\/2/)).toBeInTheDocument()
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('shop segment shows the backend-coming empty state', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    expect(screen.getByText('A bolt a backend-szelettel érkezik.')).toBeInTheDocument()
  })
})
