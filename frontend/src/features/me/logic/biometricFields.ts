// Shared biometric field metadata for the Profile Biometria card + editor sheet
// (G6, mezo-06n). The NEAT multipliers match the engine's TDEE bands (mezo.goal.neat);
// the HU labels + hints drive both the editor's activity-level list and the card's
// compact "Aktivitás" readout.
export type ActivityLevel = 'DESK' | 'MIXED' | 'PHYSICAL'

// NEAT lifestyle bands (non-exercise). Training energy is added separately (scheduled weekly EAT),
// so these hints describe daily NON-exercise life only. Matches the backend mezo.goal.neat bands.
export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; hint: string; neat: number }[] = [
  { id: 'DESK', label: 'Ülő életmód', hint: 'irodai munka, kevés lépés, autó', neat: 1.2 },
  { id: 'MIXED', label: 'Vegyes', hint: 'napközben mozgásban, sok lépés', neat: 1.35 },
  { id: 'PHYSICAL', label: 'Fizikai', hint: 'fizikai munka, egész nap lábon', neat: 1.5 },
]

// Compact card label vs the editor's full label.
export const ACTIVITY_SHORT: Record<ActivityLevel, string> = {
  DESK: 'Ülő',
  MIXED: 'Vegyes',
  PHYSICAL: 'Fizikai',
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

// HU decimal-comma NEAT multiplier label, e.g. 1.35 → "×1,35".
export function neatLabel(neat: number): string {
  return `×${String(neat).replace('.', ',')}`
}
