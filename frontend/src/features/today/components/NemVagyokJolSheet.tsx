import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Btn, Bub, FoSheetHead, Why } from '@/shared/ui/folyadek'
import { useToast } from '@/shared/ui/ToastProvider'
import { useOpenRecovery } from '@/data/train/recoveryHooks'
import type { SkipReason } from '@/features/train/logic/plannedSkips'
import type { RecoveryEstimate } from '@/features/train/logic/recovery'
import { KIMELO, KIMELO_NAP, SERIOUS_REASONS } from '@/features/train/logic/skipCopy'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'

/** „Kímélő mód · szólj, és …": the head's one sub line (the old eyebrow + sub, as the prototype writes it). */
const SHEET_SUB = `Kímélő mód · ${KIMELO_NAP.sheetSub.charAt(0).toLocaleLowerCase('hu')}${KIMELO_NAP.sheetSub.slice(1)}`

/**
 * „Mi történt?" (Kímélő mód S2, mezo-q4xt2.2 — Folyadék prototype `vilagos/nap.js` `kmSheet()`): the Nap
 * hub's „Nem vagyok jól" entry. The four serious reasons as tiles, then „Meddig tarthat?"
 * (a second tap on the lit chip clears it — no estimate is UNKNOWN), the calm note and „Kímélő mód
 * bekapcsolása", disabled until a reason is picked. It opens the period starting today; a failed
 * write is toasted by the global MutationCache and the sheet stays open.
 */
export function NemVagyokJolSheet({ onClose }: { onClose(): void }) {
  const openRecovery = useOpenRecovery()
  const toast = useToast()
  const [cat, setCat] = useState<SkipReason | null>(null)
  const [estimate, setEstimate] = useState<RecoveryEstimate | null>(null)
  const busy = openRecovery.isPending
  return (
    <Sheet onClose={onClose} labelledBy="km-nap-title" className="fo-sheet nm-kmsheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-kimelo" title={KIMELO_NAP.sheetTitle} titleId="km-nap-title" sub={SHEET_SUB} onClose={close} />
          <div className="nm-opt4" role="group" aria-label={KIMELO_NAP.sheetTitle}>
            {SERIOUS_REASONS.map((r) => (
              <button key={r.id} type="button" className={cat === r.id ? 'on' : undefined} aria-pressed={cat === r.id}
                disabled={busy} onClick={() => setCat(r.id)}>
                <Bub icon={r.icon} size={48} />
                <span>{r.label}</span>
              </button>
            ))}
          </div>
          {cat && (
            <div className="nm-kmdur">
              <RecoveryDurationRow value={estimate} disabled={busy}
                onPick={(e) => setEstimate((prev) => (prev === e ? null : e))} />
            </div>
          )}
          <Why icon="t-heart"><b>{KIMELO_NAP.noteLead}</b>{KIMELO_NAP.noteRest}</Why>
          <Btn wide className="nm-kmcta" disabled={!cat || busy}
            onClick={() => {
              if (!cat) return
              openRecovery.mutate({ category: cat, estimate: estimate ?? 'UNKNOWN' }, {
                onSuccess: () => {
                  toast.show({ kind: 'success', text: KIMELO.toastOn })
                  close()
                },
              })
            }}>
            {KIMELO_NAP.cta}
          </Btn>
        </>
      )}
    </Sheet>
  )
}
