import type { ClayIconName } from '@/shared/ui/clay'

// ============================================================
// mezo-vdf4: ONE domain map for the chat's provenance layers —
// the work strip (tool names), the grouped refs footer (ref
// kinds) and the memory cards (recalled-memory kinds) must
// speak the same icon + wash language. Unknown values fall back
// honestly: raw name, neutral wash, the generic orb icon —
// nothing fabricated (the same discipline as chatRefs.ts).
// ============================================================

export type DomainWash = 'sky' | 'lav' | 'sage' | 'coral' | 'gold' | 'rose' | 'neutral'
export interface ToolDomain { label: string; icon: ClayIconName; wash: DomainWash }

const NEUTRAL = (label: string): ToolDomain => ({ label, icon: 'i-mezo', wash: 'neutral' })

/** The 18 real companion tools (backend CompanionToolRegistry inventory, 2026-09-05). */
const TOOLS: Record<string, ToolDomain> = {
  get_weight_log: { label: 'Súlynapló', icon: 'i-suly', wash: 'sky' },
  get_weight_trend: { label: 'Súlytrend', icon: 'i-suly', wash: 'sky' },
  get_recovery: { label: 'Alvás & pihenés', icon: 'i-alvas', wash: 'lav' },
  get_fuel_log: { label: 'Fuel napló', icon: 'i-fuel', wash: 'sage' },
  get_pantry: { label: 'Kamra', icon: 'i-kamra', wash: 'sage' },
  get_recipes: { label: 'Receptek', icon: 'i-recept', wash: 'sage' },
  get_training_log: { label: 'Edzésnapló', icon: 'i-edzes', wash: 'coral' },
  get_training_plan: { label: 'Edzésterv', icon: 'i-meso', wash: 'coral' },
  get_exercise_records: { label: 'Rekordok', icon: 'i-sport', wash: 'coral' },
  get_goal: { label: 'Cél', icon: 'i-cel', wash: 'gold' },
  get_growth: { label: 'Growth', icon: 'i-growth', wash: 'gold' },
  get_insights: { label: 'Összefüggések', icon: 'i-minta', wash: 'lav' },
  get_medication: { label: 'Gyógyszer', icon: 'i-injekcio', wash: 'rose' },
  get_protocol: { label: 'Stack', icon: 'i-stack', wash: 'sage' },
  get_daily_practice: { label: 'Napi gyakorlat', icon: 'i-nap', wash: 'gold' },
  find_similar_past_days: { label: 'Emlékek', icon: 'i-retegek', wash: 'lav' },
  compare_periods: { label: 'Időszak-összevetés', icon: 'i-idozito', wash: 'lav' },
  get_life_goals: { label: 'Életcélok', icon: 'i-cel', wash: 'gold' },
}

/** mezo-vdf4: the wire bakes tool args into the name — `get_recovery(days=3)` —
 *  because `Tool.args` is unused on the backend. Split at the FIRST `(` so both
 *  the bare name and the baked form resolve to the same domain; malformed input
 *  (no closing paren) still yields a best-effort params string. */
export function parseToolName(name: string): { base: string; params?: string } {
  const i = name.indexOf('(')
  if (i === -1) return { base: name }
  const base = name.slice(0, i)
  const rest = name.slice(i + 1)
  const params = rest.endsWith(')') ? rest.slice(0, -1) : rest
  return { base, params }
}

export function toolDomain(name: string): ToolDomain {
  const { base } = parseToolName(name)
  return TOOLS[base] ?? NEUTRAL(base)
}

/** Ref kinds (the wire's `ChatRef.kind` vocabulary — see chatRefs.ts KIND_LABELS).
 *  Mirrors the backend's full ref vocabulary (grepped from backend/src/main/java,
 *  2026-08-31): Goal, Growth, FuelDay, Workout, TrainingPlan, Sleep, Recipe, Protocol,
 *  Medication, WeightTrend, Memory, ExerciseRecord, Weight, Sport, SleepGoal, Run,
 *  Practice, Pantry, PR, Insight, CheckIn — plus Pattern, SleepLog, Checkin, Journal,
 *  Meal, GraphNode. Nothing here is aspirational: every kind the REAL backend can emit
 *  gets an entry so live chips never fall back to the neutral orb (mezo-vdf4). */
