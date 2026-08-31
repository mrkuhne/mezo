// KorPage — the generic per-round mini-page over static inventory content
// (mezo-1gim.14, Task 5). No data hooks — mocks useParams directly, the RunPage idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { KorPage } from './KorPage'

const mockNavigate = vi.fn()
const hoisted = vi.hoisted(() => ({ n: '1' }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ n: hoisted.n }) }
})

beforeEach(() => {
  hoisted.n = '1'
  mockNavigate.mockReset()
})

describe('KorPage', () => {
  // Round 1 ("Edzés & test") landed for real via mezo-1gim.15 and no longer exists in
  // INVENTORY_ROUNDS (see inventory.ts's header) — round 2 ("Fuel & ciklus") is now the
  // lowest-numbered round left, so it covers this single-detector-chip case instead.
  test('round 2 renders its hero + items, single-detector items get a ghost chip', () => {
    hoisted.n = '2'
    render(<KorPage />)
    expect(screen.getByText('2. KÖR')).toBeInTheDocument()
    expect(screen.getByText('Fuel & ciklus · 4 tétel')).toBeInTheDocument()
    expect(screen.getByText('Makró-teljesítés, NOVA')).toBeInTheDocument()
    expect(screen.getByText('comfort-eating')).toBeInTheDocument()
    // 'Víz' has no det[] — no chip, no crash.
    expect(screen.getByText('Víz')).toBeInTheDocument()
  })

  test('a multi-detector item shows a count, not each key', () => {
    hoisted.n = '3'
    render(<KorPage />)
    expect(screen.getByText('Streak-törés/visszatérés')).toBeInTheDocument()
    expect(screen.getByText('3 detektor')).toBeInTheDocument()
  })

  test('a sensitive item carries the ÉRZÉKENY dot', () => {
    hoisted.n = '2'
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
