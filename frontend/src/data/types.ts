import type { IconName } from '@/shared/ui/Icon'
import type { Tool } from '@/shared/ui/ToolChip'
import type { ClayIconName } from '@/shared/ui/clay'
import type { NovaGroup } from '@/data/nova'
import type { PantrySourceKey } from '@/data/pantrySources'

export type DayState = 'good' | 'medium' | 'rough'
export interface CheckinValues { energy: number; stress: number; body: number; mental: number }
export type CheckinState = 'done' | 'now' | 'skipped' | 'pending'
export interface CheckinSlot { time: string; state: CheckinState; values: CheckinValues | null; note: string | null; savedAt?: string }
export interface BriefingRef { kind: string; id?: string; label: string }
export interface BriefingPara { type: 'p'; text: string }
export interface Briefing { eyebrow: string; body: BriefingPara[]; refs: BriefingRef[]; confidence?: number; tone?: string }
/** The unified companion-feed message kinds (companion-feed, mezo-gst9) — one persisted row per
 *  generation. Two kinds are config-text, never LLM output: `intervention` (W5.2, mezo-b3pp.19),
 *  whose card body comes straight from `mezo.companion.interventions[].textHu`, and `setup` (S3,
 *  mezo-d58h.3), whose card body is composed in `SetupCheckService` from a check verdict's own
 *  numbers. */
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening' | 'intervention' | 'people' | 'setup'
/** One companion-feed message — the MezoChip thread's real-mode source (`useCompanionFeed`), mirrors FeedMessageResponse. */
export interface FeedMessage {
  /** The companion_message row id (uuid) — the W4.1 feedback artifactId (`feed_message`). */
  id: string
  kind: FeedMessageKind
  eyebrow: string
  body: BriefingPara[]
  refs: BriefingRef[]
  generatedAt: string // ISO date-time
}
export interface NiggleWarning { muscle: string; muscleLabel: string; detail: string }
/** `date`+`oneOff` mark a dated one-off event merged into the weekly rhythm (mezo-e1sp) — recurring slots carry neither. */
export interface VolleyballSession { day: string; time: string; duration: number; court: string; intensity: string; role: string; sport?: 'volleyball' | 'cross' | 'trx'; today?: boolean; flex?: boolean; date?: string; oneOff?: boolean }
export type FuelKind = 'wake' | 'meal' | 'midday' | 'snack' | 'preworkout' | 'workout' | 'sport' | 'evening'
export interface SlotItem { type: 'supplement'; refId: string; label: string; done: boolean; primary?: boolean; note?: string }
export interface FuelSlot {
  time: string
  kind: FuelKind
  label: string
  slotKey?: MealSlot // meal/snack window identity (mezo-53su); absent on block/protocol slots
  state: 'done' | 'now' | 'pending' | 'missed'
  mealName?: string
  mezoNote?: string
  windowTip?: string
  kcal?: number; p?: number; c?: number; f?: number
  duration?: number
  items?: SlotItem[]
  mealId?: string
  suggestedRecipeId?: string
}
export interface FuelPlanToday {
  workout: { type: string; start: string; end: string; duration: number }
  volleyball: { start: string; end: string; noneToday: boolean }
  bedtime: string; kitchenClose: string; caffeineCutoff: string
  energy: { base: number; activity: number; balance: number; target: number } // dynamic-energy breakdown (mezo-1oy5)
  slots: FuelSlot[]
}
/** Fuel-owned planner settings (mezo-53su) — eating cadence + caffeine cutoff, per-user singleton. */
export interface FuelSettings {
  mealsPerDay: number
  caffeineCutoff: string
}
/** Diet preferences (Diet Plan slice 1) — macro split + protein tier + water/fiber, per-user singleton. */
export interface DietSettings {
  splitPreset: 'balanced' | 'low_fat' | 'low_carb' | 'high_carb' | 'custom'
  proteinPctX10: number | null
  carbsPctX10: number | null
  fatPctX10: number | null
  proteinTier: 'moderate' | 'high'
  waterMl: number
  fiberG: number
  dayTypeShiftKcal: number
}
/** Mezo-kalauz seen-store (mezo-gb1s): one record per guide id, the whole map is the per-user singleton. */
export interface TutorialProgressEntry {
  version: number
  seenAt: string
  completedAt: string | null
  dismissedAtStep: number | null
}
export type TutorialProgress = Record<string, TutorialProgressEntry>
/** Meal-slot templates (mezo-7102) — per-day-type anchor plan the planner replays onto a real day. */
export type SlotTemplateDayType = 'rest' | 'training_am' | 'training_pm'
export type SlotAnchor =
  | { type: 'fixed'; time: string }
  | { type: 'wake' | 'training_start' | 'training_end' | 'bed'; offsetMin: number }
export interface SlotTemplateRow {
  label: string
  slotKind: MealSlot        // 'breakfast' | 'lunch' | 'dinner' | 'snack' (types.ts:68)
  role: RecipeRole          // 'standard' | 'pre_workout' | 'post_workout' (types.ts:281)
  anchor: SlotAnchor
  budgetPct: number
}
export interface SlotTemplate {
  dayType: SlotTemplateDayType
  slots: SlotTemplateRow[]
}
export interface MacroSet { kcal: number; p: number; c: number; f: number; water: number }
export type ToolType = 'read' | 'compute' | 'write'
export interface MealDimensionBase { id: 'macro' | 'micro' | 'nova' | 'context' | 'who' | 'fat_quality' | 'plant_diversity' | 'energy_density' | 'portion'; label: string; weight: number; score: number; color: string; detail: string; note?: string | null }
export interface MacroDimension extends MealDimensionBase { id: 'macro'; macroRatio: { p: number; c: number; f: number }; macroTargets: { p: string; c: string; f: string }; kcalShareOfDay: number; notes?: string }
export type MicroStatus = 'good' | 'ok' | 'low'
export interface MicroDimension extends MealDimensionBase { id: 'micro'; micros: { name: string; value: string; pct: number; status: MicroStatus }[] }
export interface NovaDimension extends MealDimensionBase { id: 'nova'; nova: { dominant: NovaGroup; stack: { nova: NovaGroup; pct: number; label: string }[]; items: { name: string; nova: NovaGroup; warning?: boolean }[] } }
export interface ContextDimension extends MealDimensionBase { id: 'context'; context: { label: string; value: string }[] }
/** Generic label/value-row dimensions (mezo-7797): WHO, zsírminőség, növényi diverzitás, energia-sűrűség, adag-arány. Same payload shape as ContextDimension. */
export interface RowsDimension extends MealDimensionBase { id: 'who' | 'fat_quality' | 'plant_diversity' | 'energy_density' | 'portion'; context: { label: string; value: string }[] }
/** A degraded dimension (weight 0 — zero input coverage on the backend, mezo-jcpt.1): base
 *  fields only, no per-kind payload to render a panel from. Kept (not dropped) so ScoreLedger
 *  can name it in its "Nincs adat" line; DimensionCard renders it with no panel (Task 6 owns
 *  the eventual "ghost tile" treatment). Distinguished from its live siblings structurally
 *  (the `'macroRatio' in dim` / `'micros' in dim` / `'nova' in dim` / `'context' in dim` guards
 *  in DimensionCard), not by `id`, since a degraded dim shares its `id` with its live sibling. */