const REF_KINDS: Record<string, ToolDomain> = {
  Workout: { label: 'Edzés', icon: 'i-edzes', wash: 'coral' },
  // mezo-d20.13 — the workout-level closing note as a memoir anchor. Distinct label from
  // `Workout`: the chip's job here is to say the chapter leaned on something YOU wrote, not on
  // the session's numbers. Unattributed echo of a person's own words is what reads as
  // surveillance; a visible trail is what reads as attention.
  WorkoutNote: { label: 'Edzés-jegyzet', icon: 'i-naplo', wash: 'coral' },
  Run: { label: 'Futás', icon: 'i-futas', wash: 'coral' },
  PR: { label: 'PR', icon: 'i-sport', wash: 'gold' },
  Pattern: { label: 'Minta', icon: 'i-minta', wash: 'gold' },
  Sleep: { label: 'Alvás', icon: 'i-alvas', wash: 'lav' },
  SleepLog: { label: 'Alvás', icon: 'i-alvas', wash: 'lav' },
  Checkin: { label: 'Check-in', icon: 'i-checkin', wash: 'rose' },
  CheckIn: { label: 'Check-in', icon: 'i-checkin', wash: 'rose' },
  Journal: { label: 'Napló', icon: 'i-naplo', wash: 'gold' },
  Meal: { label: 'Étkezés', icon: 'i-fuel', wash: 'sage' },
  GraphNode: { label: 'Összefüggés', icon: 'i-minta', wash: 'lav' },
  Memory: { label: 'Emlék', icon: 'i-retegek', wash: 'lav' },
  Weight: { label: 'Súly', icon: 'i-suly', wash: 'sky' },
  WeightTrend: { label: 'Súlytrend', icon: 'i-suly', wash: 'sky' },
  FuelDay: { label: 'Fuel nap', icon: 'i-fuel', wash: 'sage' },
  Recipe: { label: 'Recept', icon: 'i-recept', wash: 'sage' },
  Pantry: { label: 'Kamra', icon: 'i-kamra', wash: 'sage' },
  Protocol: { label: 'Stack', icon: 'i-stack', wash: 'sage' },
  Goal: { label: 'Cél', icon: 'i-cel', wash: 'gold' },
  LifeGoal: { label: 'Életcél', icon: 'i-cel', wash: 'gold' },
  Growth: { label: 'Growth', icon: 'i-growth', wash: 'gold' },
  Practice: { label: 'Gyakorlat', icon: 'i-nap', wash: 'gold' },
  TrainingPlan: { label: 'Edzésterv', icon: 'i-meso', wash: 'coral' },
  ExerciseRecord: { label: 'Rekord', icon: 'i-sport', wash: 'coral' },
  Sport: { label: 'Sport', icon: 'i-sport', wash: 'coral' },
  Medication: { label: 'Gyógyszer', icon: 'i-injekcio', wash: 'rose' },
  SleepGoal: { label: 'Alváscél', icon: 'i-alvas', wash: 'lav' },
  Insight: { label: 'Összefüggés', icon: 'i-minta', wash: 'lav' },
}

export function refDomain(kind: string): ToolDomain {
  return REF_KINDS[kind] ?? NEUTRAL(kind)
}

/** Recalled-memory wire kinds (ChatRecalledMemory.kind — journal_entry/daily_summary today,
 *  the rest defensive for the recall surface's other producers). */
const MEMORY_ICONS: Record<string, ClayIconName> = {
  daily_summary: 'i-nap',
  weekly_summary: 'i-heti',
  journal_entry: 'i-naplo',
  chat_turn: 'i-mezo',
  checkin_note: 'i-checkin',
}

export function memoryIcon(kind: string): ClayIconName {
  return MEMORY_ICONS[kind] ?? 'i-retegek'
}
