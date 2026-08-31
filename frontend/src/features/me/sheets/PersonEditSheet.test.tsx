import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'

const savePerson = vi.fn()
vi.mock('@/data/hooks', async (orig) => ({
  ...(await orig()),
  usePeople: () => ({ people: [], mentions: [], savePerson, deletePerson: vi.fn(),
    logMention: vi.fn(), isPending: false }),
}))

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
