import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<QueryWrapper><SleepGoalSheet onClose={onClose} /></QueryWrapper>)
  return onClose
}

describe('SleepGoalSheet', () => {
  it('opens prefilled from the current goal with a live-derived other end', () => {
    renderSheet()
    expect(screen.getByLabelText('Cél időtartam')).toHaveTextContent('7.5 ó')
    expect(screen.getByLabelText('Rögzített időpont')).toHaveValue('06:45')
    expect(screen.getByText(/Lefekvés ebből:/)).toHaveTextContent('23:15')
  })

  it('flipping the anchor swaps which end is derived', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Lefekvés rögzítése/ }))
    fireEvent.change(screen.getByLabelText('Rögzített időpont'), { target: { value: '23:00' } })
    expect(screen.getByText(/Ébredés ebből:/)).toHaveTextContent('06:30') // 23:00 + 450
  })

  it('the duration stepper steps by 15 min and re-derives', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Cél növelése' }))
    expect(screen.getByLabelText('Cél időtartam')).toHaveTextContent('7.8 ó') // 465 min
    expect(screen.getByText(/Lefekvés ebből:/)).toHaveTextContent('23:00')
  })

  it('saving persists and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Cél mentése/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