export interface DegradedDimension extends MealDimensionBase {}
export type MealDimension = MacroDimension | MicroDimension | NovaDimension | ContextDimension | RowsDimension | DegradedDimension
export interface MealBreakdown {
  confidence: number
  summary: string | null // deterministic v0 ships null — filled by the coach (mezo-mr4n)
  tagline: string | null // card-sized cut, same prose layer; null until the coach ran
  dimensions: MealDimension[]
  improve: { text: string; impact: string }[]
  tools: { type: ToolType; name: string }[]
}
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealItemSource = 'recipe' | 'pantry' | 'estimate'
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
  nutrients?: Nutrients // this line's nutrition-quality facts (mezo-m6uv), frozen like contribution
  nova?: number // 1..4, carried for the future NOVA score dimension
}
export interface FuelMeal {
  id: string; slot: string; title: string; score: number | null
  kcal: number; p: number; c: number; f: number
  /** Rost-bővítés (mezo-c9t5, frontend-only) — absent/null on meals the wire doesn't carry fiber
   *  for yet; keretHero.ts's rost-összegzés treats a missing value as 0, never fabricates one. */
  fiberG?: number | null
  /** Whole-meal nutrition-quality facts (mezo-m6uv), null-preserving Σ of the item lines. */
  nutrients?: Nutrients
  mealItems: MealItemLine[] // structured lines (real once logged)
  items: string[] // legacy free-text labels — kept for the mock score-sheet seeds
  tags: string[]
  loggedAt: string; mealDate: string // real instant + denormalized day key
  recipeId?: string
  breakdown?: MealBreakdown
}
/** One recipe ingredient logged at a different amount (mezo-ormb). `lineOrder` is the recipe's
 *  ingredient array index; `pantryItemId` is the server-side consistency check, not the key.
 *  `amount` 0 means the line was left out. */
export interface MealIngredientOverrideInput { lineOrder: number; pantryItemId: string; amount: number }
/** Editor line for a recipe/pantry ref — maps to MealItemRequest (refId → recipeId|pantryItemId by source). */
export interface MealRefInputItem {
  source: 'recipe' | 'pantry'
  refId: string
  amount: number
  unit: string
  /** recipe arm only — absent means "the recipe as written" */
  ingredientOverrides?: MealIngredientOverrideInput[]
}
/** Editor line for a free-form AI/user estimate — no seed ref; carries its own per-basis macro snapshot. */
export interface MealEstimateInputItem {
  source: 'estimate'
  name: string
  amount: number
  unit: string
  per: number
  basisUnit: string
  kcal: number; proteinG: number; carbsG: number; fatG: number
  nova?: number | null
}
/** Editor line — discriminated on source: a recipe/pantry ref, or a free-form estimate. */
export type MealItemInput = MealRefInputItem | MealEstimateInputItem
/** How a logged meal originated — the provenance envelope round-tripped via MealRequest.provenance. */
export interface MealProvenanceInput {
  origin: 'manual' | 'ai-text' | 'ai-photo'
  model?: string | null
  confidence?: number | null
  rawText?: string | null
}
/** Capture-sheet save payload — maps to the MealRequest contract. */
export interface MealInput {
  slot: MealSlot
  loggedAt?: string | null
  title?: string | null
  items: MealItemInput[]
  provenance?: MealProvenanceInput
}
/** One line of an AI meal draft (POST /api/meal/ai-draft) — a resolved pantry/recipe match or a
 *  free-form estimate, each carrying a per-basis macro snapshot + confidence/needsReview. Mirrors
 *  MealAiDraftItem; the user confirms/edits these before they become MealInput items. */
export interface MealAiDraftLine {
  source: MealItemSource
  pantryItemId: string | null
  recipeId: string | null
  name: string
  amount: number
  unit: string
  per: number
  basisUnit: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  nova: number | null
  confidence: number
  needsReview: boolean
}
/** AI-parsed meal draft — a proposed slot + lines the user confirms before logging. Nothing is
 *  persisted until confirmed. Mirrors the MealAiDraftResponse contract. */
