import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ExerciseLibraryItem } from '@/data/types'
import { ExerciseScopeSheet, type ExerciseScopeSheetProps } from '@/features/train/sheets/ExerciseScopeSheet'

// ExerciseScopeSheet (mezo-mobji; Folyadék F4, mezo-n4wf5.4 — prototype vilagos/edzes.js `scope`): how long a
// mid-workout swap / add holds. Variants: csere · csere-kesz · add · ma-kerult / levezeto (no plan slot) ·
// terv-nelkul (no running plan).

const ITEM = { id: 'lib-1', name: 'Lehúzás · semleges fogás', muscle: 'back-wide', type: 'compound' } as unknown as ExerciseLibraryItem

function props(over: Partial<ExerciseScopeSheetProps> = {}): ExerciseScopeSheetProps {
  return {
    mode: 'swap', item: ITEM, replacedName: 'Húzódzkodás', replacedMuscle: 'back-mid', loggedOnReplaced: 0, newSets: 3, repLabel: '8–10',
    planSlot: true, mesoLine: 'A Hypertrophy 04 hátralévő 3 hetében is.', lastTop: '77 × 10', onChoose: vi.fn(), onClose: vi.fn(), ...over,
  }
}

test('csere: a light sheet titled „old → new", the chosen exercise as a row, and both scopes on offer', () => {
  render(<ExerciseScopeSheet {...props()} />)
  const dialog = screen.getByRole('dialog', { name: 'Húzódzkodás → Lehúzás · semleges fogás' })
  expect(dialog).toHaveClass('fo-sheet', 'sheet-nested')
  expect(dialog.querySelector('[class*="wos-"], [class*="wo-"]')).toBeNull()
  expect(within(dialog).getByText('Gyakorlat cseréje')).toBeInTheDocument()
  expect(within(dialog).getByText('Ugyanott, ugyanúgy 3 szett.')).toBeInTheDocument()
  expect(within(dialog).getByText(/ · múltkor 77 × 10 — innen jön a javaslat$/)).toBeInTheDocument()
  expect(within(dialog).getByText('Meddig érvényes?')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /Csak ma/ })).toBeInTheDocument()
  expect(within(dialog).getByText('a mai edzésre. Jövő héten a régi terv jön.')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /A tervben is/ })).toBeInTheDocument()
  expect(within(dialog).getByText('a Hypertrophy 04 hátralévő 3 hetében is. A mentett sablonod nem változik.')).toBeInTheDocument()
  expect(within(dialog).queryByText(/Mezociklus/i)).not.toBeInTheDocument()
  // nothing logged on the old one: only the new one's empty capsules
  const caps = dialog.querySelectorAll('.fo-rr .fo-caps')
  expect(caps).toHaveLength(1)
  expect(caps[0].querySelectorAll('i')).toHaveLength(3)
  expect(caps[0].querySelectorAll('i.f')).toHaveLength(0)
})

test('csere-kesz: the logged sets stay with the old exercise — said in the lead and drawn as full capsules', () => {
  render(<ExerciseScopeSheet {...props({ loggedOnReplaced: 2, newSets: 2 })} />)
  expect(screen.getByText('A 2 kész szett a Húzódzkodás-nál marad, a hátralévő 2 szett az újé.')).toBeInTheDocument()
  const caps = document.querySelectorAll('.fo-rr .fo-caps')
  expect(caps).toHaveLength(2)
  expect(caps[0].querySelectorAll('i.f')).toHaveLength(2)
  expect(caps[1].querySelectorAll('i')).toHaveLength(2)
  expect(caps[1].querySelectorAll('i.f')).toHaveLength(0)
})

test('add: titled by the new exercise, the lead carries the sets and the rep range; a never-done exercise says so', () => {
  render(<ExerciseScopeSheet {...props({ mode: 'add', replacedName: undefined, lastTop: null, newSets: 4 })} />)
  expect(screen.getByRole('dialog', { name: 'Lehúzás · semleges fogás' })).toBeInTheDocument()
  expect(screen.getByText('Gyakorlat hozzáadása')).toBeInTheDocument()
  expect(screen.getByText('4 szett · 8–10 ismétlés — a gyakorlat típusához szabva, utána átírhatod.')).toBeInTheDocument()
  expect(screen.getByText(/ · még nem csináltad — a súlyt te adod meg$/)).toBeInTheDocument()
})

test('no plan slot (ma-kerult / levezeto): only „Csak ma", with the reason under it', () => {
  const note = 'Ez a gyakorlat ma került be, nincs a terved napjai között, ezért csak mára cserélhető.'
  render(<ExerciseScopeSheet {...props({ planSlot: false, noPlanNote: note })} />)
  expect(screen.getByRole('button', { name: /Csak ma/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /A tervben is/ })).not.toBeInTheDocument()
  expect(screen.getByText(note)).toBeInTheDocument()
})

test('terv-nelkul: without a running plan there is no second scope and no note', () => {
  render(<ExerciseScopeSheet {...props({ mesoLine: null })} />)
  expect(screen.queryByRole('button', { name: /A tervben is/ })).not.toBeInTheDocument()
  expect(document.querySelector('.fo-note')).toBeNull()
})

test('one tap decides: the scope is reported, then the sheet closes', async () => {
  const user = userEvent.setup()
  const p = props()
  render(<ExerciseScopeSheet {...p} />)
  await user.click(screen.getByRole('button', { name: /A tervben is/ }))
  expect(p.onChoose).toHaveBeenCalledWith('MESO')
  await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1))
})

test('„Csak ma" reports TODAY; the × closes without choosing', async () => {
  const user = userEvent.setup()
  const p = props()
  const { unmount } = render(<ExerciseScopeSheet {...p} />)
  await user.click(screen.getByRole('button', { name: /Csak ma/ }))
  expect(p.onChoose).toHaveBeenCalledWith('TODAY')
  unmount()
  const q = props()
  render(<ExerciseScopeSheet {...q} />)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(q.onClose).toHaveBeenCalledTimes(1))
  expect(q.onChoose).not.toHaveBeenCalled()
})
