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
export interface UserMeta { weekInMeso: number; dayInWeek: number; mesoLabel: string }
export interface TodayScenario { dayState: DayState; retaDay: number; niggle: boolean; vulnerable: boolean; anchorMode: boolean }
