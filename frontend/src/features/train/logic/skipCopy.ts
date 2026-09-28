// ============================================================
// Mezo · skipCopy — every word the skip UI says (Kihagyás S1, mezo-q4xt2.1). The prototype's
// `CATS` / `CARE` / `skLabel` / `skEffect` / `whySheet` note (docs/design_2.0/prototypes/elo/
// edzes.html) as pure functions over a `PlannedSkip`'s read-time verdict. Adherence-neutral by
// contract: no string here may shame (guarded in skipCopy.test.ts).
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import type { PlannedSkip, SkipReason } from './plannedSkips'

/** The reason chips, in the prototype order (serious four first). */
export const REASONS: { id: Exclude<SkipReason, 'NONE'>; icon: Icon3DName; label: string }[] = [
  { id: 'ILLNESS', icon: 't-ill', label: 'Beteg vagyok' },
  { id: 'STOMACH', icon: 't-digestion', label: 'Gyomorrontás' },
  { id: 'INJURY', icon: 't-pain', label: 'Sérülés / fájdalom' },
  { id: 'TRAVEL', icon: 't-travel', label: 'Úton vagyok' },
  { id: 'TIRED', icon: 't-rested', label: 'Fáradt vagyok' },
  { id: 'NO_TIME', icon: 't-clock', label: 'Nincs időm' },
  { id: 'NO_MOOD', icon: 't-motivation', label: 'Nincs kedvem' },
  { id: 'OTHER', icon: 't-other', label: 'Egyéb' },
]

/** The care word after a serious reason. */
const CARE: Partial<Record<SkipReason, string>> = {
  ILLNESS: 'Jobbulást!', STOMACH: 'Jobbulást!', INJURY: 'Kíméld magad.', TRAVEL: 'Jó utat!',
}

const NOT_A_MISS = 'Nem számít mulasztásnak.'

export const reasonOf = (s: Pick<PlannedSkip, 'reasonCategory'>) => REASONS.find((r) => r.id === s.reasonCategory)

/** „Kihagyva · {skipLabel}" — the reason in words. */
export function skipLabel(s: PlannedSkip): string {
  if (s.source === 'ADVICE') return 'az edző javaslatára'
  const r = reasonOf(s)
  if (!r) return 'ok nélkül'
  const text = s.reasonText?.trim()
  if (r.id === 'OTHER' && text) return `„${text}”`
  return r.label
}

/** What the skip does to the week — the SkippedBlock's quiet second line. */
export function skipEffect(s: PlannedSkip): string {
  if (s.source === 'ADVICE') return NOT_A_MISS
  if (s.serious) return `${NOT_A_MISS} ${CARE[s.reasonCategory] ?? ''}`.trim()
  if (s.freePass) return 'A heti szabadjegyed fedezi — a sorozatod marad.'
  return 'Rendes kihagyásnak számít — a heti szabadjegy már elment. Semmi gond.'
}

/** The reason sheet's note row, split so the component can bold the lead (prototype whySheet). */
export function sheetNoteParts(s: PlannedSkip | undefined): { icon: Icon3DName; bold?: string; rest: string } {
  if (!s || !reasonOf(s)) return { icon: 't-info', rest: 'Ha megmondod, miért, a terv és az edző ehhez igazodik. Nem kötelező.' }
  if (s.serious) return { icon: 't-heart', bold: NOT_A_MISS, rest: ` ${CARE[s.reasonCategory] ?? ''}`.trimEnd() }
  if (s.freePass) return { icon: 't-shield', bold: 'Ezt a heti szabadjegyed fedezi', rest: ' — a sorozatod marad.' }
  return {
    icon: 't-info',
    bold: 'Ez rendes kihagyásnak számít',
    rest: ' — a heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.',
  }
}

/** The note row as one plain sentence. */
export function sheetNote(s: PlannedSkip | undefined): string {
  const p = sheetNoteParts(s)
  return `${p.bold ?? ''}${p.rest}`
}

/** The „Kész" toast; `text` is the OTHER text about to be saved (it wins over the stored one). */
export function skipDoneToast(s: PlannedSkip, text?: string | null): string {
  return `Megjegyeztem · ${skipLabel(text != null ? { ...s, reasonText: text } : s)}`
}
