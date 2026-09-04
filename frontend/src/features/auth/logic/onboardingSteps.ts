import { hu1 } from '@/shared/lib/huNum'

/** BiometricProfileUpsertRequest.heightCm — `minimum: 50, maximum: 260` (api/feature/biometrics-profile). */
export const HEIGHT_CM = { min: 50, max: 260, step: 1, initial: 175 } as const
/** LogWeightRequest.weightKg — `exclusiveMinimum 0, maximum 999.99` (api/feature/weight); 1-decimal UI. */
export const WEIGHT_KG = { min: 1, max: 999.9, step: 0.5, initial: 75 } as const
export const BIRTH_DATE_MIN = '1900-01-01'

export interface OnboardingDraft {
  sex: 'M' | 'F'
  birthDate: string // YYYY-MM-DD, '' until picked
  heightCm: number
  weightKg: number
}

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** ISO dates compare lexicographically == chronologically (DatePicker's rule). */
export function birthDateValid(iso: string, todayIso: string): boolean {
  return iso.length === 10 && iso >= BIRTH_DATE_MIN && iso < todayIso
}

export const SEX_LABEL: Record<'M' | 'F', string> = { M: 'Férfi', F: 'Nő' }

export function summaryLines(name: string, d: OnboardingDraft): string[] {
  return [
    `Név: ${name}`,
    `Születési dátum: ${d.birthDate}`,
    `Nem: ${SEX_LABEL[d.sex]}`,
    `Magasság: ${d.heightCm} cm`,
    `Súly: ${hu1(d.weightKg)} kg`,
  ]
}
