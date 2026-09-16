import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { FinishConfirmGlass } from '@/features/train/components/FinishConfirmGlass'

const PENDING = [
  { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', left: 2 },
  { id: 'e-2', name: 'Lat Pulldown · Pronated', muscle: 'lats', left: 1 },
]

function baseProps(overrides: Partial<Parameters<typeof FinishConfirmGlass>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    loggedCount: 4,
    pending: PENDING,
    pendingTotal: 3,
    finishPending: false,
    onConfirm: vi.fn(),
    ...overrides,
  }
}

test('partial (some logged): headline names the pending count, lists the right exercises, sub reads N elvégzett · M kihagyott', () => {
  render(<FinishConfirmGlass {...baseProps()} />)
  expect(screen.getByText('Van még 3 bepipálatlan szetted.')).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('2 szett')).toBeInTheDocument()
  expect(screen.getByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(screen.getByText('1 szett')).toBeInTheDocument()
  const primary = screen.getByRole('button', { name: /Befejezem így/ })
  expect(primary).toBeInTheDocument()
  expect(screen.getByText('4 elvégzett · 3 kihagyott')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mégse, visszamegyek' })).toBeInTheDocument()
})

test('zero logged: the honest zero-case copy and CTA label', () => {
  render(<FinishConfirmGlass {...baseProps({ loggedCount: 0 })} />)
  expect(screen.getByText('Egy szettet sem rögzítettél ma.')).toBeInTheDocument()
  expect(screen.getByText(/Ez is része a ritmusnak/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Kihagyom a mai edzést/ })).toBeInTheDocument()
  expect(screen.getByText('0 elvégzett · 3 kihagyott')).toBeInTheDocument()
})

test('confirm fires onConfirm', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  render(<FinishConfirmGlass {...baseProps({ onConfirm })} />)
  await user.click(screen.getByRole('button', { name: /Befejezem így/ }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

test('cancel fires onClose, not onConfirm', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(<FinishConfirmGlass {...baseProps({ onClose, onConfirm })} />)
  await user.click(screen.getByRole('button', { name: 'Mégse, visszamegyek' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

test('finishPending disables the primary CTA', () => {
  render(<FinishConfirmGlass {...baseProps({ finishPending: true })} />)
  expect(screen.getByRole('button', { name: /Befejezem így/ })).toBeDisabled()
})

test('closed: renders nothing', () => {
  render(<FinishConfirmGlass {...baseProps({ open: false })} />)
  expect(screen.queryByText(/bepipálatlan szetted/)).not.toBeInTheDocument()
})
