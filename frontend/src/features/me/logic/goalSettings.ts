import { goalResponseToUpsert, type GoalResponse } from '@/data/me/goalApi'
import { addDays } from '@/shared/lib/dates'

export function deriveGoalTargetDate(today: string, current: number, target: number, pace: number, trajectory: string): string | null {
  if (trajectory === 'maintain' || ![current, target, pace].every(Number.isFinite) || current <= 0 || target <= 0 || pace <= 0) return null
  const distance = trajectory === 'cut' ? current - target : target - current
  if (distance <= 0) return null
  const days = Math.ceil(Number((distance / pace * 7).toFixed(8)))
  if (days > 36500) return null
  return addDays(today, days)
}

export function buildGoalSettingsRequest(goal: GoalResponse, targetWeightKg: number, targetDate: string) {
  return { ...goalResponseToUpsert(goal), targetWeightKg, targetDate }
}
