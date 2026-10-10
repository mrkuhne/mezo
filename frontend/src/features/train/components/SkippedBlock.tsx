import { Acts, Box, Btn, Bub, Lk } from '@/shared/ui/folyadek'
import type { RecoveryPeriod } from '@/data/train/recoveryApi'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { KIMELO, reasonOf, recoveryIcon, skipEffect, skipLabel } from '@/features/train/logic/skipCopy'
import { categoryCopy, estimateCopy } from '@/features/train/logic/recovery'

// ============================================================
// What a skipped or protected planned occurrence shows instead of its start action (Kihagyás S1
// mezo-q4xt2.1, Kímélő mód S2 mezo-q4xt2.2). Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js
// `skBlock()` / `skActs()` / `thero()` km branch / `kmIn()` / the „Visszatérő futás" line): a
// callout box and its text links. On a hero the box stands in the body and the links on the liquid
// action row, so both halves are exported on their own; the combined components are the form used
// under a session's row (`inner`) and anywhere outside a hero.
// ============================================================

/** The box of a skipped occurrence: the reason's glyph (or the skip mark), „Kihagyva · {reason}", the calm effect line. */
export function SkippedBox({ skip }: { skip: PlannedSkip }) {
  // An advice skip (coach suggestion) reads as reasonless: the skip glyph, „Okot adok".
  const reason = skip.source === 'ADVICE' ? undefined : reasonOf(skip)
  return (
    <Box icon={reason?.icon ?? 't-skip'} title={`Kihagyva · ${skipLabel(skip)}`} className="em-skipd">
      <p>{skipEffect(skip)}</p>
    </Box>
  )
}

/** The two links of a skipped occurrence: „Másik ok" / „Okot adok" and „Visszavonom". */
export function SkippedActs({ skip, onReason, onUndo }: { skip: PlannedSkip; onReason(): void; onUndo(): void }) {
  const reason = skip.source === 'ADVICE' ? undefined : reasonOf(skip)
  return (
    <>
      <Lk onClick={onReason}>{reason ? 'Másik ok' : 'Okot adok'}</Lk>
      <Lk onClick={onUndo}>Visszavonom</Lk>
    </>
  )
}

/**
 * The skipped block as one piece. `inner` is the indented form under a session's row (prototype
 * `.vs-in.col`: the box on the page ground, the two links under it); the default is the box with its
 * link row, for use outside a hero.
 */
export function SkippedBlock({ skip, inner, onReason, onUndo }: {
  skip: PlannedSkip
  inner?: boolean
  onReason(): void
  onUndo(): void
}) {
  if (inner) {
    return (
      <div className="em-in col">
        <SkippedBox skip={skip} />
        <div className="em-skacts"><SkippedActs skip={skip} onReason={onReason} onUndo={onUndo} /></div>
      </div>
    )
  }
  return (
    <>
      <SkippedBox skip={skip} />
      <Acts className="em-skacts"><SkippedActs skip={skip} onReason={onReason} onUndo={onUndo} /></Acts>
    </>
  )
}

type RecoveryFace = Pick<RecoveryPeriod, 'category' | 'estimate' | 'estimateExpired' | 'checkedInToday'>
const asks = (p: RecoveryFace) => p.estimateExpired && !p.checkedInToday

/** The box of a protected day's gym hero (prototype `thero()` km): the category glyph, „{Beteg vagy} · becslés: {2–3 nap}",
 *  the calm sub-line, and — once the estimate has passed and today's check-in is not in — the question. */
export function RecoveryBox({ period }: { period: RecoveryFace }) {
  const who = categoryCopy(period.category) ?? KIMELO.innerTitle
  return (
    <Box icon={recoveryIcon(period.category)} title={`${who} · ${estimateCopy(period.estimate, period.estimateExpired)}`} className="em-skipd">
      <p>{KIMELO.heroSub}</p>
      {asks(period) && <p><b className="em-kmq">{KIMELO.ask}</b></p>}
    </Box>
  )
}

/** The hero's actions on a protected day: „Jobban vagyok" (the button), „Még nem" while the question is open, „Ma mégis edzek". */
export function RecoveryActs({ period, busy, onRelease, onBetter, onNotYet }: {
  period: RecoveryFace
  busy?: boolean
  onRelease(): void
  onBetter(): void
  onNotYet(): void
}) {
  return (
    <>
      <Btn disabled={busy} onClick={onBetter}>Jobban vagyok</Btn>
      {asks(period) && <Lk disabled={busy} onClick={onNotYet}>Még nem</Lk>}
      <Lk disabled={busy} onClick={onRelease}>Ma mégis edzek</Lk>
    </>
  )
}

/**
 * The `recovery` variant as one piece (Kímélő mód S2 — prototype `thero()` km branch): the box, then
 * the actions. Presentational: the page owns the writes.
 */
export function RecoveryBlock(p: {
  period: RecoveryFace
  busy?: boolean
  onRelease(): void
  onBetter(): void
  onNotYet(): void
}) {
  return (
    <>
      <RecoveryBox period={p.period} />
      <Acts className="em-skacts"><RecoveryActs {...p} /></Acts>
    </>
  )
}

/** A protected occurrence under its row (prototype `kmIn()`): one quiet indented line. */
export function KimeloInner() {
  return (
    <div className="em-in em-kmin">
      <span><Bub icon="t-kimelo" size={24} /> <b>{KIMELO.innerTitle}</b> · {KIMELO.innerSub}</span>
    </div>
  )
}

/** The next planned run during the comeback (prototype `rampOn` line): „Visszatérő futás". */
export function RunRampInner() {
  return (
    <div className="em-in em-rampin">
      <span><Bub icon="t-sprout" size={24} /> <b>{KIMELO.runRampTitle}</b> · {KIMELO.runRamp}</span>
    </div>
  )
}
