import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { NoteEditSheet } from '@/features/train/sheets/ExerciseNoteSheet'

// The per-exercise note editor. Folyadék F4 (mezo-n4wf5.4 — prototype vilagos/edzes.js `note`): a light sheet, the
// exercise's name under the title, the field with dictation, „Mentés" + „Mégse".

test('a light sheet with the exercise under the title and the note in a 500-character field with dictation', () => {
  render(<NoteEditSheet initialNote="Könyök a test mellett" exerciseName="Döntött törzsű evezés" onSave={() => {}} onClose={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: 'Jegyzet a gyakorlathoz' })
  expect(dialog).toHaveClass('fo-sheet', 'sheet-nested')
  expect(dialog.querySelector('[class*="wos-"]')).toBeNull()
  expect(screen.getByText('Gyakorlat-jegyzet')).toBeInTheDocument()
  expect(screen.getByText('Döntött törzsű evezés')).toBeInTheDocument()
  const field = screen.getByLabelText('Gyakorlat-jegyzet szerkesztése')
  expect(field).toHaveValue('Könyök a test mellett')
  expect(field).toHaveAttribute('maxlength', '500')
  expect(field).toHaveAttribute('placeholder', 'Forma-emlékeztető, beállítás, fájdalom-jelzés…')
  expect(field).toHaveClass('fo-in')
  // the voice field's mic tile stands beside it
  expect(screen.getByRole('button', { name: 'Diktálás' })).toBeInTheDocument()
})

test('save reports the trimmed text and closes', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<NoteEditSheet initialNote="" onSave={onSave} onClose={onClose} />)
  await user.type(screen.getByLabelText('Gyakorlat-jegyzet szerkesztése'), '  lassú negatív  ')
  await user.click(screen.getByRole('button', { name: 'Mentés' }))
  expect(onSave).toHaveBeenCalledWith('lassú negatív')
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

test('„Mégse" closes without saving', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<NoteEditSheet initialNote="régi" onSave={onSave} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Mégse' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(onSave).not.toHaveBeenCalled()
})
