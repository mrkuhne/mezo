import type { IconName } from '@/shared/ui/Icon'
import type { Tool } from '@/shared/ui/ToolChip'
import type { NovaGroup } from '@/data/nova'
import type { PantrySourceKey } from '@/data/pantrySources'

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
export interface VolleyballSession { day: string; time: string; duration: number; court: string; intensity: string; role: string; today?: boolean; flex?: boolean }
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
  items?: SlotItem[]
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
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealItemSource = 'recipe' | 'pantry'
/** A logged meal line — polymorphic ref (recipe|pantry) + frozen snapshot name + this line's
 *  macro share. Mirrors RecipeIngredientLine: `refId` === recipeId (source 'recipe') or
 *  pantryItemId (source 'pantry'). `contribution` is round(snapshot × amount/per), HALF_UP. */
export interface MealItemLine {
  source: MealItemSource
  refId: string
  amount: number
  unit: string
  name: string // server snapshot name (frozen at log time)
  contribution: { kcal: number; p: number; c: number; f: number }
  nova?: number // 1..4, carried for the future NOVA score dimension
}
export interface FuelMeal {
  id: string; slot: string; title: string; score: number | null
  kcal: number; p: number; c: number; f: number
  mealItems: MealItemLine[] // structured lines (real once logged)
  items: string[] // legacy free-text labels — kept for the mock score-sheet seeds
  tags: string[]
  loggedAt: string; mealDate: string // real instant + denormalized day key
  recipeId?: string
  breakdown?: MealBreakdown
}
/** Editor line — maps to MealItemRequest (refId → recipeId|pantryItemId by source). */
export interface MealInputItem { source: MealItemSource; refId: string; amount: number; unit: string }
/** Capture-sheet save payload — maps to the MealRequest contract. */
export interface MealInput {
  slot: MealSlot
  loggedAt?: string | null
  title?: string | null
  items: MealInputItem[]
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
  // Nutrition + commerce facts (mezo-1za9) — supplements carry macros/nutrients/price too;
  // optional because pure dose/protocol items (many stim/med) have none. Mirrors Ingredient.
  source?: PantrySourceKey; per?: number; unit?: string
  macros?: { kcal: number; p: number; c: number; f: number }
  price?: number; priceUnit?: string; pkg?: string
  micros?: { name: string; pct: number }[]; nova?: NovaGroup
  fiberG?: number | null; sugarG?: number | null; saltG?: number | null; saturatedFatG?: number | null
}
export interface Protocol {
  version: number; builtAt: string; source: string; status: string
  itemCount: number; confidence: number; lastReplanReason: string | null
  history: { v: number; when: string; reason: string }[]
}
// --- Medication (Gyógyszer) — mirrors the generated Medication* DTOs (api.gen.ts) ---
export type MedicationPhaseKey = 'peak' | 'stable' | 'trough'
export interface MedicationPhase { key: MedicationPhaseKey; fromDay: number; toDay: number; label: string }
export interface MedicationCycleConfig { cycleLengthDays: number; phases: MedicationPhase[] }
/** One injection logged against the medication. */
export interface MedicationDose { id: string; administeredAt: string; dose: number; note?: string | null }
/** The derived weekly cycle (which day of the cycle we're on + the phase grid). */
export interface MedicationCycleCell { day: number; phaseKey: string; label: string; current: boolean }
export interface MedicationCycle {
  retaDay: number; phaseKey: string; phaseLabel: string
  lastDoseAt?: string | null
  week: MedicationCycleCell[]
}
/** The medication definition + its cycle config. */
export interface Medication {
  id: string; name: string; activeIngredient: string; route: string; cadence: string
  defaultDose: number; doseUnit: string
  cycle: MedicationCycleConfig
  active: boolean
}
export interface MedicationDay {
  medication: Medication
  cycle: MedicationCycle
  recentDoses: MedicationDose[]
}
/** Editor input for updating the medication definition. */
export interface MedicationInput {
  name: string; activeIngredient: string; route: string; cadence: string
  defaultDose: number; doseUnit: string
  cycle: MedicationCycleConfig
  active: boolean
}
/** Editor input for logging an injection. */
export interface MedicationDoseInput { administeredAt?: string | null; dose: number; note?: string | null }

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

