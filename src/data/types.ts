import type { IconName } from '@/components/ui/Icon'

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
export interface FuelSlot { time: string; kind: FuelKind; label: string; state: 'done' | 'now' | 'pending'; mealName?: string; mezoNote?: string; items?: { done?: boolean }[] }
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
