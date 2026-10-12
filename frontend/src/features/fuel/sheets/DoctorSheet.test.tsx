// Kihagyás S3 (mezo-q4xt2.3) — „Mikor fordulj orvoshoz?" (Folyadék F5: prototype vilagos/fuel.js `orvos`).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DoctorSheet } from '@/features/fuel/sheets/DoctorSheet'

// The plain house guard (the symptom copy avoids the banned token).
const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

test('STOMACH lists five warning signs', () => {
  render(<DoctorSheet category="STOMACH" onClose={vi.fn()} />)
  expect(screen.getByText('gyomorrontás')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('A hasmenés 7 napnál, a hányás 2 napnál tovább tart')).toBeInTheDocument()
})

test('ILLNESS lists four warning signs', () => {
  render(<DoctorSheet category="ILLNESS" onClose={vi.fn()} />)
  expect(screen.getByText('betegség')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText('A magas láz 3 napnál tovább tart')).toBeInTheDocument()
})

test('both end with the not-medical-advice note, close on Bezárom, never grade', async () => {
  const onClose = vi.fn()
  const { baseElement } = render(<DoctorSheet category="ILLNESS" onClose={onClose} />)
  expect(screen.getByText('Ez nem orvosi tanács.')).toBeInTheDocument()
  expect(screen.getByText('Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet.')).toBeInTheDocument()
  // a light sheet, no glass
  expect(baseElement.querySelector('.sheet.fo-sheet')).not.toBeNull()
  expect(baseElement.querySelector('.glass')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Mikor fordulj orvoshoz?' })).toBeInTheDocument()
  expect(baseElement.textContent).not.toMatch(SHAME)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
