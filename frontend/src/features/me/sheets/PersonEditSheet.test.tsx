import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'
import type { PersonEntry } from '@/data/types'

const savePerson = vi.fn()
const deletePerson = vi.fn()
vi.mock('@/data/hooks', async (orig) => ({
  ...(await orig()),
  usePeople: () => ({ people: [], mentions: [], savePerson, deletePerson,
    logMention: vi.fn(), isPending: false }),
}))

const PERSON: PersonEntry = {
  id: 'marci-1',
  name: 'Marci',
  initial: 'M',
  relationship: 'friend',
  relationshipHu: 'Barát',
  aliases: ['Marcika'],
  status: 'active',
  sourceKind: 'manual',
  affect_baseline: 'positive',
  mentionCount: 3,
  mentionsThisWeek: 1,
  last_mentioned_at: '2026-08-30T10:00:00.000Z',
  lastMentionLabel: 'ma',
  contactCadenceLabel: 'heti',
  notes: 'régi barát',
  affectTrend: [],
  affectTrendStart: null,
  direction: 'flat',
  directionReason: null,
  knownFacts: [],
  ties: [],
  graphEdges: [],
}

it('gyűjti az aliasokat és menti az új személyt', () => {
  render(<PersonEditSheet person={null} onClose={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText('pl. Marci'), { target: { value: 'Marci' } })
  fireEvent.change(screen.getByPlaceholderText('pl. Marcika'), { target: { value: 'Marcika' } })
  fireEvent.click(screen.getByRole('button', { name: '＋' }))
  fireEvent.click(screen.getByRole('button', { name: 'Barát' }))
  fireEvent.click(screen.getByRole('button', { name: /Felveszem/ }))
  expect(savePerson).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Marci', aliases: ['Marcika'], relationship: 'friend', relationshipHu: 'Barát',
  }))
})

it('mentés-gomb tiltott, amíg nincs név', () => {
  render(<PersonEditSheet person={null} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /Felveszem/ })).toBeDisabled()
})

it('szerkesztéskor a mentés megőrzi a meglévő contactCadenceLabel-t', () => {
  render(<PersonEditSheet person={PERSON} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(savePerson).toHaveBeenCalledWith(expect.objectContaining({
    id: 'marci-1', contactCadenceLabel: 'heti',
  }))
})

it('kétlépéses törlés: első tap felfegyverzi, második tap töröl', () => {
  const onClose = vi.fn()
  render(<PersonEditSheet person={PERSON} onClose={onClose} />)
  const deleteBtn = screen.getByRole('button', { name: /Törlés/ })

  fireEvent.click(deleteBtn)
  expect(screen.getByText(/Biztos\? Az említések megmaradnak, a személy eltűnik\./)).toBeInTheDocument()
  expect(deletePerson).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.click(deleteBtn)
  expect(deletePerson).toHaveBeenCalledWith('marci-1')
  expect(onClose).toHaveBeenCalled()
})
