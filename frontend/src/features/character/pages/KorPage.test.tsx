// KorPage — the generic per-round mini-page over static inventory content
// (mezo-1gim.14, Task 5). No data hooks — mocks useParams directly, the RunPage idiom.
//
// Round 3 (mezo-1gim.15, Task 7): rounds 1-3 have all now landed for real and no longer exist in
// INVENTORY_ROUNDS (see inventory.ts's header) — the one round left ("Kapcsolatok & AI-meta",
// n: 4) happens to carry no multi-detector item, so pinning the "N detektor" count-rendering
// behaviour to real content would make this test break every time a round lands, for a reason
// unrelated to what it actually covers (KorPage's own rendering logic, not inventory.ts's
// content). `@/features/character/inventory` is mocked with a synthetic round instead, so this
// test stays stable across future round flips.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { KorPage } from './KorPage'

const mockNavigate = vi.fn()
const hoisted = vi.hoisted(() => ({ n: '7' }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ n: hoisted.n }) }
})
vi.mock('@/features/character/inventory', () => ({
  INVENTORY_ROUNDS: [
    {
      n: 7,
      title: 'Teszt kör',
      items: [
        { t: 'Egy-detektoros tétel', det: ['solo-detector'] },
        { t: 'Több-detektoros tétel', det: ['det-a', 'det-b', 'det-c'] },
        { t: 'Érzékeny tétel', sensitive: true },
        { t: 'Sima tétel' },
      ],
    },
  ],
}))

beforeEach(() => {
  hoisted.n = '7'
  mockNavigate.mockReset()
})

describe('KorPage', () => {
  test('renders its hero + items, single-detector items get a ghost chip', () => {
    render(<KorPage />)
    expect(screen.getByText('7. KÖR')).toBeInTheDocument()
    expect(screen.getByText('Teszt kör · 4 tétel')).toBeInTheDocument()
    expect(screen.getByText('Egy-detektoros tétel')).toBeInTheDocument()
    expect(screen.getByText('solo-detector')).toBeInTheDocument()
    // 'Sima tétel' has no det[] — no chip, no crash.
    expect(screen.getByText('Sima tétel')).toBeInTheDocument()
  })

  test('a multi-detector item shows a count, not each key', () => {
    render(<KorPage />)
    expect(screen.getByText('Több-detektoros tétel')).toBeInTheDocument()
    expect(screen.getByText('3 detektor')).toBeInTheDocument()
  })

  test('a sensitive item carries the ÉRZÉKENY dot', () => {
    render(<KorPage />)
    expect(screen.getByLabelText('érzékeny')).toBeInTheDocument()
  })

  test('an unknown round number renders the honest not-found face, never a crash', () => {
    hoisted.n = '99'
    render(<KorPage />)
    expect(screen.getByText('Ez a kör nem található.')).toBeInTheDocument()
  })

  test('back arrow returns to Adatforrások', async () => {
    render(<KorPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/adatforrasok')
  })
})
