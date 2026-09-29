import { useState, type CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import type { RecoveryPeriod } from '@/data/train/recoveryApi'
import {
  useDiscardRecovery,
  useRecovery,
  useRecoveryCheckIn,
  useUndoBetter,
} from '@/data/train/recoveryHooks'
import { useActiveMesoWeek } from '@/data/train/trainHooks'
import { KIMELO_NAP, REASONS, napKimeloSub, recoveryHue, recoveryIcon } from '@/features/train/logic/skipCopy'
import { useRecoveryBetter } from '@/features/train/logic/useRecoveryBetter'
import { WelcomeBackSheet } from '@/features/train/components/WelcomeBackSheet'
import { NemVagyokJolSheet } from '@/features/today/components/NemVagyokJolSheet'

/**
 * „Hogy vagy?" (Kímélő mód S2, mezo-q4xt2.2 — prototype elo/nap.html `kmSlot()`): the open
 * period's daily question on the Nap hub, a glass card in the category's accent — Még nem / Jobban
 * and the quiet „Tévedés volt", which asks in the card before discarding. Once answered today
 * (`checkedInToday`) it shrinks to the slim „Kímélő mód · n. nap" line with „Befejezem ›" (= Jobban).
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
      <div className="nap-kmslim rise" style={{ '--i': 1 } as CSSProperties}>
        <Icon3D name={icon} size={32} />
        <span>
          <strong>Kímélő mód · {period.dayIndex}. nap</strong>
          <small>{KIMELO_NAP.slimSub}</small>
        </span>
        <button type="button" disabled={busy} onClick={onBetter}>{KIMELO_NAP.finish} <span aria-hidden="true">›</span></button>
      </div>
    )
  }
  return (
    <section className="nap-kmcard glass rise" aria-labelledby="nap-km-title"
      style={{ '--c': recoveryHue(period.category), '--i': 1 } as CSSProperties}>
      <div className="nap-kmhalo" aria-hidden="true" />
      <div className="nap-kmtop">
        <Icon3D name={icon} size={58} className="nap-kmart" />
        <span>
          <span className="nap-kmeb">KÍMÉLŐ MÓD · {label.toLocaleUpperCase('hu')}</span>
          <strong id="nap-km-title">{KIMELO_NAP.title}</strong>
          <small>{sub.lead}{sub.estimate && <span className="nap-kmnw">{sub.estimate}</span>}</small>
        </span>
      </div>
      {ask ? (
        <div className="nap-kmask" role="group" aria-label={KIMELO_NAP.confirm}>
          <p>{KIMELO_NAP.confirm}<small>{KIMELO_NAP.confirmSub}</small></p>
          <div className="nap-kmbtns">
            <button type="button" className="nap-kmbtn" disabled={busy} onClick={() => setAsk(false)}>{KIMELO_NAP.cancel}</button>
            <button type="button" className="nap-kmbtn is-del" disabled={busy} onClick={onDiscard}>{KIMELO_NAP.discard}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="nap-kmtwo">
            <button type="button" className="nap-kmbtn" disabled={busy} onClick={onNotYet}>{KIMELO_NAP.notYet}</button>
            <button type="button" className="nap-kmgo" disabled={busy} onClick={onBetter}>
              <Icon3D name="t-sun" size={22} />{KIMELO_NAP.better}
            </button>
          </div>
          <button type="button" className="nap-kmoops" disabled={busy} onClick={() => setAsk(true)}>{KIMELO_NAP.oops}</button>
        </>
      )}
    </section>
  )
}

/**
 * The Nap hub's kímélő slot (prototype `kmSlot()` + the `kimelo` / `kmwelcome` sheets): no open
 * period → the quiet „Nem vagyok jól" pill that opens „Mi történt?"; an open one → `KimeloCard`.
 * „Jobban" follows the shared rule (`useRecoveryBetter`: day 1 discards, later → „Üdv újra!").
 * Every write's failure is toasted by the global MutationCache; the UI moves only on success.
 * Real mode renders nothing until the state is known, so a pill never flashes before the card.
 */
export function KimeloSlot() {
  const toast = useToast()
  const { recovery, isPending } = useRecovery()
  const checkIn = useRecoveryCheckIn()
  const discard = useDiscardRecovery()
  const undoBetter = useUndoBetter()
  const week = useActiveMesoWeek()
  const { better, welcome, closeWelcome } = useRecoveryBetter({ checkIn, discard })
  const [sheet, setSheet] = useState(false)
  const period = recovery.period ?? null
  const open = period && !period.endedOn ? period : null
  const busy = checkIn.isPending || discard.isPending || undoBetter.isPending
  if (isPending) return null
  return (
    <>
      {open ? (
        <KimeloCard key={open.id} period={open} busy={busy}
          onNotYet={() => checkIn.mutate('NOT_YET', { onSuccess: () => toast.show({ kind: 'info', text: KIMELO_NAP.toastNotYet }) })}
          onBetter={() => better(open)}
          onDiscard={() => discard.mutate(undefined, { onSuccess: () => toast.show({ kind: 'info', text: KIMELO_NAP.toastDiscarded }) })} />
      ) : (
        <div className="nap-kmentry rise" style={{ '--i': 1 } as CSSProperties}>
          <button type="button" className="nap-kmpill" onClick={() => setSheet(true)}>
            <Icon3D name="t-heart" size={20} />{KIMELO_NAP.entry}<b aria-hidden="true">›</b>
          </button>
        </div>
      )}
      {sheet && <NemVagyokJolSheet onClose={() => setSheet(false)} />}
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
