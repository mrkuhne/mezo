import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { FinishConfirmGlass } from '@/features/train/components/FinishConfirmGlass'

// Folyadék F4 (mezo-n4wf5.4): a light sheet (prototype vilagos/edzes.js `fin`) — rows with the sets as capsules.
const PENDING = [
  { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', left: 2, total: 4 },
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
  const dialog = screen.getByRole('dialog', { name: 'Van még 3 bepipálatlan szetted.' })
  expect(dialog).toHaveClass('fo-sheet')
  expect(dialog.querySelector('[class*="wo-"], [class*="wos-"], [class*="gl-"]')).toBeNull()
  expect(screen.getByText('Edzés befejezése')).toBeInTheDocument()
  expect(screen.getByText(/ezek kihagyott státusszal zárulnak\. A már elmentett 4 szetted megmarad\./)).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('2 szett maradna üresen')).toBeInTheDocument()
  expect(screen.getByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(screen.getByText('1 szett maradna üresen')).toBeInTheDocument()
  expect(screen.getByText(/az összegzés nem büntet értük/)).toBeInTheDocument()
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
  // the sheet slides down first, then reports the close
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(onConfirm).not.toHaveBeenCalled()
})

test('finishPending disables the primary CTA', () => {
  render(<FinishConfirmGlass {...baseProps({ finishPending: true })} />)
  expect(screen.getByRole('button', { name: /Befejezem így/ })).toBeDisabled()
})

test('each row draws its sets as capsules: the logged ones full, the ones left empty', () => {
  render(<FinishConfirmGlass {...baseProps()} />)
  const [first, second] = Array.from(document.querySelectorAll('.el-fin-rows .fo-caps'))
  // total 4, 2 left -> 2 full + 2 empty
  expect(first.querySelectorAll('i')).toHaveLength(4)
  expect(first.querySelectorAll('i.f')).toHaveLength(2)
  // no total handed over -> only the ones left, all empty
  expect(second.querySelectorAll('i')).toHaveLength(1)
  expect(second.querySelectorAll('i.f')).toHaveLength(0)
})

test('the × closes like „Mégse", without confirming', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(<FinishConfirmGlass {...baseProps({ onClose, onConfirm })} />)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(onConfirm).not.toHaveBeenCalled()
})

test('closed: renders nothing', () => {
  render(<FinishConfirmGlass {...baseProps({ open: false })} />)
  expect(screen.queryByText(/bepipálatlan szetted/)).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