// --- Pantry (Kamra) + Recipes (Receptek) ---
export interface PantryCategoryMeta { label: string; color: string }
export interface IngredientStock { qty: number; unit: string; expires: string | null; lowExpiry?: boolean }
export interface Ingredient {
  id: string; name: string; brand: string; source: PantrySourceKey; category: string
  per: number; unit: string
  macros: { kcal: number; p: number; c: number; f: number }
  fiberG?: number | null; sugarG?: number | null; saltG?: number | null; saturatedFatG?: number | null
  price: number; priceUnit: string; pkg: string
  micros: { name: string; pct: number }[]
  nova: NovaGroup
  stock: IngredientStock | null
  lastUsed: string; usedInRecipes: number; scrapedAt?: string
  stashRefId?: string; warning?: string
}
export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export interface RecipeLog { mealId: string; slot: string; score: number; delta: number; loggedAt: string; kcal: number; p: number; c: number; f: number }
export interface RecipeIngredientLine {
  refId: string // === pantryItemId (the pantry source row); kept as refId for the mock seed
  amount: number
  unit: string
  note?: string
  name?: string // server-computed snapshot name (present on persisted/loaded recipes)
  contribution?: { kcal: number; p: number; c: number; f: number } // this line's macro share
}
export interface Recipe {
  id: string; name: string; slot: string; category: RecipeCategory
  createdDate: string; timesLogged: number; avgScore: number; lastLogged: string
  servings: number; prepMins: number; cookMins: number; tags: string[]
  ingredients: RecipeIngredientLine[]
  macros: { kcal: number; p: number; c: number; f: number }
  novaDominant: NovaGroup
  mezoFit: { score: number | null; fitsFor: string[] }
  starred: boolean
  recentLogs?: RecipeLog[]
  templateBreakdown?: MealBreakdown
}
/** Editor save payload — maps to the RecipeRequest contract (refId → pantryItemId). */
export interface RecipeInput {
  name: string
  slot?: string | null
  category: RecipeCategory
  servings: number
  prepMins?: number | null
  cookMins?: number | null
  tags: string[]
  starred: boolean
  ingredients: { pantryItemId: string; amount: number; unit: string; note?: string | null }[]
}
export interface PantryImport { id: string; source: PantrySourceKey; when: string; items: number; status: 'synced' | 'manual-review'; ofWhat: string }
export interface PantrySuggestion { name: string; source: PantrySourceKey; price: string; reason: string }

// Unified pantry item shape — built by buildKamraItems (Task 28), consumed by KamraCard.
// Merges scraped Ingredient (food) + SupplementStashItem (supplement/stim/med) into one card model.
export type PantryItemKind = 'food' | 'supplement' | 'stim' | 'med'
export interface PantryItem {
  id: string; name: string; brand: string; source: PantrySourceKey; category: string
  kind: PantryItemKind
  per?: number; unit?: string
  macros?: { kcal: number; p: number; c: number; f: number }
  fiberG?: number | null; sugarG?: number | null; saltG?: number | null; saturatedFatG?: number | null
  price?: number; priceUnit?: string; pkg?: string
  micros?: { name: string; pct: number }[]
  nova?: NovaGroup
  stock?: IngredientStock | { qty: number; unit: string } | null
  lastUsed?: string; usedInRecipes?: number; scrapedAt?: string
  isStashOnly?: boolean; dose?: string; protocol?: string; caffeine?: boolean; form?: string
  stashRefId?: string
}

