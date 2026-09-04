import type { GoalSuggestionPreviewResponse } from '@/data/me/goalApi'
import { huInt } from '@/shared/lib/huNum'

export type DiffRowField = 'trajectory' | 'targetWeightKg' | 'targetDate' | 'targetRate'
  | 'weekAverageKcal' | 'trainingDayKcal' | 'restDayKcal' | 'protein' | 'carbs'
  | 'fat' | 'segment' | 'guards'

export interface DiffRow {
  field: DiffRowField
  label: string
  current: string
  proposed: string
  delta: string
  status: 'changed' | 'unchanged'
}

type Projection = GoalSuggestionPreviewResponse['current']
type FieldSpec = {
  field: DiffRowField
  key: string
  label: string
  value: (projection: Projection) => unknown
  format: (value: unknown) => string
  delta?: (current: unknown, proposed: unknown) => string
}

const TRAJECTORY: Record<string, string> = { cut: 'Fogyás', bulk: 'Tömegelés', maintain: 'Tartás' }
const nullable = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
const signed = (value: number, digits = 0) => {
  const abs = Math.abs(value).toFixed(digits).replace('.', ',')
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${abs}`
}
const numberWith = (unit: string, digits = 0) => (value: unknown) => {
  const numeric = nullable(value)
  if (numeric === null) return '—'
  return `${digits ? signed(numeric, digits).replace(/^\+/, '') : huInt(numeric)} ${unit}`
}
const numericDelta = (unit: string, digits = 0) => (current: unknown, proposed: unknown) => {
  const from = nullable(current)
  const to = nullable(proposed)
  if (from === null || to === null || from === to) return 'Nem változik'
  return `${signed(to - from, digits)} ${unit}`
}
const date = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed)
}
const segment = (value: unknown) => {
  const p = value as Projection
  if (p.segmentFromWeek == null || p.segmentToWeek == null) return '—'
  return `W${p.segmentFromWeek}${p.segmentFromWeek === p.segmentToWeek ? '' : `–${p.segmentToWeek}`} · ${p.segmentLabel ?? 'Szakasz'}`
}
const guards = (value: unknown) => {
  const g = value as Projection['guardStatus']
  if (!g) return 'Nincs értékelés'
  const active = [g.strength.active && 'erő', g.muscle.active && 'izom'].filter(Boolean)
  const breached = g.strength.breached || g.muscle.belowMaintenanceMuscles.length > 0 || !g.muscle.rateWithinCap
  return `${active.length ? active.join(' + ') : 'nincs aktív őr'} · ${breached ? 'figyelmeztet' : 'rendben'}`
}

const SPECS: FieldSpec[] = [
  { field: 'trajectory', key: 'trajectory', label: 'Célirány', value: p => p.trajectory, format: v => TRAJECTORY[String(v)] ?? String(v ?? '—') },
  { field: 'targetWeightKg', key: 'targetWeightKg', label: 'Célsúly', value: p => p.targetWeightKg, format: numberWith('kg', 1), delta: numericDelta('kg', 1) },
  { field: 'targetDate', key: 'targetDate', label: 'Céldátum', value: p => p.targetDate, format: date },
  { field: 'targetRate', key: 'targetRateKgPerWeek', label: 'Várt tempó', value: p => p.targetRateKgPerWeek, format: numberWith('kg/hét', 2), delta: numericDelta('kg/hét', 2) },
  { field: 'weekAverageKcal', key: 'weekAverageKcal', label: 'Heti napi átlag', value: p => p.weekAverageKcal, format: numberWith('kcal'), delta: numericDelta('kcal') },
  { field: 'trainingDayKcal', key: 'trainingDayKcal', label: 'Edzésnap', value: p => p.trainingDayKcal, format: numberWith('kcal'), delta: numericDelta('kcal') },
  { field: 'restDayKcal', key: 'restDayKcal', label: 'Pihenőnap', value: p => p.restDayKcal, format: numberWith('kcal'), delta: numericDelta('kcal') },
  { field: 'protein', key: 'proteinG', label: 'Fehérje', value: p => p.proteinG, format: numberWith('g'), delta: numericDelta('g') },
  { field: 'carbs', key: 'carbsG', label: 'Szénhidrát', value: p => p.carbsG, format: numberWith('g'), delta: numericDelta('g') },
  { field: 'fat', key: 'fatG', label: 'Zsír', value: p => p.fatG, format: numberWith('g'), delta: numericDelta('g') },
  { field: 'segment', key: 'segment', label: 'Szakasz', value: p => p, format: segment },
  { field: 'guards', key: 'guards', label: 'Védőkorlátok', value: p => p.guardStatus, format: guards },
]

export function toSuggestionDiffRows(preview: GoalSuggestionPreviewResponse): DiffRow[] {
  const changed = new Set(preview.changedFields)
  return SPECS.map(spec => {
    const current = spec.value(preview.current)
    const proposed = spec.value(preview.proposed)
    const status = changed.has(spec.key) ? 'changed' : 'unchanged'
    return {
      field: spec.field,
      label: spec.label,
      current: spec.format(current),
      proposed: spec.format(proposed),
      delta: status === 'changed' ? (spec.delta?.(current, proposed) ?? 'Változik') : 'Nem változik',
      status,
    }
  })
}
