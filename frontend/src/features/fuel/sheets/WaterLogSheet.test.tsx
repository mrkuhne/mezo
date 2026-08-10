// ============================================================
// Mezo · WaterLogSheet tests (mezo-c9t5, keret-hero Task 2). See
// .superpowers/sdd/2026-08-09-fuel-keret-hero/task-2-brief.md.
// ============================================================
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'

test('shows the day-so-far tally, liter-formatted with an HU decimal comma', () => {
  render(<WaterLogSheet currentMl={1200} targetMl={2500} onLog={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/1,2 \/ 2,5 l/)).toBeInTheDocument()
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
