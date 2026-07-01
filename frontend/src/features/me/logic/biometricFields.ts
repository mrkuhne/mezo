// Shared biometric field metadata for the Profile Biometria card + editor sheet
// (G6, mezo-06n). Lifted from the deleted GoalPlannerPage Step2. The PAL multipliers
// match the engine's TDEE = BMR × PAL (Task 3); the HU labels + hints drive both
// the editor's activity-level list and the card's compact "Aktivitás" readout.
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'VERY' | 'EXTRA'

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; hint: string; pal: number }[] = [
  { id: 'SEDENTARY', label: 'Ülő', hint: 'kevés mozgás, irodai munka', pal: 1.2 },
  { id: 'LIGHT', label: 'Enyhén aktív', hint: 'heti 1–2 edzés', pal: 1.375 },
  { id: 'MODERATE', label: 'Mérsékelten aktív', hint: 'heti 3–5 edzés', pal: 1.55 },
  { id: 'VERY', label: 'Nagyon aktív', hint: 'heti 6–7 edzés', pal: 1.725 },
  { id: 'EXTRA', label: 'Extra aktív', hint: 'napi kemény edzés / fizikai munka', pal: 1.9 },
]

// Compact card label ("Mérsékelt") vs the editor's full label ("Mérsékelten aktív").
export const ACTIVITY_SHORT: Record<ActivityLevel, string> = {
  SEDENTARY: 'Ülő',
  LIGHT: 'Enyhén aktív',
  MODERATE: 'Mérsékelt',
  VERY: 'Nagyon aktív',
  EXTRA: 'Extra aktív',
}

// Whole-year age from an ISO birth date (YYYY-MM-DD), relative to today.
export function ageFromBirthDate(birthDateIso: string): number {
  const birth = new Date(birthDateIso)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// HU decimal-comma PAL multiplier label, e.g. 1.55 → "×1,55".
export function palLabel(pal: number): string {
  return `×${String(pal).replace('.', ',')}`
}
