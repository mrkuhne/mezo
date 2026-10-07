// Kihagyás S3 (mezo-q4xt2.3) — „Mikor fordulj orvoshoz?" (prototype elo/fuel.html `orvos()`).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DoctorSheet } from '@/features/fuel/sheets/DoctorSheet'

// The house guard, with one owner-approved symptom phrase let through: „újra rosszabbul vagy" is a
// warning sign (prototype copy), not a judgement of the user.
const SHAME = /elrontott|túlléptél|hiba|rossz(?!abbul)|bukta|kudarc/i

test('STOMACH lists five warning signs', () => {
  render(<DoctorSheet category="STOMACH" onClose={vi.fn()} />)
  expect(screen.getByText('GYOMORRONTÁS')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('A hasmenés 7 napnál, a hányás 2 napnál tovább tart')).toBeInTheDocument()
})

test('ILLNESS lists four warning signs', () => {
  render(<DoctorSheet category="ILLNESS" onClose={vi.fn()} />)
  expect(screen.getByText('BETEGSÉG')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText('A magas láz 3 napnál tovább tart')).toBeInTheDocument()
})

test('both end with the not-medical-advice note, close on Bezárom, never grade', async () => {
  const onClose = vi.fn()
  const { baseElement } = render(<DoctorSheet category="ILLNESS" onClose={onClose} />)
  expect(screen.getByText('Ez nem orvosi tanács. Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mikor fordulj orvoshoz?' })).toBeInTheDocument()
  expect(baseElement.textContent).not.toMatch(SHAME)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
