import type { IconName } from '@/components/ui/Icon'
import type { NovaGroup } from './nova'

export type DayState = 'good' | 'medium' | 'rough'
export interface CheckinValues { energy: number; stress: number; body: number; mental: number }
export type CheckinState = 'done' | 'now' | 'skipped' | 'pending'
export interface CheckinSlot { time: string; state: CheckinState; values: CheckinValues | null; note: string | null; savedAt?: string }
export interface BriefingRef { kind: string; id?: string; label: string }
export interface BriefingPara { type: 'p'; text: string }
export interface Briefing { eyebrow: string; body: BriefingPara[]; refs: BriefingRef[]; confidence: number; tone?: string }
export interface WorkoutExercise { id: string; name: string; sets: number; targetReps: string; targetRIR: number; type: string; muscle: string }
export interface NiggleWarning { muscle: string; muscleLabel: string; detail: string }
export interface Workout { title: string; tag: string; durationEst: number; exercises: WorkoutExercise[]; niggleWarning: NiggleWarning }
export interface VolleyballSession { day: string; time: string; duration: number; court: string; intensity: string; role: string; today?: boolean }
export type FuelKind = 'wake' | 'meal' | 'midday' | 'snack' | 'preworkout' | 'workout' | 'sport' | 'evening'
export interface SlotItem { type: 'supplement'; refId: string; label: string; done: boolean; primary?: boolean; note?: string }
export interface FuelSlot {
  time: string
  kind: FuelKind
  label: string
  state: 'done' | 'now' | 'pending'
  mealName?: string
  mezoNote?: string
  windowTip?: string
  kcal?: number; p?: number; c?: number; f?: number
  duration?: number
  items?: SlotItem[] | { done?: boolean }[]
}
export interface FuelPlanToday {
  workout: { type: string; start: string; end: string; duration: number }
  volleyball: { start: string; end: string; noneToday: boolean }
  bedtime: string; kitchenClose: string; caffeineCutoff: string
  slots: FuelSlot[]
}
export interface MacroSet { kcal: number; p: number; c: number; f: number; water: number }
export type ToolType = 'read' | 'compute' | 'write'
export interface MealDimensionBase { id: 'macro' | 'micro' | 'nova' | 'context'; label: string; weight: number; score: number; color: string; detail: string }
export interface MacroDimension extends MealDimensionBase { id: 'macro'; macroRatio: { p: number; c: number; f: number }; macroTargets: { p: string; c: string; f: string }; kcalShareOfDay: number; notes?: string }
export type MicroStatus = 'good' | 'ok' | 'low'
export interface MicroDimension extends MealDimensionBase { id: 'micro'; micros: { name: string; value: string; pct: number; status: MicroStatus }[] }
export interface NovaDimension extends MealDimensionBase { id: 'nova'; nova: { dominant: NovaGroup; stack: { nova: NovaGroup; pct: number; label: string }[]; items: { name: string; nova: NovaGroup; warning?: boolean }[] } }
export interface ContextDimension extends MealDimensionBase { id: 'context'; context: { label: string; value: string }[] }
export type MealDimension = MacroDimension | MicroDimension | NovaDimension | ContextDimension
export interface MealBreakdown {
  confidence: number
  summary: string
  dimensions: MealDimension[]
  improve: { text: string; impact: string }[]
  tools: { type: ToolType; name: string }[]
}
export interface FuelMeal {
  id: string; slot: string; title: string; score: number | null
  kcal: number; p: number; c: number; f: number
  items: string[]; tags: string[]
  recipeId?: string; loggedAt?: string
  breakdown?: MealBreakdown
}
export interface Micronutrient { name: string; pct: number; target: string }
export interface FuelSummary { name: string; when: string; state: 'done' | 'pending'; dose: string }
export interface FuelDay {
  targets: MacroSet; consumed: MacroSet
  meals: FuelMeal[]
  pacing: { eyebrow: string; msg: string }
  micronutrients: Micronutrient[]
  supplements: FuelSummary[]
}
export type SupplementType = 'supplement' | 'stimulant' | 'medication'
export interface SupplementStashItem {
  id: string; name: string; brand: string; type: SupplementType; category: string
  dose: string; form: string; stock: number | null; stockUnit: string | null
  protocol: string; timing: string; taken: boolean; caffeine?: boolean
}
export interface Protocol {
  version: number; builtAt: string; source: string; status: string
  itemCount: number; confidence: number; lastReplanReason: string | null
  history: { v: number; when: string; reason: string }[]
}
export interface TodayMeta { dayLabel: string; dateLabel: string; workoutType: string; workoutTime: string; retaDay: number; mesoPhase: string }
export interface UserMeta {
  weekInMeso: number
  dayInWeek: number
  mesoLabel: string
  name: string
  handle: string
  age: number
  memberDays: number
  streakDays: number
}
export interface TodayScenario { dayState: DayState; retaDay: number; niggle: boolean; vulnerable: boolean; anchorMode: boolean }

