// ============================================================
// Mezo · WaterLogSheet tests (mezo-c9t5, keret-hero Task 2). See
// .superpowers/sdd/2026-08-09-fuel-keret-hero/task-2-brief.md.
// ============================================================
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { onToast } from '@/shared/lib/toastBus'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'

test('shows the day-so-far tally, liter-formatted with an HU decimal comma', () => {
  render(<WaterLogSheet currentMl={1200} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  expect(screen.getByText('ma eddig 1,2 / 2,5 l')).toBeInTheDocument()
  // the light sheet with its head; the glass says today's level
  expect(screen.getByRole('dialog', { name: 'Mennyit ittál?' })).toHaveClass('fo-sheet')
  expect(screen.getByText('Egy korty szünet.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Ma eddig 1,2 / 2,5 liter' })).toBeInTheDocument()
  expect(document.querySelector('.capture-sheet, .glass, .capture-hero')).toBeNull()
})

test('the glass shows, dashed, where the chosen amount would take the level', async () => {
  render(<WaterLogSheet currentMl={1200} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  const glass = screen.getByRole('img', { name: 'Ma eddig 1,2 / 2,5 liter' })
  expect(glass.querySelector('path.next')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: '400 ml' }))
  expect(glass.querySelector('path.next')).not.toBeNull()
})

test('„Visszavonom az utolsót" is drawn only when the opener can undo, calls its undo and keeps the sheet open', async () => {
  const onUndo = vi.fn()
  const onClose = vi.fn()
  const toasts: unknown[] = []
  const off = onToast(t => toasts.push(t))
  const { unmount } = render(<WaterLogSheet currentMl={500} targetMl={2500} onLog={() => {}} onClose={onClose} onUndo={onUndo} canUndo={false} />)
  expect(screen.queryByRole('button', { name: 'Visszavonom az utolsót' })).toBeNull()
  unmount()
  render(<WaterLogSheet currentMl={500} targetMl={2500} onLog={() => {}} onClose={onClose} onUndo={onUndo} canUndo />)
  await userEvent.click(screen.getByRole('button', { name: 'Visszavonom az utolsót' }))
  off()
  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
  expect(toasts).toContainEqual({ kind: 'success', text: 'Visszavontam az utolsót' })
})

test('Mentés is inert with nothing selected', () => {
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

test('picking a chip enables Mentés; Save logs that amount then closes', async () => {
  const onLog = vi.fn()
  const onClose = vi.fn()
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={onLog} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: '400 ml' }))
  const save = screen.getByRole('button', { name: /Mentés/ })
  expect(save).toBeEnabled()
  await userEvent.click(save)
  expect(onLog).toHaveBeenCalledWith(400)
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('chips are single-select: picking a second chip deselects the first', async () => {
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  const chip250 = screen.getByRole('button', { name: '250 ml' })
  const chip400 = screen.getByRole('button', { name: '400 ml' })
  await userEvent.click(chip250)
  expect(chip250).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(chip400)
  expect(chip250).toHaveAttribute('aria-pressed', 'false')
  expect(chip400).toHaveAttribute('aria-pressed', 'true')
})

test('typing a manual amount overrides a previously picked chip', async () => {
  const onLog = vi.fn()
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={onLog} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: '250 ml' }))
  const input = screen.getByLabelText(/kézzel/i)
  await userEvent.type(input, '330')
  expect(screen.getByRole('button', { name: '250 ml' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onLog).toHaveBeenCalledWith(330)
})

test('an invalid (zero) manual value with no chip selected keeps Mentés inert', async () => {
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  const input = screen.getByLabelText(/kézzel/i)
  await userEvent.type(input, '0')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

test('an empty manual value with no chip selected keeps Mentés inert', () => {
  render(<WaterLogSheet currentMl={0} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

test('the big number announces the selected amount and follows manual corrections', async () => {
  render(<WaterLogSheet currentMl={1200} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  const amount = screen.getByRole('status', { name: 'Rögzítendő vízmennyiség' })
  expect(amount).toHaveTextContent('0ml')
  await userEvent.click(screen.getByRole('button', { name: '400 ml' }))
  expect(amount).toHaveTextContent('400ml')
  await userEvent.type(screen.getByLabelText(/kézzel/i), '330')
  expect(amount).toHaveTextContent('330ml')
})
