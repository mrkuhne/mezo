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

/** The 17 real companion tools (backend CompanionToolRegistry inventory, 2026-08-31). */
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
}

export function toolDomain(name: string): ToolDomain {
  return TOOLS[name] ?? NEUTRAL(name)
}

/** Ref kinds (the wire's `ChatRef.kind` vocabulary — see chatRefs.ts KIND_LABELS). */
const REF_KINDS: Record<string, ToolDomain> = {
  Workout: { label: 'Edzés', icon: 'i-edzes', wash: 'coral' },
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
  conversation: 'i-mezo',
  checkin_note: 'i-checkin',
}

export function memoryIcon(kind: string): ClayIconName {
  return MEMORY_ICONS[kind] ?? 'i-retegek'
}
