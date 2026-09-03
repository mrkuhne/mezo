import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitEditSheet } from '@/features/me/sheets/HabitEditSheet'

const { createDef, updateDef, deleteDef, useHabitCatalogActions, useProgressionProfile } = vi.hoisted(() => ({
  createDef: vi.fn(() => Promise.resolve()),
  updateDef: vi.fn(() => Promise.resolve()),
  deleteDef: vi.fn(() => Promise.resolve()),
  useHabitCatalogActions: vi.fn(),
  useProgressionProfile: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => useProgressionProfile(),
}))

const LIFE_PROFILE = {
  life: [
    { skillKey: 'mindfulness', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'mindset', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'cooking', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'financial', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'productivity', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'learning', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'connection', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
    { skillKey: 'recovery', kind: 'LIFE', level: 1, cumulativeXp: 0, progressPct: 0 },
  ],
}

beforeEach(() => {
  createDef.mockClear(); updateDef.mockClear(); deleteDef.mockClear()
  useHabitCatalogActions.mockReturnValue({ createDef, updateDef, deleteDef, pending: false })
  useProgressionProfile.mockReturnValue({ data: LIFE_PROFILE })
})

describe('HabitEditSheet — create', () => {
  it('defaults to MANUAL and saves createDef with the typed fields', () => {
    render(<HabitEditSheet chainKey="MORNING" onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Cím'), { target: { value: 'Napi olvasás' } })
    fireEvent.change(screen.getByLabelText('Miért'), { target: { value: 'Mert épít' } })
    fireEvent.change(screen.getByLabelText('Horgony-szöveg'), { target: { value: 'reggeli után' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tanulás' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'MORNING', title: 'Napi olvasás', why: 'Mert épít', anchorCopy: 'reggeli után',
      mode: 'MANUAL', skillKey: 'learning', xp: 5, linkUrl: null,
    })
  })

  it('a metric select appears only once DERIVED is chosen, and its value is sent', () => {
    render(<HabitEditSheet chainKey="MORNING" onClose={vi.fn()} />)
    expect(screen.queryByLabelText('Metrika')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /derived/i }))
    expect(screen.getByLabelText('Metrika')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Metrika'), { target: { value: 'weight_logged_today' } })
    fireEvent.change(screen.getByLabelText('Cím'), { target: { value: 'Súlymérés' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tanulás' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(createDef).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'DERIVED', metric: 'weight_logged_today',
    }))
  })

  // The sheet is CREATE-only since the mezo-3zue.4 fix wave: `RutinHubPage` only ever opened it
  // as `{chainKey}`, so its edit and delete branches were unreachable dead code — and a dead
  // delete path is a hazard. Editing and deleting a definition live on `HabitPage` now.
  it('has no edit-mode affordances at all — no delete, no read-only chips', () => {
    render(<HabitEditSheet chainKey="MORNING" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /habit törlése/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Új habit' })).toBeInTheDocument()
    // the create-only controls the edit branch used to hide are all present
    expect(screen.getByRole('button', { name: /manual/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regeneráció' })).toBeInTheDocument()
  })

  it('the XP stepper is bounded to 5–15 and steps by 5', () => {
    render(<HabitEditSheet chainKey="MORNING" onClose={vi.fn()} />)
    expect(screen.getByLabelText('XP érték')).toHaveTextContent('5')
    fireEvent.click(screen.getByRole('button', { name: 'XP csökkentése' }))
    expect(screen.getByLabelText('XP érték')).toHaveTextContent('5') // floor
    fireEvent.click(screen.getByRole('button', { name: 'XP növelése' }))
    fireEvent.click(screen.getByRole('button', { name: 'XP növelése' }))
    expect(screen.getByLabelText('XP érték')).toHaveTextContent('15')
    fireEvent.click(screen.getByRole('button', { name: 'XP növelése' }))
    expect(screen.getByLabelText('XP érték')).toHaveTextContent('15') // ceiling
  })
})
