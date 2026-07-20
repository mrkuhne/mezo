import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/shared/lib/daypart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/daypart')>()),
  daypartNow: vi.fn(() => 'reggel'),
}))
import { daypartNow } from '@/shared/lib/daypart'

const renderBanner = () => render(<QueryWrapper><IntentionBanner /></QueryWrapper>)

describe('IntentionBanner', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.mocked(daypartNow).mockReturnValue('reggel')
    vi.unstubAllEnvs()
  })

  test('shows the creed and today foci', () => {
    renderBanner()
    expect(screen.getByText('Vezérelv')).toBeInTheDocument()
    expect(screen.getByText(/szándékkal élek/i)).toBeInTheDocument()
    expect(screen.getByText(/Jelen lenni minden beszélgetésben/)).toBeInTheDocument()
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
  })

  test('opens the focus sheet from the + Fókusz button', async () => {
    renderBanner()
    await userEvent.click(screen.getByRole('button', { name: /Fókusz hozzáadása/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  test('evening daypart shows the reflect row', () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderBanner()
    expect(screen.getByText('Szándékkal élted a napot?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Igen' })).toBeInTheDocument()
  })
})