// --- Profil extras (hardcoded in prototype JSX → typed consts here) ---
export interface IdentityGoalCard { eyebrow: string; quote: string; note: string }
export interface AreaRow { area: string; weight: number; last: string }
export interface QuickSettingRow { icon: IconName; label: string; val: string }
export interface NotifSetting { icon: IconName; label: string; val: string }

// --- Shared insight/factor shapes (Cél + Alvás reuse these) ---
export type FactorKind = 'positive' | 'neutral' | 'negative' | 'watch'
export interface Factor {
  kind: FactorKind
  title: string
  impact: string
  evidence: string
  confidence: number
  warning?: boolean
}
export type TrendInsightType = 'milestone' | 'pattern' | 'warning'
export interface TrendInsight { type: TrendInsightType; text: string }

// --- Cél (goals) ---
export type GoalKind = 'cut' | 'bulk' | 'maintenance'
export type GoalStatus = 'active' | 'planned' | 'archived'
export interface Goal {
  id: string
  title: string
  kind: GoalKind
  status: GoalStatus
  startWeight: number
  currentWeight: number
  targetWeight: number
  unit: string
  startDate: string
  targetDate: string
  rateTarget: { value: number; unit: string; direction: 'down' | 'up' }
  mesocycles: string[]
  identityFrame: string
}
export interface WeightEntry { date: string; value: number; note?: string }
export interface WeightTrends {
  last7d: { avg: number; deltaVsPrev: number; weeklyRate: number; onTrack: boolean }
  last4w: { avg: number; deltaVsStart: number; weeklyRate: number; onTrack: boolean }
  sinceStart: { delta: number; daysIn: number; projectedEndDate: string; projectedRateGap: number }
  factors: Factor[]
  insights: TrendInsight[]
}
export interface LinkedMeso {
  id: string
  shortTitle: string
  status: GoalStatus
  startDate: string
  endDate: string
  weeks: number
}

// --- Alvás (sleep) ---
export interface SleepEntry {
  date: string
  bedtime: string
  wakeup: string
  duration: number
  quality: number
  awakenings: number
  mealToSleep: number
  notes: string | null
}
export interface SleepTrends {
  target: { duration: number; quality: number; bedtime: string; wakeup: string }
  last7d: { avgDuration: number; avgQuality: number; nightsUnder7h: number; awakeningsAvg: number; onTrack: boolean }
  last14d: { avgDuration: number; avgQuality: number; nightsUnder7h: number; awakeningsAvg: number; onTrack: boolean }
  factors: Factor[]
  insights: TrendInsight[]
}

// --- Emberek (people) ---
export type Affect = 'positive' | 'neutral' | 'mixed' | 'negative'
export type Relationship = 'partner' | 'teammate' | 'mentee'
export type MentionSource = 'voice' | 'camera' | 'chip' | 'text'
export interface Ritual {
  kind: string
  title: string
  whenLabel: string
  daysAway: number
  attendees: string[]
  lastHeldLabel: string
}
export interface AttentionItem { kind: 'watch' | 'celebrate'; person: string; reason: string }
export interface PeopleSummary {
  activeCount: number
  mentionsThisWeek: number
  mentionsLastWeek: number
  affectScoreWeek: number
  creditTrend: 'rising' | 'stable' | 'falling'
  ritualUpcoming: Ritual
  attention: AttentionItem[]
}
export interface PersonEntry {
  id: string
  name: string
  initial: string
  relationship: Relationship
  relationshipHu: string
  affect_baseline: Affect
  mentionCount: number
  mentionsThisWeek: number
  last_mentioned_at: string
  lastMentionLabel: string
  contactCadenceLabel: string
  notes: string
  affectTrend: number[]
  knownFacts: string[]
  ties: string[]
}
export interface Mention {
  id: string
  ts: string
  dayLabel: string
  timeLabel: string
  person_id: string
  personName: string
  source: MentionSource
  duration_s?: number
  excerpt: string
  tone: Affect
  tiedTo?: { kind: string; label: string }
  flagged?: boolean
}
export interface RelationPattern {
  id: string
  title: string
  evidence: string
  kind: 'positive' | 'watch' | 'negative'
  confidence: number
  involves: string[]
}

// --- Tudás (knowledge) ---
export type FactCategory = 'physiology' | 'preference' | 'trigger' | 'tendency' | 'goal_state'
export interface KnowledgeFact { id: string; text: string; category: FactCategory; active: boolean; reinforced: number }
export interface KnowledgeEdge { from: string; to: string; type: 'reinforces' | 'context' | 'causes' }
