import type { GoalResponse } from '@/data/me/goalApi'

// Contract-native trajectory + guard labels — the hero (GoalsPage) and the
// Profil goal-mini-track (GoalMiniCard, spec §4.6) both read these straight
// off the raw GoalResponse (G4b Decision C: window/trajectory/guards/weights
// no longer pass through the toGoal back-compat mapper).
export const TRAJECTORY_LABEL: Record<GoalResponse['trajectory'], string> = {
  cut: 'Fogyás',
  bulk: 'Hízás',
  maintain: 'Maintenance',
}
export const GUARD_LABEL: Record<string, string> = {
  strength: 'Erő-gard',
  muscle: 'Izom-gard',
}