/** Form payload for creating/editing a pantry item (maps to the PantryItemRequest contract). */
export interface PantryItemInput {
  kind: PantryItemKind
  name: string
  brand?: string
  source?: PantrySourceKey
  category?: string
  notes?: string
  per?: number; unit?: string
  kcal?: number; proteinG?: number; carbsG?: number; fatG?: number
  fiberG?: number; sugarG?: number; saltG?: number; saturatedFatG?: number
  price?: number; priceUnit?: string; pkg?: string
  micros?: { name: string; pct: number }[]
  nova?: NovaGroup
  stockQty?: number; stockUnit?: string; stockExpires?: string
  dose?: string; form?: string; protocol?: string; timing?: string; caffeine?: boolean
}

// --- Cél (goals) ---
export type GoalKind = 'cut' | 'bulk' | 'maintenance'
export type GoalStatus = 'active' | 'planned' | 'archived'
// Domain Goal — the thin back-compat shape useGoal still exposes for consumers
// that read flattened weights/identity (WeightPage, FuelStackView's linked plans,
// EditGoalSheet's rateTarget). The GoalsPage command-center hero now reads the raw
// `GoalResponse` (trajectory/guards/window/weights) directly; `startDate`,
// `targetDate` and `unit` were retired from this shape in G4b (Decision C) since
// nothing consumes them anymore. `kind`/`rateTarget` stay (hook tests + Task 6).
export interface Goal {
  id: string
  title: string
  kind: GoalKind
  status: GoalStatus
  startWeight: number
  currentWeight: number
  targetWeight: number
  rateTarget: { value: number; unit: string; direction: 'down' | 'up' }
  mesocycles: string[]
  identityFrame: string
}
export interface WeightEntry { date: string; value: number; note?: string }
/** Phase 2 REST DTO — POST /weight-log. `date` is stamped to today by the caller (no UI date picker). */
export interface WeightLogInput { date: string; weightKg: number; note?: string }
// Only the backend-derived EWMA figures the views render: the 7-day trend weight
// (avg) and the weekly rates (kg/hét). The qualitative legs (factors/insights/
// projection) the engine does not yet produce were dropped with the placeholder UI.
export interface WeightTrends {
  last7d: { avg: number; weeklyRate: number }
  last4w: { weeklyRate: number }
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
/** Phase 2 REST DTO — POST /sleep-log. `durationH` is computed in the sheet from bedtime+wakeup. */
export interface SleepLogInput {
  date: string; bedtime: string; wakeup: string
  durationH: number; quality: number; awakenings: number; note?: string
}
// --- Emberek (people) ---
export type Affect = 'positive' | 'neutral' | 'mixed' | 'negative'
export type Relationship = 'partner' | 'teammate' | 'mentee'
export type MentionSource = 'voice' | 'camera' | 'chip' | 'text'
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
/** Phase 2 REST DTO — POST /mentions. Hook enriches id/ts/labels/personName/source server-side in Phase 2. */
export interface MentionLogInput {
  personId: string
  tone: Affect
  text?: string
}

// --- Fuel · weekly (Terv) + replan + gym schedule ---
export type RetaPhase = 'Peak' | 'Stable' | 'Trough'
export interface RetaDayCell { d: number; label: RetaPhase; color: string }
// NOTE: prototype data.js gymSchedule.weeklyTimes uses null for inactive (Szo/Vas)
// days and `today` is present on only one row → fields adapted to the real data.
export interface GymScheduleDay {
  day: string
  active: boolean
  today?: boolean
  time: string | null
  duration: number | null
  type: string | null
}
/** Standalone weekly gym slot (persists across mesocycles). `dayOfWeek`: 0=Hét .. 6=Vas. */
export interface GymScheduleSlot { dayOfWeek: number; time: string }
export interface WeeklySupplementRow { name: string; dose: string; days: number[]; color: string; note?: string }
export interface RecurringPattern { icon: IconName; color: string; title: string; detail: string }
export interface ReplanCascade { system: 'Fuel' | 'Train' | 'Sleep' | 'Insights'; impact: string; detail: string }
export interface ReplanScenario {
  id: string
  title: string
  detail: string
  icon: IconName
  color: string
  cascades: ReplanCascade[]
  tools: { type: ToolType; name: string }[]
  confidence: number
}
export interface StackRecommendation {
  name: string
  source: PantrySourceKey
  price: string
  inStash: boolean
  reason: string
  metric: string
  confidence: number
}

// --- Fuel · Stack protocol builder ---
export interface ProtocolSlotItem { name: string; dose: string; color: string }
export interface ProtocolSlotData {
  time: string
  window: string
  kind: string
  kindColor: string
  relatedTo?: string
  items: ProtocolSlotItem[]
  reasoning: string
  primary: boolean
}
export interface Reasoning {
  kind: 'physiology' | 'timing' | 'interaction' | 'sleep'
  text: string
  evidence?: string
}
export interface MealMatch { recipeId: string; slot: string; reason: string }
export interface BuiltProtocol {
  slots: ProtocolSlotData[]
  reasoning: Reasoning[]
  mealMatches: MealMatch[]
}

// --- Tudás (knowledge) ---
export type FactCategory = 'physiology' | 'preference' | 'trigger' | 'tendency' | 'goal_state'
export interface KnowledgeFact { id: string; text: string; category: FactCategory; active: boolean; reinforced: number }
export interface KnowledgeEdge { from: string; to: string; type: 'reinforces' | 'context' | 'causes' }

// --- Insights (AI-memory surface) ---
export type PatternCategory = 'physiology' | 'trigger' | 'response'
export type PatternStatus = 'confirm' | 'monitor' | 'reject'
export interface PatternCritique {
  statistical: number
  confounders: number
  l3align: number
  actionability: number
}
export interface Pattern {
  id: string
  category: PatternCategory
  categoryLabel: string
  confidence: number
  title: string
  mechanism: string
  evidence: string[]
  critique: PatternCritique
  thinking?: string
}

export interface MemoirAnchor { kind: string; label: string }
export interface Memoir {
  week: string
  title: string
  body: string
  anchors: MemoirAnchor[]
}

export type PredictionStatus = 'pending' | 'validated'
export interface Prediction {
  id: string
  title: string
  confidence: number
  status: PredictionStatus
  date: string
  basis?: string
  actual?: string
}

export type ExperimentStatus = 'active' | 'completed'
export interface Experiment {
  id: string
  title: string
  status: ExperimentStatus
  day: number
  total: number
  hypothesis: string
  outcome?: string
  outcomeGood?: boolean
}

export type WeeklyTrend = 'up' | 'down' | 'flat'
export interface WeeklyItem { label: string; value: string; trend: WeeklyTrend }
export interface WeeklyReview { title: string; score: number; delta: number; items: WeeklyItem[] }

export type ChatRole = 'user' | 'assistant'
export interface ChatRef { kind: string; id: string }
export interface ChatMessage {
  role: ChatRole
  ts: string
  text: string
  tools?: Tool[]
  refs?: ChatRef[]
}

// --- Train (mesocycles, workouts, sport) ---
// NOTE (port fix): `NiggleWarning` and `GymScheduleDay` already exist above (Today/Fuel
// slices) with the exact shape Train needs — reused here rather than re-declared.
// The plan's "WorkoutExercise" interface collides by name with the existing Today
// `WorkoutExercise` (no `lastWeek`); the Train logged-set variant is therefore named
// `LoggedWorkoutExercise`, and the plan's "WorkoutPlan" is kept verbatim. The existing
// `VolleyballSession` gained an additive optional `flex?` field (present on the Szo
// fixture in data.js) so it can be reused for the sport schedule too.
export type MesoPhase = 'MEV' | 'MAV' | 'MRV' | 'Deload'
export type MesoStatus = 'active' | 'planned' | 'archived'
export type ExerciseKind = 'compound' | 'isolation' | 'plyo'

export interface GymExercise {
  id: string
  name: string
  muscle: string
  sets: number
  targetReps: string
  targetRIR: number
  type: ExerciseKind
  warning?: string
  catalogId?: string  // exercise_catalog row when picked from the API catalog (real mode)
}
export interface MesoDay {
  id?: string            // template-day row id (real mode only; mock fixtures carry none)
  day: string            // 'Hét'..'Vas'
  type: string           // 'Pull Day' | 'Rest' | ...
  muscle: string
  exerciseCount: number
  exercises: GymExercise[]
  note?: string
  current?: boolean
  muscleAccent?: boolean
}
export interface VolumeBaseline { name: string; mev: number; mav: number; mrv: number }
export interface VolumeAdjustment {
  kind: string           // 'pattern' | 'recovery' | 'niggle' | 'sport-cross'
  label: string
  delta: Partial<Record<'mev' | 'mav' | 'mrv', number>>
  warning?: boolean
}
export interface VolumeSource {
  baseline: VolumeBaseline
  adjustments: VolumeAdjustment[]
  confidence: number
  note?: string
}
export interface VolumeProfile {
  mev: number; mav: number; mrv: number; current: number
  source: VolumeSource
}
export interface VolumeChange { muscle: string; change: string; reason: string; warning?: boolean }
export interface VolumeRecompute { lastRun: string; nextRun: string; trigger: string; changes: VolumeChange[] }

export interface Mesocycle {
  id: string
  status: MesoStatus
  title: string
  shortTitle: string
  goal: string
  startDate: string
  endDate: string
  weeks: number
  currentWeek: number
  split: string          // 'Pull / Push / Legs · 5×/hét'
  style: string          // 'RP · 6 hét'
  phaseCurve: MesoPhase[]
  notes?: string
  summary?: string
  volumeRecompute?: VolumeRecompute
  volumePerMuscle?: Record<string, VolumeProfile>
  days?: MesoDay[]
}

export interface LastWeekSet { weight: number; reps: number; rir: number }
export interface LoggedWorkoutExercise {
  id: string
  name: string
  sets: number
  targetReps: string
  targetRIR: number
  type: ExerciseKind
  muscle: string
  lastWeek: LastWeekSet | null // null on the first-ever workout (no previous completed instance)
  note?: string | null // durable per-exercise note (F4); absent in Phase-1 statics
}
export interface ChallengeRef { kind: string; label: string }
export type ChallengeType = 'PR' | 'Depth' | 'Volume' | 'Tempo'
export interface Challenge {
  id: string
  type: ChallengeType
  typeLabel: string
  exerciseId: string
  exercise?: string
  target: string
  confidence: number
  risk: 'low' | 'mid'
  why: string
  refs: ChallengeRef[]
  tools: Tool[]
  glory: string
}
export interface WorkoutPlan {
  title: string
  tag: string
  durationEst: number
  exercises: LoggedWorkoutExercise[]
  niggleWarning?: NiggleWarning
  challenges: Challenge[]
}

export interface GymSchedule { weeklyTimes: GymScheduleDay[] }

export interface SportSchedule {
  volleyball: { team: string; sessions: VolleyballSession[]; season: string; weeklyHours: number }
}
export interface SportSession {
  id: string; sport: string; date: string; time: string; duration: number
  setsPlayed: number | null; intensity: number | null; rpe: number; shoulderStrain: number | null
  jumpCount: number | null; notes: string | null
}
export interface SportWeek {
  label: string; sessions: number; hoursPlayed: number
  avgRPE: number; avgShoulderStrain: number; shoulderLoadTrend: string
}
export interface CrossLoadRow {
  target: string; impact: string; why: string; system: string; warning?: boolean
}
export interface Sport {
  schedule: SportSchedule
  sessions: SportSession[]
  week: SportWeek
  crossLoad: CrossLoadRow[]
}

export interface ExerciseLibraryItem {
  id: string; name: string; muscle: string; type: ExerciseKind; stim: number; fatigue: number
  catalogId?: string  // set when the item comes from the backend catalog (real mode)
}

export interface GoalPreset {
  id: string; label: string; sub: string; description: string
  defaultWeeks: number; split: string; days: number; style: string
  phaseTemplate: MesoPhase[]; color: string; icon: IconName
}
export interface SplitOption { label: string; days: number[]; best: string | null }