export interface MealAiDraft {
  slot: MealSlot
  title: string | null
  note: string | null
  items: MealAiDraftLine[]
}
export interface Micronutrient { name: string; pct: number; target: string }
export interface FuelSummary { name: string; when: string; state: 'done' | 'pending'; dose: string }
export interface FuelDay {
  targets: MacroSet; consumed: MacroSet
  meals: FuelMeal[]
  pacing: { msg: string }
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
// --- Fuel · Stack occurrences (living protocol, mezo-vx9v) — mirrors ProtocolItemResponse ---
/** Daily intake zone — the wire contract (StackZone entity keys). Never rename these strings. */
export type StackZoneKey = 'wake' | 'breakfast' | 'pre_workout' | 'post_workout' | 'lunch' | 'dinner' | 'evening' | 'bedtime'
export type StackPlacementSource = 'rule' | 'llm' | 'user' | 'fallback'
/** One item's occurrence in a zone — a protocol can carry the same pantryItemId in several zones. */
export interface ProtocolOccurrence {
  id: string; pantryItemId: string; slotKey: StackZoneKey
  dose: string | null; pinned: boolean
  placementSource: StackPlacementSource; placementReason: string | null
  restDayFallback: StackZoneKey | 'skip' | null; dailyTotalHint: string | null
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
  cycleDay: number; phaseKey: string; phaseLabel: string
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

export interface TodayMeta { dayLabel: string; dateLabel: string; workoutType: string; workoutTime: string; mesoPhase: string }
/** The workout teaser's prediction line — demo copy in mock mode; real predictions are a later epic (null hides the row). */
export interface WorkoutPrediction { confidence: number; label: string }
/** One cell of the Today quick-stats row ("Most"). */
export interface QuickStatItem { label: string; value: string; unit: string }
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
export interface TodayScenario {
  dayState: DayState; medCycleDay: number; niggle: boolean; vulnerable: boolean; anchorMode: boolean
  /** `?ritual=` demo override (mezo-ilsj) — wins over RitualCard's derived waiting/open/done state. */
  ritual: 'waiting' | 'open' | 'done' | null
}

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
  nutrients?: Nutrients // this line's nutrition-quality facts (mezo-m6uv), frozen like contribution
}
/** Template meal role (mezo-uavr) — selects the scoring rubric overlay on the recipe surface. */
export type RecipeRole = 'standard' | 'pre_workout' | 'post_workout'
/** Nutrition-quality facts, frozen per line like the macros (mezo-m6uv). `null` = the source
 *  carried no value — NOT zero; a rollup field is null only when every line was null. Grams. */
export interface Nutrients {
  fiberG: number | null
  sugarG: number | null
  saltG: number | null
  saturatedFatG: number | null
}
export interface Recipe {
  id: string; name: string; slot: string; category: RecipeCategory
  createdDate: string; timesLogged: number; avgScore: number; lastLogged: string
  servings: number; prepMins: number; cookMins: number; tags: string[]
  ingredients: RecipeIngredientLine[]
  macros: { kcal: number; p: number; c: number; f: number }
  nutrients?: Nutrients
  novaDominant: NovaGroup
  mezoFit: { score: number | null; fitsFor: string[] }
  starred: boolean
  role: RecipeRole
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
  role: RecipeRole
  ingredients: { pantryItemId: string; amount: number; unit: string; note?: string | null }[]
}

// --- Recept-műhely (AI recipe workshop, mezo-92pb) — mirrors WorkshopTurnRequest/Response ---
/** The chat-picked nutrition goal steering the workshop's suggestions; also selects the save role. */
export type WorkshopGoal = 'high_protein' | 'pre_workout' | 'post_workout' | 'before_bed' | 'breakfast'
/** One draft ingredient line — a resolved pantry ref (macros come from the live pantry row, never
 *  carried on the wire) or a free-form AI/user estimate (`est` = totals for THIS line's current
 *  amount, not a per-basis rate). Mirrors WorkshopDraftLine. */
export interface WorkshopLine {
  source: 'pantry' | 'estimate'
  refId: string | null
  name: string
  amount: number
  unit: string
  est?: { kcal: number; p: number; c: number; f: number }
}
/** The AI-authored recipe-in-progress the workshop chat edits turn by turn. Mirrors WorkshopDraft. */
export interface WorkshopDraft {
  name: string
  category: RecipeCategory
  servings: number
  steps: string[]
  lines: WorkshopLine[]
}
/** One workshop turn's result — the assistant's reply text + the updated draft. Mirrors WorkshopTurnResponse. */
export interface WorkshopTurn {
  reply: string
  draft: WorkshopDraft
}

export interface PantryImport { id: string; source: PantrySourceKey; when: string; items: number; status: 'synced' | 'manual-review'; ofWhat: string }
export interface PantrySuggestion { name: string; source: PantrySourceKey; price: string; reason: string }

// Originated as one OpenFoodFacts lookup hit (Fuel P6, mezo-bka); the OFF lookup mode itself
// was retired from the FE (`mezo-ymt4`, 2026-09-02), but this type is KEPT as the shared base
// shape both PantryScrapeDraft and PantryImportInput extend — not dead code.
export interface PantryLookupItem {
  name: string
  brand?: string | null
  barcode?: string | null
  per: number
  unit: string
  kcal?: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  fiberG?: number | null
  sugarG?: number | null
  saltG?: number | null
  saturatedFatG?: number | null
  nova?: NovaGroup | null
}
// One URL-scrape hit (Fuel P8, mezo-8vum) — a lookup draft enriched with category,
// price, and the scrape provenance (source/url/confidence). Nothing is persisted until
// the user confirms via importItem; needsReview flags a low-confidence extraction.
export interface PantryScrapeDraft extends PantryLookupItem {
  category: string | null
  priceHuf: number | null
  priceUnit: string | null
  source: PantrySourceKey
  sourceUrl: string | null
  confidence: number
  needsReview: boolean
}
// The confirmed import draft (name/category user-editable) → POST /api/pantry-import.
// Scrape provenance (mezo-8vum) rides along when the draft came from a URL scrape.
export interface PantryImportInput extends PantryLookupItem {
  category?: string | null
  sourceUrl?: string | null
  confidence?: number | null
  origin?: 'photo' | null // mezo-d8tr: photo-draft confirms carry the provenance marker (no URL)
  priceHuf?: number | null
  priceUnit?: string | null
}

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
// that read flattened weights/identity (WeightPage, FuelStackPage's linked plans,
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
  // Day-planner settings (Fuel P5) — the eating-occasion count + wake/bed anchors
  // the fuel timeline plans around. Null until the goal carries them; the edit UI
  // defaults to 4 / '06:00' / '23:00'. Round-trips via GoalUpsertRequest (the
  // request contract = the "GoalInput" — already carries these generated fields).
  mealsPerDay: number | null
  wakeTime: string | null
  bedTime: string | null
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
/** Quantised stage sequence from a tracker screenshot (mezo-fk9a) — one letter per
 *  `bucketMin` minutes from `bedtime`: D=mély, L=könnyű, R=REM, A=éber. DISPLAY-ONLY:
 *  never the source of a phase ratio (ADR 0015). */
export interface Hypnogram {
  bucketMin: number
  stages: string
}
export interface SleepEntry {
  date: string
  bedtime: string
  wakeup: string
  duration: number
  quality: number
  awakenings: number
  mealToSleep: number
  notes: string | null
  // Tracker-grade enrichment (mezo-dbsr) — null/absent on plain manual rows
  inBedMin?: number | null
  awakeMin?: number | null
  lightMin?: number | null
  remMin?: number | null
  deepMin?: number | null
  sourceQualityPct?: number | null
  source?: 'manual' | 'screenshot' | null
  hypnogram?: Hypnogram | null
}
/** Phase 2 REST DTO — POST /sleep-log. `durationH` is computed in the sheet from bedtime+wakeup. */
export interface SleepLogInput {
  date: string; bedtime: string; wakeup: string
  durationH: number; quality: number; awakenings: number; note?: string
  inBedMin?: number
  // Screenshot-confirm enrichment (mezo-66ab) — all optional so manual callers are unchanged.
  source?: 'manual' | 'screenshot'
  sourceQualityPct?: number
  awakeMin?: number; lightMin?: number; remMin?: number; deepMin?: number
  hypnogram?: Hypnogram
}

/** LLM-vision extraction from a Sleep Cycle screenshot (mezo-66ab) — a draft, never persisted as-is. */
export interface SleepShotDraft {
  bedtime: string | null
  wakeup: string | null
  durationH: number | null
  inBedMin: number | null
  awakeMin: number | null
  lightMin: number | null
  remMin: number | null
  deepMin: number | null
  sourceQualityPct: number | null
  hypnogram: Hypnogram | null
  /** Deterministic consistency score 0..1 (backend validator, never the LLM). */
  confidence: number
  needsReview: boolean
}

/** The sleep goal — target asleep-duration + one fixed end; the other end is derived (spec D1/D4). */
export interface SleepGoal {
  targetMinutes: number
  anchor: 'WAKE' | 'BED'
  anchorTime: string
  /** Derived (or equal to anchorTime) — HH:mm; the day-anchor consumers read these two. */
  wakeTime: string
  bedTime: string
  regularityBandMin: number
}

/** PUT /api/sleep/goal payload — wake/bed are always server-derived, never sent. */
export type SleepGoalInput = Omit<SleepGoal, 'wakeTime' | 'bedTime'>
// --- Emberek (people) ---
export type Affect = 'positive' | 'neutral' | 'mixed' | 'negative'
export type Relationship = 'partner' | 'friend' | 'family' | 'colleague' | 'teammate' | 'mentee'
export type PersonStatus = 'candidate' | 'active' | 'archived'
export type PersonSourceKind = 'manual' | 'extractor' | 'seed'
export type MentionSource = 'voice' | 'camera' | 'chip' | 'text' | 'chat'
export type MentionContext =
  | 'munka' | 'csalad' | 'baratok' | 'edzes'
  | 'konfliktus' | 'kozos_program' | 'segitseg' | 'egyeb'
export interface PersonGraphEdge {
  nodeKind: string
  title: string
  relationHu: string
  strength: string
}
export interface PersonEntry {
  id: string
  name: string
  initial: string
  relationship: Relationship
  relationshipHu: string
  aliases: string[]
  status: PersonStatus
  sourceKind: PersonSourceKind
  affect_baseline: Affect
  mentionCount: number
  mentionsThisWeek: number
  last_mentioned_at: string
  lastMentionLabel: string
  contactCadenceLabel: string
  notes: string
  affectTrend: number[]
  /** A hangulat-ív első olvasatának hete (ISO dátum), vagy null, ha nincs olvasat. */
  affectTrendStart: string | null
  direction: 'up' | 'down' | 'flat'
  directionReason: string | null
  knownFacts: string[]
  ties: string[]
  graphEdges: PersonGraphEdge[]
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
  tone?: Affect
  tiedTo?: { kind: string; label: string }
  flagged?: boolean
  intensity?: number
  contextLabel?: MentionContext
  sourceRefKind?: string
}
/** Phase 2 REST DTO — POST /mentions. Hook enriches id/ts/labels/personName/source server-side in Phase 2. */
export interface MentionLogInput {
  personId: string
  tone: Affect
  text?: string
  contextLabel?: MentionContext
}
/** Create/edit save payload — no `id` = create, `id` present = update. Maps to
 *  CreatePersonRequest/UpdatePersonRequest (both share this shape on the wire). */
export interface PersonSaveInput {
  id?: string
  name: string
  aliases: string[]
  relationship: Relationship
  relationshipHu: string
  affectBaseline?: Affect
  contactCadenceLabel?: string
  notes?: string
}

// --- Fuel · weekly (Terv) + replan + gym schedule ---
export type MedCyclePhase = 'Peak' | 'Stable' | 'Trough'
export interface MedCycleDayCell { d: number; label: MedCyclePhase; color: string }
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
/** Terv weekly stats card. Real mode derives kcal/protein from the 7-day rollup
 *  (`GET /api/fuel/week/{start}`); `supplementsAdherence` is null until planned-vs-taken
 *  semantics exist (Fuel P8) — the card renders an honest `—`. */
export interface WeeklyStats {
  kcalTarget: number
  kcalAvgFactor: number
  proteinHitDays: number
  supplementsAdherence: number | null
}
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
// --- Tudás (knowledge) ---
// V1.2: unified on the backend taxonomy (knowledge_fact.category CHECK constraint)
export type FactCategory = 'train' | 'fuel' | 'health' | 'life'
/** A knowledge_fact source oszlopa a dróton — chat-kivonat / minta-promóció / kézi felvétel. */
export type FactSource = 'chat' | 'pattern' | 'manual'

export interface MemoryPatternCount { kind: string; status: string; count: number }
export interface MemoryFactSourceCount { source: FactSource; count: number }
export interface MemoryEmbeddingKindCount { kind: string; count: number }

/** A memória-obszervatórium áttekintés (mezo-al1i) — L0→L3 réteg-számok + cron-ütemezés. */
export interface MemoryOverview {
  l0: { daysWithAnyData: number; windowDays: number }
  l1: {
    summaryCount: number
    firstDate: string | null
    lastDate: string | null
    embeddings: MemoryEmbeddingKindCount[]
  }
  l2: { patterns: MemoryPatternCount[]; pendingFactCandidates: number }
  l3: { facts: MemoryFactSourceCount[]; totalReinforcements: number; factsInPrompt: number }
  jobs: {
    summaryCron: string
    patternCron: string
    hypothesisCron: string
    lastSummaryDate: string | null
    lastDetectedAt: string | null
  }
}

export interface MemorySummaryItem { date: string; narrative: string; embedded: boolean }

/** Egy hasonló-nap találat — MINDKÉT pontszám kimegy (similarity × exp(-age/τ) mechanika). */
export interface SimilarDay { date: string; excerpt: string; similarity: number; finalScore: number }

export interface LlmUsageDay {
  date: string
  calls: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export interface MemoryLlmUsage {
  enabled: boolean
  perDay: LlmUsageDay[]
  totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number | null }
}

export interface KnowledgeFact {
  id: string
  text: string
  category: FactCategory
  active: boolean
  reinforced: number
  /** V3.3 evidence link — the promoting pattern's title on source=pattern facts. */
  patternTitle?: string
  /** A tény eredete — az Audit nézet provenancia-chipje (a wire-ön V1.1 óta ott van). */
  source: FactSource
  /** Az utolsó megerősítés időpontja (ISO), null ha még sosem erősítették meg újra. */
  lastReinforcedAt: string | null
  /** A tény létrejötte (ISO instant) — a prompt-rangsor másodlagos kulcsa (reinforced DESC, createdAt DESC). */
  createdAt: string
}
/** A pending extraction candidate awaiting the explicit L2 decision (accept/refine/reject). */
export interface FactCandidate {
  id: string
  text: string
  category: FactCategory
  /** FE-only in this slice (mezo-ms9a): the existing fact id this candidate contradicts, or
   *  `null` when it doesn't conflict with anything. Real mode always maps to `null` — the wire
   *  doesn't carry this yet. */
  conflictsWithFactId: string | null
}
export type FactDecision = 'accept' | 'reject' | 'refine'
export interface KnowledgeEdge { from: string; to: string; type: 'reinforces' | 'context' | 'causes' }

/** W2.3 (mezo-b3pp.8): egy éjszakai kivonatoló által javasolt életesemény-jelölt (L2 inbox). */
export interface LifeEventCandidate {
  id: string
  /** W5.3 (mezo-b3pp.20): a jelölt fajtája — az éjszakai kiszűrő életeseményt, a negyedéves
   *  mélyfutam szezont javasol. Ugyanaz az L2 inbox hordozza mindkettőt, de a copy nem közös. */
  kind: 'LIFE_EVENT' | 'SEASON'
  title: string
  summary: string | null
  /** ISO date, kind-függő jelentéssel: LIFE_EVENT esetén a nap, amiről az esemény szól; SEASON
   *  esetén a lefedett negyedév ELSŐ napja (nem egy konkrét nap) — a kártya ez utóbbit
   *  negyedévként jeleníti meg, ld. `formatCandidateDate` a `data/insights/graph`-ban. */
  occurredOn: string | null
  /** Hány kapcsolat jönne létre, ha elfogadod. */
  proposedEdgeCount: number
}

export type LifeEventDecision = 'accept' | 'reject'

export type GraphNodeKind = 'PATTERN' | 'PREFERENCE' | 'GOAL' | 'LIFE_EVENT' | 'SEASON' | 'INSIGHT' | 'PERSON'

/** W2.6 (mezo-b3pp.11): one active knowledge-graph node for the Tudástár "Kapcsolatok" section —
 *  `topEdges` are pre-rendered Hungarian lines from the backend `GraphEdgeLineRenderer`, the same
 *  renderer the `[Összefüggések]` prompt block uses, so the UI and the model never disagree on
 *  phrasing. */
export interface KnowledgeGraphNode {
  id: string
  kind: GraphNodeKind
  title: string
  summary: string | null
  topEdges: string[]
  /** W4.3 (mezo-b3pp.17): `'profile'` marks the singleton pragmatic-profile node, which the
   *  Tudástár renders in its own section instead of the kind groups. */
  sourceKind: string | null
  /** ISO date-time (mezo-ms9a): `useKnowledgeGraphNodes()` sorts DESC by this. */
  updatedAt: string
}

// --- Insights (AI-memory surface) ---
export type PatternCategory = 'physiology' | 'trigger' | 'response'
/** The decision verbs of the L2 surface (wire PatternDecisionRequest). */
export type PatternStatus = 'confirm' | 'monitor' | 'reject'
/** A pattern row's persisted judgement state (wire PatternResponse.status). */
export type PatternRowStatus = 'proposed' | 'monitoring' | 'confirmed' | 'rejected'
export interface PatternCritique {
  statistical: number
  confounders: number
  l3align: number
  actionability: number
}
export interface Pattern {
  id: string
  /** A minta stabil pár-kulcsa — a Motor↔Patterns kereszt-link horgonya (mezo-18bx). */
  pairKey: string
  category: PatternCategory
  categoryLabel: string
  /** undefined on statistical rows — honest small-n, renders as "tanulom" (V3.1). */
  confidence?: number
  title: string
  mechanism: string
  evidence: string[]
  /** V3.2 hypotheses only — statistical rows carry evidence chips instead. */
  critique?: PatternCritique
  thinking?: string
  status?: PatternRowStatus
  kind?: 'statistical' | 'ai_hypothesis'
}

export type PatternGateVerdict = 'live' | 'few_days' | 'no_data' | 'degenerate' | 'frozen'

/** A metrikák élet-domén besorolása — a Motor tab csoportosítási kulcsa (mezo-18bx). */
export type MetricDomain = 'sleep' | 'train' | 'fuel' | 'mind' | 'body' | 'other'

export interface PatternMonitorPair {
  key: string
  title: string
  category: PatternCategory
  categoryLabel: string
  lagDays: number
  metricAKey: string
  metricALabel: string
  metricBKey: string
  metricBLabel: string
  /** Miért figyeljük — a katalógus mechanism-egysorosa (mezo-18bx). */
  mechanismHu: string
  /** Kérdés-cím a Motor kártyán (mezo-fj1g). */
  questionHu: string
  /** A mechanizmus által várt korreláció-irány (mezo-fj1g). */
  expectedDirection: 'positive' | 'negative'
  /** Pozitív/negatív r emberi olvasata — {erősség} behelyettesítővel (mezo-fj1g). */
  whenPositiveHu: string
  whenNegativeHu: string
  metricADomain: MetricDomain
  /** A kimenet doménje — a Motor tab elsődleges csoportja. */
  metricBDomain: MetricDomain
  verdict: PatternGateVerdict
  alignedDays: number
  missingDays: number | null
  bottleneckMetricKey: string | null
  r: number | null
  n: number | null
  p: number | null
  status: 'confirmed' | 'rejected' | null
}

export interface PatternMetricCoverage {
  key: string
  label: string
  /** Honnan jön az adat — gyűjtő-felület vagy derivált-magyarázat (mezo-18bx). */
  sourceHu: string
  domain: MetricDomain
  coveredDays: number
  windowDays: number
  lastDayWithData: string | null
  pairCount: number
}

export interface PatternMonitor {
  windowFrom: string
  windowTo: string
  lookbackDays: number
  minN: number
  cron: string
  lastRunAt: string | null
  pairs: PatternMonitorPair[]
  metrics: PatternMetricCoverage[]
}

// --- Pattern pair detail (mezo-tk88.5) — /insights/patterns/:pairKey ---
/** Az append-only pattern_event történet sor-fajtái (mirrors the backend CHECK constraint). */
export type PatternEventKind = 'snapshot' | 'confirmed' | 'monitoring' | 'rejected' | 'reinforced' | 'promoted'
export interface PatternEvent {
  kind: PatternEventKind
  occurredAt: string          // ISO datetime
  r?: number; n?: number; p?: number
  reinforcementCount?: number
  factId?: string
}
/** Egy illesztett nap a szórásdiagramhoz — élőben számolva, sosem tárolt. */
export interface AlignedDay { date: string; a: number; b: number }
/** Egy hatás-hivatkozás (tény/előrejelzés/kísérlet/kihívás) — a saját felületére vezet. */
export interface PatternImpactRef { id: string; title: string; status: string }
export interface PatternImpact {
  fact: { id: string; text: string; reinforcementCount: number; includeInPrompt: boolean } | null
  predictions: PatternImpactRef[]
  experiments: PatternImpactRef[]
  challenges: PatternImpactRef[]
}
/** A pár-részletező nézet teljes payloadja — mirrors PatternPairDetailResponse. */
export interface PatternPairDetail {
  pair: PatternMonitorPair
  pattern: Pattern | null
  events: PatternEvent[]
  days: AlignedDay[]
  impact: PatternImpact
}

export interface MemoirAnchor { kind: string; label: string }
export interface Memoir {
  /** The memoir row id — the W4.1 feedback artifactId (`memoir`, mezo-b3pp.15). */
  id: string
  week: string
  title: string
  body: string
  anchors: MemoirAnchor[]
}
/** F7.5 (mezo-d20.8.5): one archive-shelf entry — weekStart drives grouping + the chapter route. */
export interface MemoirEntry extends Memoir {
  weekStart: string
}

export type PredictionStatus = 'pending' | 'validated' | 'missed'
export interface Prediction {
  id: string
  title: string
  /** null = the engine is still learning („tanulom") — never a fabricated number (proactive P1). */
  confidence: number | null
  status: PredictionStatus
  date: string
  basis?: string
  actual?: string
}

export type ExperimentStatus = 'proposed' | 'active' | 'completed' | 'dismissed'
export interface Experiment {
  id: string
  title: string
  status: ExperimentStatus
  day: number
  total: number
  hypothesis: string
  outcome?: string
  /** true/false once evaluated; undefined = proposed/active, or completed-but-inconclusive (proactive P2). */
  outcomeGood?: boolean
}

export type DiagnosisConfidence = 'strong' | 'moderate' | 'weak'

/** One code-collected evidence candidate, FROZEN at generation time (mezo-hqfi).
 *  `kind` decides which fields carry: metric rows have the numbers, pattern/fact rows do not. */
export interface DiagnosisEvidence {
  kind: 'metric' | 'pattern' | 'fact'
  label: string
  detail?: string
  /** Hungarian provenance — „Alvás-napló", „Minták", „Tudástár". Shown to the user. */
  sourceHu?: string
  metricKey?: string
  value?: number
  baselineValue?: number
  delta?: number
  coverageDays?: number
}

/** One ranked suspect. `evidenceIndexes` point INTO the parent's `evidence` — the model
 *  selected them, it could not invent them. The probe fields map 1:1 onto an Experiment. */
export interface DiagnosisSuspect {
  rank: number
  title: string
  claim: string
  evidenceIndexes: number[]
  strength: DiagnosisConfidence
  probeText: string
  metricKey: string
  expectedDirection: 'up' | 'down' | 'stable'
  totalDays: number
}

export interface Diagnosis {
  id: string
  phenomenon: string
  windowDays: number
  verdict: string
  confidence: DiagnosisConfidence
  evidence: DiagnosisEvidence[]
  suspects: DiagnosisSuspect[]
  generatedAt: string
  /** A log landed inside the window after generatedAt — the „↻ Frissítsd" hint. */
  stale: boolean
}

export type ChatRole = 'user' | 'assistant'
/** `label` (mezo-b3pp.33): the wire's optional carried label — null on rows that omit it,
 *  undefined for producers that never set it. `chatRefDisplay` prefers it and falls back to
 *  the id-derived label (see chatRefs.ts). */
export interface ChatRef { kind: string; id: string; label?: string | null }
/** W3.1b (mezo-b3pp.28): one memory ambient recall injected into the answer's prompt —
 *  `similarity` is the raw cosine 0..1 (the row renders `Math.round(s * 100)%`). */
export interface ChatRecalledMemory {
  occurredOn: string
  kind: string
  label: string
  gist: string
  similarity: number
}
export interface ChatMessage {
  /**
   * The persisted `ai_message` row id — the W4.1 feedback artifactId (`chat_message`,
   * mezo-b3pp.15). Absent while a turn is still streaming, which is exactly when there is
   * nothing to vote on yet (and on the optimistic user bubble, which is never votable).
   */
  id?: string
  role: ChatRole
  ts: string
  text: string
  tools?: Tool[]
  refs?: ChatRef[]
  /** V1.3: answer failed the backend self-check even after retry — render flagged. */
  degraded?: boolean
  /** W3.1b: what ambient recall put in front of the model before this answer (undefined = none). */
  recalled?: ChatRecalledMemory[]
}

// --- Train (mesocycles, workouts, sport) ---
// NOTE (port fix): `NiggleWarning` and `GymScheduleDay` already exist above (Today/Fuel
// slices) with the exact shape Train needs — reused here rather than re-declared.
// The plan's logged-set variant is named `LoggedWorkoutExercise` (has `lastWeek`;
// the now-retired Phase-1 Today `WorkoutExercise` duplicate did not), and the plan's
// "WorkoutPlan" is kept verbatim. The existing `VolleyballSession` gained an additive
// optional `flex?` field (present on the Szo fixture in data.js) so it can be reused
// for the sport schedule too.
export type MesoPhase = 'MEV' | 'MAV' | 'MRV' | 'Deload'
export type MesoStatus = 'active' | 'planned' | 'archived'
export type ExerciseKind = 'compound' | 'isolation' | 'plyo'

export interface PrescribedSet {
  kind: 'warmup' | 'working'
  targetWeightKg: number | null
  targetReps: number
  targetRIR: number | null
}
export interface GymExercise {
  id: string
  name: string
  muscle: string
  warmupSets: number
  workingSets: number
  repMin: number
  repMax: number
  targetRIR: number
  anchorWeightKg?: number | null
  type: ExerciseKind
  warning?: string
  catalogId?: string  // exercise_catalog row when picked from the API catalog (real mode)
  countsTowardVolume?: boolean  // false = posture/plyo work, outside the hypertrophy budget (mezo-gbo7)
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
export interface CustomWorkout {
  id: string
  name: string
  exercises: GymExercise[]
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

// Whole-mesocycle volume arc (Phase B, Task B3): per-muscle planned scaffold (DA7) laid
// alongside logged actuals, week-by-week — future weeks carry `actual: null`.
export interface VolumeArcWeek {
  week: number
  phase: MesoPhase
  planned: number
  actual: number | null // null for future weeks with no logged data yet
  isCurrent: boolean
}
export interface MuscleVolumeArc {
  muscle: string  // coarse volume-group key (chest/back/shoulder/biceps/triceps/quad/ham/glute/calf/core)
  region: string  // color-family region key (coral/sky/lav/rose/sage/amber)
  mrv: number
  weeks: VolumeArcWeek[]
}
export interface MesoVolumeArc {
  mesocycleId: string
  title: string
  currentWeek: number
  weeks: number
  startDate: string
  endDate: string
  status: MesoStatus
  phaseCurve: MesoPhase[]
  muscles: MuscleVolumeArc[]
}

// Per-coarse-muscle priority tier (mezo-3m5m, spec GD4): picks which volume landmark is
// "100%" for the weekly ramp — emphasize -> MRV, grow (default/absent key) -> MAV,
// maintain -> MEV (flat, no ramp). Mirrors the backend's PriorityTier enum.
export type MuscleTier = 'emphasize' | 'grow' | 'maintain'
// Sparse per-coarse-muscle map (absent key = grow); null/empty = all grow.
export type MusclePriorities = Record<string, MuscleTier>

export interface Mesocycle {
  id: string
  status: MesoStatus
  title: string
  shortTitle: string
  goal: string
  goalPreset?: string | null
  musclePriorities?: MusclePriorities | null
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
  templateId?: string | null // the originating template this run was started from (null for legacy/direct runs)
  closedAt?: string | null   // when this run was closed (archived); null while active/planned
  hasReport?: boolean        // true once an end-of-mesocycle report exists (mezo-meyc.4 — drives the Történet card's „riport" / „nincs riport" chip; absent on a live run)
}

// A reusable mesocycle blueprint (mezo-meyc): the wizard now saves a template first, then
// starts a run from it (POST .../start) — the run carries the template's `id` as its
// `templateId` and a closed run can `rerun` from the same template. `runCount` is the number
// of runs ever started from this template (server-computed, read-only).
export interface MesoTemplate {
  id: string
  title: string
  shortTitle: string | null
  goal: string | null
  goalPreset?: string | null
  musclePriorities?: MusclePriorities | null
  weeks: number
  split: string | null
  style: string | null
  phaseCurve: MesoPhase[]
  notes: string | null
  volumePerMuscle: Record<string, VolumeBaseline> | null
  days: MesoDay[]
  runCount: number
}

export interface LastWeekSet { weight: number; reps: number; rir: number }
export interface ProgressionSignal {
  lever: 'weight' | 'rep' | 'hold' | 'deload'
  deltaKg: number | null
  deltaReps: number | null
  targetWeightKg: number | null
  targetReps: number
  rationale: string
}
export interface OverloadSummary { weightUp: number; repUp: number; hold: number }
export interface LoggedWorkoutExercise {
  id: string
  name: string
  warmupSets: number
  workingSets: number
  repMin: number
  repMax: number
  targetRIR: number
  anchorWeightKg: number | null
  type: ExerciseKind
  muscle: string
  sets: number // derived total (warmupSets + workingSets) — drives workoutState set count
  prescribedSets: PrescribedSet[] | null
  rationale: string | null
  progression?: ProgressionSignal | null
  lastWeek: LastWeekSet | null // null on the first-ever workout (no previous completed instance)
  note?: string | null // durable per-exercise note (F4); absent in Phase-1 statics
  videoUrl?: string | null // demo video (catalog-resolved); absent in Phase-1 statics
  // Demo stills (catalog-resolved, mezo-8xdl). imageStartUrl is the presence flag.
  imageStartUrl?: string | null
  imageEndUrl?: string | null
}
export interface ChallengeRef { kind: string; label: string }
export type ChallengeType = 'PR' | 'Depth' | 'Volume' | 'Tempo' | 'overload'
export type ChallengeStatus = 'proposed' | 'accepted' | 'dismissed' | 'hit' | 'miss' | 'inconclusive'
export interface Challenge {
  id: string
  type: ChallengeType
  typeLabel: string
  exerciseId: string
  exercise?: string
  target: string
  confidence?: number | null   // null → "tanulom"
  risk: 'low' | 'mid'
  why: string
  refs: ChallengeRef[]
  tools?: Tool[]               // mock-only; absent in live
  glory: string
  status?: ChallengeStatus     // absent in the Phase-1 mock seed (treated as proposed)
  outcome?: string
  outcomeGood?: boolean
  // Structured targets (live wire; mock seed may omit) — feed the pre-finish outcome preview.
  targetWeightKg?: number | null
  targetReps?: number | null
  targetSets?: number | null
  targetRir?: number | null
}
export interface WorkoutPlan {
  title: string
  tag: string
  durationEst: number
  exercises: LoggedWorkoutExercise[]
  niggleWarning?: NiggleWarning
  challenges: Challenge[]
  overloadSummary?: OverloadSummary | null
}

export interface GymSchedule { weeklyTimes: GymScheduleDay[] }

export interface SportSchedule {
  volleyball: { team: string; sessions: VolleyballSession[]; season: string; weeklyHours: number }
}
export interface SportSession {
  id: string; sport: string; date: string
  isoDate: string // ISO day — the raw wire date; `date` is the HU display string
  time: string; duration: number
  setsPlayed: number | null; rounds: number | null; intensity: number | null; rpe: number; shoulderStrain: number | null
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
  videoUrl?: string | null  // YouTube demo URL; null/absent when no demo is set
  // Demo stills, start + end position (mezo-8xdl). imageStartUrl is the presence flag:
  // absent means the exercise has no image at all (37 of the 161 master rows, ADR 0020).
  imageStartUrl?: string | null
  imageEndUrl?: string | null
  // Multi-user catalog (mezo-qw37.5) — all four are SERVER-derived for the current viewer;
  // the FE never reasons about roles. Absent on the Phase-1 static seed (mock mode).
  editable?: boolean       // the viewer may edit/delete this row (author or OWNER; never a master row)
  mediaEditable?: boolean  // the viewer may set/clear its video/stills (OWNER only on master rows)
  authoredByMe?: boolean   // created_by == the viewer → the `Saját` stamp
  authorName?: string | null  // the author's name on user-authored rows → the `Közös · {név}` stamp
}

// ── Daily quests (gamified growth E1, mezo-df7q) ─────────────────────────────
export type QuestSlot = 'BODY' | 'FUELBIO' | 'GROWTH'
export type QuestStatus = 'offered' | 'completed' | 'expired' | 'rerolled'
export type QuestCompletionMode = 'DERIVED' | 'ACTIVITY'
export interface DailyQuest {
  id: string
  questDate: string
  slot: QuestSlot
  skillKey: string
  title: string
  why: string
  targetLabel: string
  /** QuestTargetEnvelope.metric — drives the Today smart log-CTA ('' when absent on old fixtures). */
  metric: string
  xp: number
  status: QuestStatus
  completionMode: QuestCompletionMode
  completedAt?: string | null
}

// ── Habit engine — morning & evening routine chains (mezo-d1jb) ──────────────
/** Widened from `'MORNING' | 'EVENING'` (ADR 0019, mezo-n5e9.1's admin API): a chain is now a
 *  user-editable catalog row, so `chain` carries any `chainKey` — the two seed keys or a
 *  server-generated `chain_xxxx` custom one. `habitApi.ts`'s wire cast keeps compiling as-is. */
export type HabitChain = string
export type HabitMode = 'DERIVED' | 'MANUAL'
export type HabitStatus = 'pending' | 'done' | 'missed'
export interface HabitItem {
  id?: string
  key: string
  chain: HabitChain
  position: number
  title: string
  why: string
  anchorCopy: string
  mode: HabitMode
  status: HabitStatus
  doneAt?: string | null
  xp: number
  strengthPct?: number | null
  linkUrl?: string | null
  /** Server-computed explainer for a still-pending row that cannot tick right now (e.g. an
   *  honestly out-of-window wakeup, mezo-czol) — see `logic/habitAction.ts`'s `habitHint`. */
  hint?: string | null
}
export interface HabitStrengthRow { key: string; strengthPct: number | null; done28: number; missed28: number }
export interface HabitSummary { perfectMorningDays30: number; perfectEveningDays30: number; habits: HabitStrengthRow[] }

// ── Habit admin catalog (routine editor, mezo-n5e9.2) — mirrors HabitChainAdmin/HabitDefAdmin.
// The editor's full CRUD view of the catalog (config), independent of any day's evaluation.
export type HabitDaypart = 'MORNING' | 'DAY' | 'EVENING'
export interface HabitChainInfo {
  id: string
  chainKey: string
  title: string
  daypart: HabitDaypart
  position: number
  isActive: boolean
  defs: HabitDefInfo[]
}
/** Behaviour-change framework a habit recipe was built on (mezo-3zue). Null = pre-framework def. */
export type HabitFramework = 'FOGG' | 'CLEAR'
export interface HabitDefInfo {
  id: string
  habitKey: string
  chainKey: string
  position: number
  title: string
  why: string | null
  anchorCopy: string | null
  mode: HabitMode
  metric: string
  skillKey: string
  xp: number
  linkUrl: string | null
  isActive: boolean
  framework: HabitFramework | null
  /** FOGG: habitKey of the def this recipe is stacked onto (free-text anchors use anchorCopy). */
  anchorHabitKey: string | null
  cue: string | null
  craving: string | null
  reward: string | null
  celebration: string | null
  identity: string | null
}
export interface HabitCatalog {
  chains: HabitChainInfo[]
}

/** One AI-suggested habit def (routine editor "AI javaslat", mezo-n5e9.3) — mirrors
 *  HabitSuggestion 1:1 (every field required/non-null on the wire, no domain mapping needed). */
export interface HabitSuggestion {
  title: string
  why: string
  anchorCopy: string
  skillKey: string
  xp: number
  chainKey: string
  framework: HabitFramework | null
  cue: string | null
  craving: string | null
  reward: string | null
  celebration: string | null
}

// ── Daily intention — standing creed + up to 3 daily foci + a holistic reflection (mezo-a686)
export type Reflection = 'yes' | 'partial' | 'no'
export interface IntentionFocus { id: string; focusDate: string; text: string }
export interface IntentionDay {
  date: string
  creed: string | null
  foci: IntentionFocus[]
  reflection: Reflection | null
  focusCap: number
}

// ── Daily closing ritual — sleep-anchored evening window (R3, mezo-ilsj) ────
export interface RitualWindow { opensAt: string; prepStartsAt: string; bedTime: string }
export interface RitualDay {
  date: string
  closed: boolean
  closedAt: string | null
  reflectionText: string | null // W1.2 (mezo-b3pp.2): the day's prose reflection; null when skipped
  window: RitualWindow
}

// ── Activity log (gamified growth E2, mezo-jzca) ─────────────────────────────
export type LifeSkillKey =
  | 'mindfulness' | 'mindset' | 'cooking' | 'financial'
  | 'productivity' | 'learning' | 'connection' | 'recovery'
export type ActivityCategorizedBy = 'AI' | 'USER'
export interface ActivityEntry {
  id: string
  occurredOn: string
  text: string
  skillKey: LifeSkillKey | null
  confidence: number | null
  xpAwarded: number
  durationMin?: number | null
  amountHuf?: number | null
  categorizedBy: ActivityCategorizedBy | null
  createdAt?: string
}

// ── Growth achievements (Me Growth page, mezo-rmhr) ──────────────────────────
export interface GrowthBadge {
  key: string
  icon: string
  name: string
  achieved: boolean
  current: number
  target: number
}
export interface PerkUnlock {
  perkKey: string
  name: string
  effectCopy: string
  skillKey: string
  milestoneLevel: number
  unlockedAt: string
}
export interface Achievements {
  badges: GrowthBadge[]
  perks: PerkUnlock[]
}

// ── Push notifications (N1 delivery spine, mezo-h4wp) ────────────────────────
// The browser IS the source of truth for `enabled` (a live PushSubscription on this
// device), never the server — usePushSubscription() is deliberately not a useDualQuery.
/** Why the last push action failed — a reportable code the page maps to Hungarian copy.
 *  - `vapid-missing`: the bundle was built without `VITE_VAPID_PUBLIC`, so
 *    `pushManager.subscribe()` would reject with `InvalidAccessError` on a zero-length
 *    `applicationServerKey`. A BUILD misconfiguration, not something the user can fix.
 *  - `register-failed`: the browser subscribed but the backend did not record the device —
 *    the split state where the toggle would otherwise read „engedélyezve" while every push
 *    reports `0 próbálkozás`.
 *  - `failed`: anything else (the browser refused, the service worker never became ready). */
export type PushErrorCode = 'vapid-missing' | 'register-failed' | 'failed'

export interface PushSubscriptionState {
  supported: boolean       // 'serviceWorker' in navigator && 'PushManager' in window
  standalone: boolean      // display-mode: standalone (iOS gate)
  permission: NotificationPermission
  enabled: boolean         // a live PushSubscription exists on this device
  busy: boolean
  error: PushErrorCode | null   // last failure, so the UI never snaps back silently
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  sendTest: () => Promise<{ attempted: number; sent: number }>
}

// ── Push notification categories (N2/N3 settings list, mezo-h4wp.6.2/.3; companion-feed
// evening/sleep_reaction/weight_reaction, mezo-gst9) ──────────────────────────────────────
// The keys/sections/defaults mirror the backend's authoritative enum
// (backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java)
// and design spec §6 (docs/superpowers/specs/2026-07-29-push-notifications-design.md) —
// keep both in sync if a category is ever added/renamed.
//
// NOTE (mezo-p2tr): the backend's `weekly` enum entry is RETIRED (kept server-side only so
// persisted notification_pref rows still resolve) — it is deliberately ABSENT from this union
// and from NOTIFICATION_CATEGORIES/META below, so no dead settings row can ever render for it.
// `notificationPrefHooks` drops any `GET /api/notification/pref` row whose category isn't in
// NOTIFICATION_CATEGORIES for exactly this reason. `weekly_review` is its Monday-10:00,
// backward-looking replacement.
export type NotificationCategoryKey =
  | 'briefing' | 'gym' | 'medication' | 'ritual' | 'lights_out'
  | 'weekly_review' | 'memoir' | 'wind_down' | 'midday' | 'checkin' | 'fuel_slot'
  | 'evening' | 'sleep_reaction' | 'weight_reaction'
  | 'pattern' | 'knowledge' | 'prediction' | 'experiment' | 'challenge' | 'memory'
  | 'decision_review' | 'intervention'

/** Stable render order — NotificationCategory enum order (backend declaration order). */
export const NOTIFICATION_CATEGORIES: NotificationCategoryKey[] = [
  'briefing', 'gym', 'medication', 'ritual', 'lights_out',
  'weekly_review', 'memoir', 'wind_down', 'midday', 'checkin', 'fuel_slot',
  'evening', 'sleep_reaction', 'weight_reaction',
  'pattern', 'knowledge', 'prediction', 'experiment', 'challenge', 'memory',
  'decision_review', 'intervention',
]

export interface NotificationPrefView {
  category: NotificationCategoryKey
  enabled: boolean
  leadMinutes: number
}

export type NotificationSection = 'prose' | 'reminder' | 'brain'

export interface NotificationCategoryMeta {
  label: string
  emoji: string
  section: NotificationSection
  /** A static, honest description of WHEN the category fires — never a live clock time (the
   *  row is presentational and takes no @/data/* hook, so it cannot read anchors itself). */
  description: string
  /** Only `gym`'s leadMinutes actually shifts the fire time (design spec §6/§9): the ritual
   *  family (ritual/lights_out/wind_down) resolves its offset through RitualService instead, so
   *  a lead chip there would expose a number the backend ignores — dishonest control. */
  showLeadChip: boolean
  /** CSS var name (without `var()`) for the row icon's wash background. */
  iconBg: string
}

/** Hungarian settings-list copy for all 11 categories (mockup direction C, §2 "A · Kategória-lista"
 *  section 1 for per-category copy) — the UI must never hardcode this inline. */
export const NOTIFICATION_CATEGORY_META: Record<NotificationCategoryKey, NotificationCategoryMeta> = {
  briefing: {
    label: 'Reggeli briefing', emoji: '☀️', section: 'prose',
    description: 'Ébredéskor, a napi tervvel', showLeadChip: false, iconBg: '--wash-sport',
  },
  midday: {
    label: 'Déli jegyzet', emoji: '✨', section: 'prose',
    description: 'Dél körül, egy rövid állapotfrissítés', showLeadChip: false, iconBg: '--wash-sport',
  },
  weekly_review: {
    label: 'Heti elemzés', emoji: '📖', section: 'prose',
    description: 'Hétfő reggel 10:00', showLeadChip: false, iconBg: '--wash-sport',
  },
  memoir: {
    label: 'Heti összefoglaló', emoji: '📔', section: 'prose',
    description: 'Vasárnap este 19:00', showLeadChip: false, iconBg: '--wash-sport',
  },
  gym: {
    label: 'Edzés előtt', emoji: '🏋️', section: 'reminder',
    description: 'A mai edzés kezdete előtt', showLeadChip: true, iconBg: '--wash-gym',
  },
  medication: {
    label: 'Gyógyszer beadás', emoji: '💉', section: 'reminder',
    description: 'Injekciós napon, reggel', showLeadChip: false, iconBg: '--wash-amber',
  },
  ritual: {
    label: 'Napzárás', emoji: '✨', section: 'reminder',
    description: 'A napzárás-ablak nyílásakor', showLeadChip: false, iconBg: '--wash-lav',
  },
  lights_out: {
    label: 'Villanyoltás', emoji: '🌙', section: 'reminder',
    description: 'Az esti alvás-horgonynál', showLeadChip: false, iconBg: '--wash-lav',
  },
  wind_down: {
    label: 'Lecsendesítés', emoji: '🫖', section: 'reminder',
    description: 'A napzárás-ablak előtti csendes szakasz kezdetén', showLeadChip: false, iconBg: '--wash-lav',
  },
  checkin: {
    label: 'Check-in', emoji: '🫀', section: 'reminder',
    description: '06:30 · 10:00 · 14:00 · 20:00', showLeadChip: false, iconBg: '--wash-run',
  },
  fuel_slot: {
    label: 'Fuel & stack', emoji: '💊', section: 'reminder',
    description: 'Minden fuel/stack slotnál', showLeadChip: false, iconBg: '--wash-sage',
  },
  evening: {
    label: 'Napzárás', emoji: '🌇', section: 'prose',
    description: 'Esti záró üzenet a naptól.', showLeadChip: false, iconBg: '--wash-sport',
  },
  sleep_reaction: {
    label: 'Alvás-reakció', emoji: '💤', section: 'prose',
    description: 'Üzenet az alvás rögzítése után.', showLeadChip: false, iconBg: '--wash-sport',
  },
  weight_reaction: {
    label: 'Súly-reakció', emoji: '⚖️', section: 'prose',
    description: 'Üzenet a reggeli mérés után.', showLeadChip: false, iconBg: '--wash-sport',
  },
  pattern: {
    label: 'Minták', emoji: '🧩', section: 'brain',
    description: 'Új minta döntésre, jel-erősödés — reggel, ébredés után', showLeadChip: false, iconBg: '--wash-lav',
  },
  knowledge: {
    label: 'Tudástár', emoji: '📚', section: 'brain',
    description: 'Új tény jóváhagyásra, tudás-megerősödés', showLeadChip: false, iconBg: '--wash-sage',
  },
  prediction: {
    label: 'Előrejelzések', emoji: '🔮', section: 'brain',
    description: 'Új predikció, bevált / nem vált be', showLeadChip: false, iconBg: '--wash-sport',
  },
  experiment: {
    label: 'Kísérletek', emoji: '🧪', section: 'brain',
    description: 'Új javaslat, kísérlet lezárult', showLeadChip: false, iconBg: '--wash-amber',
  },
  challenge: {
    label: 'Kihívások', emoji: '🏆', section: 'brain',
    description: 'Edzés-kihívás javaslat és eredmény', showLeadChip: false, iconBg: '--wash-gym',
  },
  memory: {
    label: 'Memória', emoji: '🗂', section: 'brain',
    description: 'Napi összefoglaló elkészült — ébredés után', showLeadChip: false, iconBg: '--wash-run',
  },
  decision_review: {
    label: 'Döntés visszanézés', emoji: '⚖️', section: 'brain',
    description: 'Amikor egy döntésed esedékes visszanézni', showLeadChip: false, iconBg: '--wash-lav',
  },
  // W5.2 (mezo-b3pp.19): event-driven — a flag raise választja ki, a kártya SAJÁT generálási
  // perce a horgony, csendes órák esetén eltolva (sosem eldobva). Ezért nincs lead-chip, és a
  // leírás sem ígér konkrét időt (lásd notificationForecast.ts `case 'intervention'`).
  intervention: {
    label: 'Közbelépések', emoji: '🎯', section: 'brain',
    description: 'Amikor egy jelzés közbelépést indokol', showLeadChip: false, iconBg: '--wash-amber',
  },
}

// --- In-app notification feed (bd mezo-gzhp.1, spec 2026-08-18) ---
/** Mirrors backend AppNotificationKind — keep in sync (AppNotificationKindTest pins that side).
 *  A szinkron NEM garantált: a két oldal külön nyelven él, és `weekly_review_ready` egyszer már
 *  kimaradt innen (mezo-ntf8). A leképezést ezért `notificationKindMeta()`-n keresztül olvasd,
 *  ami ismeretlen kulcsra semleges bejegyzést ad — egy új backend-fajta sosem döntheti el az
 *  értesítés-feedet. */
export type AppNotificationKindKey =
  | 'pattern_inbox' | 'pattern_signal' | 'hypothesis_new'
  | 'fact_candidate' | 'fact_reinforced' | 'memoir_ready'
  | 'prediction_new' | 'prediction_outcome'
  | 'experiment_proposed' | 'experiment_closed'
  | 'challenge_event' | 'memory_note' | 'weekly_review_ready'

export interface AppNotificationView {
  id: string
  kind: AppNotificationKindKey
  title: string
  body: string | null
  deeplink: string
  /** ISO date-time */
  occurredAt: string
  readAt: string | null
}

/** Per-kind ikon + tint osztály-utótag (a mockup családi színei). A `tint` a sor ikon-tokjának
 *  washát adja, a `clay` a Mozaik-nyelv ikonját — a feed-oldal (`NotificationFeedPage`) ezt a
 *  kettőt rendereli. Az `emoji` a törölt dropdown-panel öröksége, olvasója már nincs. */
export const APP_NOTIFICATION_KIND_META: Record<AppNotificationKindKey, {
  /** @deprecated Nincs olvasója a repóban a NotificationPanel törlése óta (mezo-nol0) — a feed
   *  a `clay` ikont rajzolja. Nem törlöm: a 12 soros literál nyesése ezt az ágat túllépő változás. */
  emoji: string
  tint: string
  clay: ClayIconName
}> = {
  pattern_inbox: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  pattern_signal: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  hypothesis_new: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  fact_candidate: { emoji: '📚', tint: 'knowledge', clay: 'i-tudas' },
  fact_reinforced: { emoji: '📚', tint: 'knowledge', clay: 'i-tudas' },
  memoir_ready: { emoji: '✍️', tint: 'memoir', clay: 'i-memoar' },
  prediction_new: { emoji: '🔮', tint: 'prediction', clay: 'i-kristaly' },
  prediction_outcome: { emoji: '🔮', tint: 'prediction', clay: 'i-kristaly' },
  experiment_proposed: { emoji: '🧪', tint: 'experiment', clay: 'i-lombik' },
  experiment_closed: { emoji: '🧪', tint: 'experiment', clay: 'i-lombik' },
  challenge_event: { emoji: '🏆', tint: 'experiment', clay: 'i-kihivas' },
  memory_note: { emoji: '🗂', tint: 'memory', clay: 'i-rend' },
  weekly_review_ready: { emoji: '🗓', tint: 'memoir', clay: 'i-heti' },
}

/** Semleges bejegyzés egy olyan fajtára, amit ez a build még nem ismer. */
const FALLBACK_KIND_META = { emoji: '🔔', tint: 'memory', clay: 'i-ertesites' } as const

/** A leképezés TOTÁLIS olvasója. A wire-kind sima string: a backend enum bővülhet anélkül, hogy
 *  ez a build tudna róla, és egy hiányzó kulcson a nyers indexelés `undefined`-et ad, amitől a
 *  feed-oldal sor-map-je elszáll és az egész oldal az ErrorBoundary-ra esik (mezo-ntf8, élesben).
 *  Egy ismeretlen értesítés inkább nézzen ki semlegesen, mint hogy elvigye a többit is. */
export function notificationKindMeta(
  kind: string,
): typeof FALLBACK_KIND_META | (typeof APP_NOTIFICATION_KIND_META)[AppNotificationKindKey] {
  return APP_NOTIFICATION_KIND_META[kind as AppNotificationKindKey] ?? FALLBACK_KIND_META
}
