import { useState } from 'react'
import { Btn, Bub, Card, Hero, Lk, Row, Txt } from '@/shared/ui/folyadek'
import { useToast } from '@/shared/ui/ToastProvider'
import type { RecoveryPeriod } from '@/data/train/recoveryApi'
import {
  useDiscardRecovery,
  useRecovery,
  useRecoveryCheckIn,
  useUndoBetter,
} from '@/data/train/recoveryHooks'
import { useActiveMesoWeek } from '@/data/train/trainHooks'
import { KIMELO_NAP, REASONS, napKimeloSub, recoveryIcon } from '@/features/train/logic/skipCopy'
import { useRecoveryBetter } from '@/features/train/logic/useRecoveryBetter'
import { WelcomeBackSheet } from '@/features/train/components/WelcomeBackSheet'
import { NemVagyokJolSheet } from '@/features/today/components/NemVagyokJolSheet'

/** The hero's label already says „Kímélő mód · <ok>": the sub-line drops the same lead (prototype: „2. nap · becslés: 2–3 nap"). */
const LABEL_PREFIX = /^Kímélő mód · /

/**
 * „Hogy vagy?" (Kímélő mód S2, mezo-q4xt2.2 — Folyadék prototype `vilagos/nap.js` `kmCard()`): the open
 * period's daily question on the Nap hub, a warn `Hero` with the category's glyph — Jobban / Még nem
 * and the quiet „Tévedés volt", which asks in the card before discarding. Once answered today
 * (`checkedInToday`) it shrinks to the slim „Kímélő mód · n. nap" row with „Befejezem" (= Jobban).
 * Presentational: `KimeloSlot` owns the writes.
 */
export function KimeloCard({ period, busy, onNotYet, onBetter, onDiscard }: {
  period: RecoveryPeriod
  busy?: boolean
  onNotYet(): void
  onBetter(): void
  onDiscard(): void
}) {
  const [ask, setAsk] = useState(false)
  const icon = recoveryIcon(period.category)
  const label = REASONS.find((r) => r.id === period.category)?.label ?? ''
  const sub = napKimeloSub(period)
  if (period.checkedInToday) {
    return (
      <Card className="nm-kmslim">
        <Row icon={icon} title={`Kímélő mód · ${period.dayIndex}. nap`} sub={KIMELO_NAP.slimSub}
          right={<Lk disabled={busy} onClick={onBetter}>{KIMELO_NAP.finish}</Lk>} />
      </Card>
    )
  }
  return (
    <div className="nm-km" role="group" aria-label={ask ? KIMELO_NAP.confirm : undefined} aria-labelledby={ask ? undefined : 'nap-km-title'}>
      <Hero warn label={`Kímélő mód · ${label}`} verdict={<span id="nap-km-title">{KIMELO_NAP.title}</span>}
        sub={<>{sub.lead.replace(LABEL_PREFIX, '')}{sub.estimate && <span className="nm-nw">{sub.estimate}</span>}</>}
        actions={ask ? (
          <>
            <Btn sm disabled={busy} onClick={onDiscard}>{KIMELO_NAP.discard}</Btn>
            <Btn sm ghost disabled={busy} onClick={() => setAsk(false)}>{KIMELO_NAP.cancel}</Btn>
          </>
        ) : (
          <>
            <Btn sm disabled={busy} onClick={onBetter}>{KIMELO_NAP.better}</Btn>
            <Btn sm ghost disabled={busy} onClick={onNotYet}>{KIMELO_NAP.notYet}</Btn>
            <Lk disabled={busy} onClick={() => setAsk(true)}>{KIMELO_NAP.oops}</Lk>
          </>
        )}>
        <span className="nm-km-art" aria-hidden="true"><Bub icon={icon} size={64} color="var(--fo-warn)" /></span>
        {ask && <Txt className="nm-km-ask"><b>{KIMELO_NAP.confirm}</b><span>{KIMELO_NAP.confirmSub}</span></Txt>}
      </Hero>
    </div>
  )
}

/**
 * The Nap hub's kímélő slot (prototype `kmCard()` + the `kmwelcome` sheet): an open period → `KimeloCard`
 * at the top of the page; with no period it renders nothing here — the „Nem vagyok jól" entry is
 * `KimeloEntry`, a row at the bottom of the page.
 * „Jobban" follows the shared rule (`useRecoveryBetter`: day 1 discards, later → „Üdv újra!").
 * Every write's failure is toasted by the global MutationCache; the UI moves only on success.
 * Real mode renders nothing until the state is known (or when the read failed).
 */
export function KimeloSlot() {
  const toast = useToast()
  const { recovery, isPending, isError } = useRecovery()
  const checkIn = useRecoveryCheckIn()
  const discard = useDiscardRecovery()
  const undoBetter = useUndoBetter()
  const { better, welcome, closeWelcome } = useRecoveryBetter({ checkIn, discard })
  const period = recovery.period ?? null
  const open = period && !period.endedOn ? period : null
  // The meso list only matters for „Üdv újra!" — fetch it only while a period exists.
  const week = useActiveMesoWeek({ enabled: Boolean(period) })
  const busy = checkIn.isPending || discard.isPending || undoBetter.isPending
  if (isPending || isError) return null
  return (
    <>
      {open && (
        <KimeloCard key={open.id} period={open} busy={busy}
          onNotYet={() => checkIn.mutate('NOT_YET', { onSuccess: () => toast.show({ kind: 'info', text: KIMELO_NAP.toastNotYet }) })}
          onBetter={() => better(open)}
          onDiscard={() => discard.mutate(undefined, { onSuccess: () => toast.show({ kind: 'info', text: KIMELO_NAP.toastDiscarded }) })} />
      )}
      {welcome && period?.return && (
        <WelcomeBackSheet ret={period.return} week={week} showRun={false} busy={busy}
          onClose={closeWelcome}
          onOk={() => toast.show({ kind: 'success', text: KIMELO_NAP.toastWelcome })}
          onUndo={() => undoBetter.mutate(undefined, {
            onSuccess: () => {
              closeWelcome()
              toast.show({ kind: 'info', text: KIMELO_NAP.toastUndone })
            },
          })} />
      )}
    </>
  )
}

/**
 * The „Nem vagyok jól" entry (prototype `mai()` „Továbbiak" card, last row): opens „Mi történt?".
 * Unknown state (loading, or a failed read) or an open period → nothing: never offer it over a
 * period the server may already hold.
 */
export function KimeloEntry() {
  const { recovery, isPending, isError } = useRecovery()
  const [sheet, setSheet] = useState(false)
  const open = Boolean(recovery.period && !recovery.period.endedOn)
  if (isPending || isError) return null
  return (
    <>
      {!open && (
        <div className="nm-rows">
          <Row icon="t-kimelo" title={KIMELO_NAP.entry} sub="Kímélő mód: betegség, sérülés vagy utazás idejére"
            aria-label={KIMELO_NAP.entry} onClick={() => setSheet(true)} />
        </div>
      )}
      {sheet && <NemVagyokJolSheet onClose={() => setSheet(false)} />}
    </>
  )
}
