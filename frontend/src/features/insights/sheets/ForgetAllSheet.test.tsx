import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgetAllSheet, forgetAllCta, forgetAllTitle } from '@/features/insights/sheets/ForgetAllSheet'
import type { MemoryItem } from '@/data/insights/turnMemoryApi'

const items: MemoryItem[] = [
  { kind: 'person_fact', refId: 'a', personId: 'p', who: 'Dóri', text: 'a strandröpi-párod', createdAt: '2026-09-26T20:05:00Z', pending: false },
  { kind: 'fact_candidate', refId: 'b', personId: null, who: null, text: 'nehéz egyedül', createdAt: '2026-09-26T20:05:00Z', pending: true },
]

test('copy follows the prototype for one and two items, and stays Hungarian beyond', () => {
  expect(forgetAllTitle(1)).toBe('Ezt az egyet is elfelejtem')
  expect(forgetAllTitle(2)).toBe('Ezt a kettőt is elfelejtem')
  expect(forgetAllTitle(3)).toBe('Ezt a 3 dolgot is elfelejtem')
  expect(forgetAllCta(1)).toBe('Elfelejtem')
  expect(forgetAllCta(2)).toBe('Elfelejtem mind a kettőt')
  expect(forgetAllCta(4)).toBe('Elfelejtem mindet')
})

test('lists each item with its provenance line; a failed confirm keeps the sheet and says so', async () => {
  const onConfirm = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
  render(<ForgetAllSheet items={items} onConfirm={onConfirm} onClose={vi.fn()} />)
  expect(screen.getByText('MINDENT EBBŐL A BESZÉLGETÉSBŐL')).toBeInTheDocument()
  expect(screen.getByText('javaslat, még nem döntöttél róla')).toBeInTheDocument()
  expect(screen.getByText(/-kor jegyeztem meg$/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Elfelejtem mind a kettőt' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült elfelejteni — próbáld újra.')
  expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
})
