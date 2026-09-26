// Mezo · challengeDisplay (mezo-oy91i) — how a workout challenge reads on screen, shared by the
// start-of-workout picker (WorkoutChallengesGlass) and the closing ceremony's Küldetések strip, so
// the two draw the same row: the exercise name, then ONE chip line — the type chip with its 3D
// icon, then the target values as pills (üveg bible U4 rule 28).
import type { Challenge } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'

export const CHALLENGE_TYPE_ICON: Record<string, Icon3DName> = {
  overload: 't-up', PR: 't-record', Depth: 't-hold', Volume: 't-protocol', Tempo: 't-clock',
}

export const challengeTypeIcon = (type: string): Icon3DName => CHALLENGE_TYPE_ICON[type] ?? 't-quest'

/** The wire's English labels, in the app's language. */
const TYPE_LABEL_HU: Record<string, string> = { 'PR-attempt': 'PR-kísérlet' }

/** '⚡ Túlterhelés' → 'Túlterhelés', 'PR-attempt' → 'PR-kísérlet'. Render-time only: the wire and
 *  the mock seed stay as they are; the chip's icon is the 3D one. */
export function challengeTypeLabel(label: string): string {
  const clean = label.replace(/[\p{Extended_Pictographic}️‍]/gu, '').trim() || label
  return TYPE_LABEL_HU[clean] ?? clean
}

/** '107.5 kg × 8' → ['107,5 kg', '8 ism.']; 'Utolsó szet RIR 0-ig' → ['RIR 0', 'utolsó szett'];
 *  other free-text pieces pass through as they are. */
export function targetChips(target: string): string[] {
  const rir = /RIR\s*(\d+)/i.exec(target)
  if (rir && /utols/i.test(target)) return [`RIR ${rir[1]}`, 'utolsó szett']
  return target.split(/ × | · /).map((p) => p.trim()).filter(Boolean).map((p) => {
    const kg = /^(\d+(?:[.,]\d+)?)\s*kg$/i.exec(p)
    if (kg) return `${kg[1].replace('.', ',')} kg`
    if (/^\d+$/.test(p)) return `${p} ism.`
    return p
  })
}

/** The faint line under a challenge's reasoning: '72% biztos · közepes kockázat'. */
export function challengeConfidenceLine(confidence: number | null | undefined, risk: Challenge['risk']): string {
  const conf = confidence == null ? 'Még tanulom, mennyire biztos' : `${Math.round(confidence * 100)}% biztos`
  return `${conf} · ${risk === 'low' ? 'alacsony' : 'közepes'} kockázat`
}
