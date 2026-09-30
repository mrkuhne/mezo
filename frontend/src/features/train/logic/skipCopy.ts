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

// ── Kímélő mód S2 (mezo-q4xt2.2) — prototype elo/edzes.html `kmHero` / `kmInner` / `whySheet` /
// `thero` (kmrel) / `cbBlock` / `udvSheet` / `dayCard` (kmday) and the click-handler toasts. ──

/** Every fixed kímélő-mód string on the Edzés page, verbatim from the prototype. */
export const KIMELO = {
  durationEyebrow: 'MEDDIG TARTHAT?',
  onLead: 'Kímélő mód bekapcsolva',
  onRest: ' · amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.',
  heroSub: 'Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.',
  ask: 'A becsült idő letelt — hogy vagy?',
  innerTitle: 'Kímélő mód',
  innerSub: 'Magától kimarad · nem számít mulasztásnak.',
  chip: 'KÍMÉLŐ MÓD',
  released: 'Kímélő mód közben edzel · csak ma, könnyítve: kevesebb sorozat, kb. 10%-kal kisebb súly',
  releasedFull: 'Kímélő mód közben edzel · csak ma',
  runRampTitle: 'Visszatérő futás',
  runRamp: 'Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.',
  welcomeRun: 'Az első futás kb. fele olyan hosszú, laza tempóban.',
  toastOn: 'Kímélő mód bekapcsolva',
  toastEnded: 'Kímélő mód befejezve',
  toastReleased: 'Rendben — ma edzel, holnaptól újra kímélő mód',
  toastUnreleased: 'Visszaállítva · ma pihensz',
  toastWelcome: 'Üdv újra! · könnyített visszatérés',
  toastStay: 'Rendben — marad a kímélő mód',
  toastWaived: 'Könnyítés kikapcsolva · teljes edzés',
  toastUndone: 'Visszaállítva · marad a kímélő mód',
} as const

/** „Rendben — holnap újra rákérdezek. {care}" — the „Még nem" toast. */
export function notYetToast(cat: SkipReason): string {
  return `Rendben — holnap újra rákérdezek. ${CARE[cat] ?? ''}`.trim()
}

/** The period's category icon (the reason chip's 3D art), or the kímélő shield without one. */
export function recoveryIcon(cat: SkipReason | null | undefined): Icon3DName {
  return (cat && REASONS.find((r) => r.id === cat)?.icon) || 't-kimelo'
}

/** A protected day's week-list line (prototype `dayCard` kmday): „Kímélő mód · {session} kimarad". */
export function kimeloAgendaParts(session: string): { bold: string; rest: string } {
  return { bold: KIMELO.innerTitle, rest: ` · ${session} kimarad` }
}

// ── Kímélő mód on the Nap hub (mezo-q4xt2.2) — prototype elo/nap.html `kmSlot` / `kmSheet` /
// `kmWelcome` and its click-handler toasts, verbatim. ──

/** Every fixed kímélő-mód string on the Nap hub. */
export const KIMELO_NAP = {
  entry: 'Nem vagyok jól',
  sheetEyebrow: 'KÍMÉLŐ MÓD',
  sheetTitle: 'Mi történt?',
  sheetSub: 'Szólj, és a napod hozzád igazodik. Nem kell magyarázkodnod.',
  noteLead: 'Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.',
  noteRest: ' Bármikor befejezheted.',
  cta: 'Kímélő mód bekapcsolása',
  title: 'Hogy vagy?',
  notYet: 'Még nem',
  better: 'Jobban',
  oops: 'Tévedés volt',
  slimSub: 'Holnap reggel újra rákérdezek, hogy vagy.',
  finish: 'Befejezem',
  confirm: 'Töröljem a kímélő módot?',
  confirmSub: 'A kihagyott edzések visszaállnak, mintha be se kapcsoltad volna.',
  cancel: 'Mégse',
  discard: 'Törlöm',
  toastNotYet: 'Rendben, holnap reggel újra rákérdezek',
  toastDiscarded: 'Kímélő mód törölve · az edzéseid visszaálltak',
  toastWelcome: 'Jó, hogy jobban vagy',
  toastUndone: 'Rendben, a kímélő mód folytatódik',
  closeChip: 'edzés · kímélő mód',
} as const

/** The card's short estimate (prototype KMD[3], non-breaking like the prototype). */
const NAP_ESTIMATE: Record<string, string> = {
  TODAY: 'ma', FEW_DAYS: '2–3 nap', WEEK: 'kb. egy hét', UNKNOWN: 'nincs',
}

/** The „Hogy vagy?" sub-line: „Kímélő mód · 2. nap · becslés: " + „2–3 nap" (the estimate kept on
 *  one line by the caller), or the question alone once the estimate has passed. */
export function napKimeloSub(p: { dayIndex: number; estimate: string; estimateExpired: boolean }): { lead: string; estimate?: string } {
  if (p.estimateExpired) return { lead: KIMELO.ask }
  return { lead: `Kímélő mód · ${p.dayIndex}.\u00a0nap · becslés: `, estimate: NAP_ESTIMATE[p.estimate] ?? NAP_ESTIMATE.UNKNOWN }
}

/** The serious category's accent (prototype KMC): the chip glow, the card's `--c`. */
const RECOVERY_HUE: Partial<Record<SkipReason, string>> = {
  ILLNESS: 'var(--dv-rose)', STOMACH: 'var(--dv-sage)', INJURY: 'var(--dv-coral)', TRAVEL: 'var(--dv-sky)',
}
export function recoveryHue(cat: SkipReason | null | undefined): string {
  return (cat && RECOVERY_HUE[cat]) || 'var(--dv-rose)'
}

/** The four serious reasons that open a period (the reason chips' first four). */
export const SERIOUS_REASONS = REASONS.filter((r) => RECOVERY_HUE[r.id] != null)
