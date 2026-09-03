import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MesoTemplateCard } from '@/features/train/components/MesoTemplateCard'
import type { MesoDay, MesoTemplate } from '@/data/types'

const day = (over: Partial<MesoDay> & { day: string }): MesoDay => ({
  type: 'x', muscle: 'chest', exerciseCount: 0, exercises: [],
  ...over,
})

const template = (over: Partial<MesoTemplate> = {}): MesoTemplate => ({
  id: 't1', title: 'Blokk', shortTitle: 'Blokk', goal: null, goalPreset: 'hypertrophy',
  musclePriorities: null, weeks: 6, split: null, style: null,
  phaseCurve: ['MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  notes: null, volumePerMuscle: null, runCount: 0,
  days: [
    day({ day: 'Hét', muscle: 'chest' }),
    day({ day: 'Kedd', muscle: 'quad' }),
    day({ day: 'Sze', muscle: '' }), // rest — off-day, not counted
    day({ day: 'Csü', muscle: 'back' }),
    day({ day: 'Pén', muscle: 'sport' }), // sport — off-day, not counted
    day({ day: 'Szo', muscle: '' }),
    day({ day: 'Vas', muscle: '' }),
  ],
  ...over,
})

const noop = () => {}
const setup = (t: MesoTemplate) =>
  render(<MesoTemplateCard template={t} onEdit={noop} onStart={noop} onDuplicate={noop} onDelete={noop} />)

describe('MesoTemplateCard chips (mezo-d20.15 Task 5)', () => {
  it('reads the split chip off the trained-day count, ignoring rest/sport off-days', () => {
    // 3 training days (Hét/Kedd/Csü) — Sze/Pén/Szo/Vas are off-days
    setup(template())
    expect(screen.getByText('3 nap · Full body')).toBeInTheDocument()
  })

  it('stars the Emphasize groups by their budget-group label', () => {
    setup(template({ musclePriorities: { shoulder: 'emphasize', back: 'emphasize', chest: 'maintain' } }))
    expect(screen.getByText('★ Váll')).toBeInTheDocument()
    expect(screen.getByText('★ Hát')).toBeInTheDocument()
    // Maintain (or Grow) never gets a star chip
    expect(screen.queryByText('★ Mell')).toBeNull()
    expect(screen.queryByText('Mell')).toBeNull()
  })

  it('carries no star chips at all when nothing is Emphasize', () => {
    setup(template({ musclePriorities: null }))
    expect(screen.queryByText(/^★/)).toBeNull()
  })

  it('shows the weeks-minus-one plus deload chip', () => {
    setup(template({ weeks: 6 }))
    expect(screen.getByText('5 + 1 deload')).toBeInTheDocument()
  })

  it('does NOT flag a template with an ABSENT goalPreset as legacy when its curve closes on Deload', () => {
    // Plenty of pre-wizard-v2 mock fixtures simply never had goalPreset populated — an
    // absent preset alone must not read as legacy, only a PRESENT-and-wrong one does.
    setup(template({ goalPreset: undefined, phaseCurve: ['MEV', 'MAV', 'MRV', 'Deload'] }))
    expect(screen.queryByText('régi modell')).toBeNull()
    expect(screen.queryByText('indításkor az új modellre konvertálódik')).toBeNull()
  })

  it('flags a legacy template with a PRESENT, wrong goalPreset — muted chip + conversion note', () => {
    setup(template({ goalPreset: 'strength' }))
    expect(screen.getByText('régi modell')).toBeInTheDocument()
    expect(screen.getByText('indításkor az új modellre konvertálódik')).toBeInTheDocument()
  })

  it('flags a legacy template whose phase curve carries no Deload week, even with the current goalPreset', () => {
    setup(template({ goalPreset: 'hypertrophy', phaseCurve: ['MEV', 'MAV', 'MRV'] }))
    expect(screen.getByText('régi modell')).toBeInTheDocument()
  })

  it('carries no legacy chip or note for a current-model template', () => {
    setup(template({ goalPreset: 'hypertrophy', phaseCurve: ['MEV', 'MAV', 'MRV', 'Deload'] }))
    expect(screen.queryByText('régi modell')).toBeNull()
    expect(screen.queryByText('indításkor az új modellre konvertálódik')).toBeNull()
  })
})

// Delete confirm behaviour is covered by MesoTemplatesPage.test.tsx (its two-tap flow needs
// the list re-render around the delete). This file only pins the new chip vocabulary.
