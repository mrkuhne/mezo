import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ExtraSetPrompt } from '@/features/train/sheets/ExtraSetPrompt'

// The question after „Szett hozzáadása". Folyadék F4 (mezo-n4wf5.4 — prototype vilagos/edzes.js `extra`): a light
// sheet, the sets as capsules with the new one half full, „Minden hétre" primary + „Csak ma".

test('a light sheet: the question, the set count, the capsules (the last one is the new one) and the plan wording', () => {
  render(<ExtraSetPrompt slotCount={5} doneCount={2} muscle="back-mid" onEveryWeek={() => {}} onClose={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: 'A tervbe is felvegyük?' })
  expect(dialog).toHaveClass('fo-sheet', 'sheet-nested')
  expect(dialog.querySelector('[class*="wos-"]')).toBeNull()
  expect(screen.getByText('Extra szett hozzáadva')).toBeInTheDocument()
  expect(screen.getByText('Most 5 szett.')).toBeInTheDocument()
  const caps = Array.from(dialog.querySelectorAll('.fo-shg .fo-caps i'))
  expect(caps.map((i) => i.className)).toEqual(['f', 'f', '', '', 'h'])
  expect(screen.getByText('az utolsó az új')).toBeInTheDocument()
  expect(screen.getByText(/akkor a terved is eggyel több szettet ír elő ennél a gyakorlatnál\./)).toBeInTheDocument()
  expect(screen.queryByText(/mesociklus|mezociklus/i)).not.toBeInTheDocument()
})

test('without the counts it still asks — no capsules, no count line', () => {
  render(<ExtraSetPrompt onEveryWeek={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('dialog', { name: 'A tervbe is felvegyük?' })).toBeInTheDocument()
  expect(document.querySelector('.fo-shg')).toBeNull()
  expect(screen.queryByText(/^Most /)).not.toBeInTheDocument()
})

test('„Minden hétre" writes the plan and closes', async () => {
  const user = userEvent.setup()
  const onEveryWeek = vi.fn()
  const onClose = vi.fn()
  render(<ExtraSetPrompt slotCount={4} onEveryWeek={onEveryWeek} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Minden hétre' }))
  expect(onEveryWeek).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

test('„Csak ma" closes without touching the plan', async () => {
  const user = userEvent.setup()
  const onEveryWeek = vi.fn()
  const onClose = vi.fn()
  render(<ExtraSetPrompt slotCount={4} onEveryWeek={onEveryWeek} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Csak ma' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(onEveryWeek).not.toHaveBeenCalled()
})
