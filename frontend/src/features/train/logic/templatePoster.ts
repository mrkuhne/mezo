// ============================================================
// Mezo · templatePoster (mezo-3a9a) — the pure shape behind the Sablonok poster
// card (docs/design_2.0/prototypes/sablonok.html). The old card said what a
// template IS in chips ("5 nap · U/L/P/P/L", "5 + 1 deload"); the poster DRAWS it:
// a ramp of weekly bars and a seven-slot week spine. Both come from data the
// template already carries (`phaseCurve`, `days`) — nothing here invents a number.
//
// A template is timeless, so the graphics describe its SHAPE, never its progress.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MesoDay, MesoPhase, MesoTemplate } from '@/data/types'
import { isLegacyPlan, phaseCurve } from '@/features/train/logic/mesoPlan'
import { TIER_GROUPS, tierOf } from '@/features/train/logic/musclePriorities'
import { isOffDay } from '@/features/train/logic/offDay'

export interface ArcWeek {
  phase: MesoPhase
  /** 0–1 bar height; the peak ramp week is always 1. */
  height: number
  deload: boolean
}

/** The shortest bar in the row — a deload is a step down, not a gap. */
const DELOAD_HEIGHT = 0.34
const RAMP_FLOOR = 0.45

/**
 * One bar per week of the block. Ramp weeks rise evenly from RAMP_FLOOR to the peak
 * so the row reads as the progression it is; deload weeks drop to a short hatched bar.
 * An empty curve (never generated, or a stub) falls back to the length-derived one —
 * the same `phaseCurve(weeks)` the wizard and the backend skeleton use.
 */
export function weekArc(template: Pick<MesoTemplate, 'phaseCurve' | 'weeks'>): ArcWeek[] {
  const curve = template.phaseCurve.length > 0 ? template.phaseCurve : phaseCurve(template.weeks)
  const ramp = curve.filter(p => p !== 'Deload').length
  let seen = 0
  return curve.map(phase => {
    if (phase === 'Deload') return { phase, height: DELOAD_HEIGHT, deload: true }
    const step = ramp > 1 ? seen / (ramp - 1) : 1
    seen += 1
    return { phase, height: Math.round((RAMP_FLOOR + (1 - RAMP_FLOOR) * step) * 100) / 100, deload: false }
  })
}

export interface SpineDay {
  day: string
  /** The training day's initial ('Upper A' → U); null on rest/sport days. */
  letter: string | null
}

/**
 * The week as seven slots in DAY_ORDER — the split, readable at a glance. Off-days
 * (rest AND sport, via the shared `isOffDay` rule) stay empty: they are not training.
 */
export function daySpine(days: MesoDay[]): SpineDay[] {
  return DAY_ORDER.map(day => {
    const match = days.find(d => d.day === day)
    const letter = match && !isOffDay(match) ? (match.type.trim()[0]?.toUpperCase() ?? null) : null
    return { day, letter }
  })
}

export type TemplateWash = 'coral' | 'gold' | 'sage'

/**
 * The card's wash carries what the block is FOR, so the shelf reads as a mosaic instead
 * of a list. Legacy plans go quiet sage — they convert on start, so they should not shout;
 * a block with an emphasised muscle keeps the Edzés domain coral (it is pushing something);
 * everything else is gold. The preset can't carry this: any non-hypertrophy preset is
 * legacy by `isLegacyPlan`, so `goalPreset` only ever distinguishes old from current.
 */
export function templateWash(
  template: Pick<MesoTemplate, 'goalPreset' | 'phaseCurve' | 'musclePriorities'>,
): TemplateWash {
  if (isLegacyPlan(template)) return 'sage'
  const emphasised = TIER_GROUPS.some(g => tierOf(template.musclePriorities, g) === 'emphasize')
  return emphasised ? 'coral' : 'gold'
}
