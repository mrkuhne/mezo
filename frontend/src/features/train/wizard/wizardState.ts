// ============================================================
// Mezo · wizardState — the 3-step mesocycle wizard's whole state machine
// (Mikor és miért → Fókusz → Program, mezo-d20.14). Pure reducer + the two
// contract mappings the page needs: generateInput (what the plan generator is
// asked) and toUpsert (what the save writes). Everything the wizard knows
// lives here so the page is a dispatcher and the steps are views.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MesoDay, MusclePriorities } from '@/data/types'
import type { MesoPlanGenerateRequest, MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import type { MesoPlanProposal } from '@/data/train/mesoPlanHooks'
import { getSeason } from '@/features/train/logic/mesoDates'
import { toDayInputs } from '@/features/train/logic/mesoDays'
import { recommendedDays } from '@/features/train/logic/mesoPlan'
import { huMonthDay } from '@/shared/lib/dates'

export interface WizardState {
  step: 0 | 1 | 2
  daysOfWeek: string[]
  weeks: number
  priorities: MusclePriorities
  goalText: string
  name: string
  proposal: MesoPlanProposal | null
  /** Editable copy of proposal.days — the program the save writes. */
  program: MesoDay[]
  /** A manual edit landed since the last generation (regeneration would overwrite it). */
  dirty: boolean
  /** ProgramDayView is open for this day (page-state, not a route). */
  activeDay: string | null
}

export type WizardAction =
  | { type: 'setDays'; days: string[] }
  | { type: 'setDayCount'; n: number }
  | { type: 'setWeeks'; weeks: number }
  | { type: 'setPriorities'; priorities: MusclePriorities }
  | { type: 'setGoalText'; text: string }
  | { type: 'setName'; name: string }
  | { type: 'step'; step: 0 | 1 | 2 }
  | { type: 'generated'; proposal: MesoPlanProposal }
  | { type: 'editProgram'; program: MesoDay[] }
  | { type: 'openDay'; day: string | null }

const dayIdx = (d: string) => DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number])
const byDayOrder = (days: string[]) => [...days].sort((a, b) => dayIdx(a) - dayIdx(b))

/** The contract's sparse tier map: only non-default (non-grow) tiers travel; empty -> null. */
function sparse(p: MusclePriorities): MusclePriorities | null {
  const entries = Object.entries(p ?? {}).filter(([, tier]) => tier !== 'grow')
  return entries.length ? (Object.fromEntries(entries) as MusclePriorities) : null
}

export function initialWizardState(today: string): WizardState {
  return {
    step: 0,
    daysOfWeek: recommendedDays(4),
    weeks: 6,
    priorities: {},
    goalText: '',
    name: `Hypertrophy · ${getSeason(huMonthDay(today))}`,
    proposal: null,
    program: [],
    dirty: false,
    activeDay: null,
  }
}

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'setDays':
      return { ...s, daysOfWeek: byDayOrder(a.days) }
    case 'setDayCount':
      return { ...s, daysOfWeek: recommendedDays(a.n) }
    case 'setWeeks':
      return { ...s, weeks: a.weeks }
    case 'setPriorities':
      return { ...s, priorities: a.priorities }
    case 'setGoalText':
      return { ...s, goalText: a.text }
    case 'setName':
      return { ...s, name: a.name }
    case 'step':
      return { ...s, step: a.step, activeDay: null }
    case 'generated':
      return { ...s, proposal: a.proposal, program: a.proposal.days, dirty: false, activeDay: null }
    case 'editProgram':
      return { ...s, program: a.program, dirty: true }
    case 'openDay':
      return { ...s, activeDay: a.day }
  }
}

/** What the plan generator is asked for (POST /api/train/meso-plans/generate). */
export function generateInput(s: WizardState): MesoPlanGenerateRequest {
  return {
    daysOfWeek: s.daysOfWeek,
    weeks: s.weeks,
    priorities: sparse(s.priorities),
    goalText: s.goalText.trim() || null,
  }
}

/**
 * The saved template: the generator's own template metadata (split/style/phase curve/
 * landmarks) with everything the user owns written over it — title, length, tiers, the
 * edited program and the free-text goal as notes.
 */
export function toUpsert(s: WizardState): MesoTemplateUpsertRequest {
  const base = s.proposal?.template
  return {
    title: s.name,
    shortTitle: base?.shortTitle ?? null,
    goal: base?.goal ?? null,
    // Hypertrophy-only wizard (Task 4 retired the presets) — the key still travels.
    goalPreset: base?.goalPreset ?? 'hypertrophy',
    musclePriorities: sparse(s.priorities),
    weeks: s.weeks,
    split: base?.split ?? null,
    style: base?.style ?? null,
    phaseCurve: base?.phaseCurve ?? [],
    notes: s.goalText.trim() || null,
    volumePerMuscle: base?.volumePerMuscle ?? null,
    days: toDayInputs(s.program),
  }
}
