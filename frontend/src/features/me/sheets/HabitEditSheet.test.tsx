import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitEditSheet } from '@/features/me/sheets/HabitEditSheet'
import type { HabitDefInfo } from '@/data/types'

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

const EDIT_DEF: HabitDefInfo = {
  id: 'def-1', habitKey: 'custom_abc12345', chainKey: 'MORNING', position: 3, title: 'Nyújtás',
  why: 'Miért fontos', anchorCopy: 'kávé után', mode: 'DERIVED', metric: 'training_done_today',
  skillKey: 'recovery', xp: 10, linkUrl: 'https://example.com', isActive: true,
  framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
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

describe('HabitEditSheet — edit', () => {
  it('pre-fills every field and shows mode/metric/skill as read-only chips (contract-immutable)', () => {
    render(<HabitEditSheet chainKey="MORNING" def={EDIT_DEF} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Cím')).toHaveValue('Nyújtás')
    expect(screen.getByLabelText('Miért')).toHaveValue('Miért fontos')
    expect(screen.getByLabelText('Horgony-szöveg')).toHaveValue('kávé után')
    expect(screen.getByLabelText('Link URL')).toHaveValue('https://example.com')
    expect(screen.getByText('DERIVED')).toBeInTheDocument()
    expect(screen.getByText('training_done_today')).toBeInTheDocument()
    // no editable controls for the immutable fields
    expect(screen.queryByRole('button', { name: /manual/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Metrika')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Regeneráció' })).not.toBeInTheDocument()
  })

  it('saves updateDef with only the editable fields', () => {
    render(<HabitEditSheet chainKey="MORNING" def={EDIT_DEF} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Cím'), { target: { value: 'Nyújtás — reggel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('def-1', {
      title: 'Nyújtás — reggel', why: 'Miért fontos', anchorCopy: 'kávé után', xp: 10,
      linkUrl: 'https://example.com',
    })
  })

  it('clearing an optional field omits its key from the patch — can\'t clear in v1 (mezo-n5e9.2 fix wave)', () => {
    render(<HabitEditSheet chainKey="MORNING" def={EDIT_DEF} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Miért'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    // Exact deep equality (no `objectContaining`) — if `why` were still present at all
    // (even as `null`), this assertion would fail, since the actual patch must match precisely.
    expect(updateDef).toHaveBeenCalledWith('def-1', {
      title: 'Nyújtás', anchorCopy: 'kávé után', xp: 10, linkUrl: 'https://example.com',
    })
  })

  it('a danger-styled "Habit törlése" button calls deleteDef with the def id', () => {
    render(<HabitEditSheet chainKey="MORNING" def={EDIT_DEF} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /habit törlése/i }))
    expect(deleteDef).toHaveBeenCalledWith('def-1')
  })

  it('CREATE mode has no delete affordance (nothing exists yet to delete)', () => {
    render(<HabitEditSheet chainKey="MORNING" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /habit törlése/i })).not.toBeInTheDocument()
  })
})
