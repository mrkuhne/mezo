import { useState, type CSSProperties } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { cn } from '@/shared/lib/cn'
import { useOpenRecovery } from '@/data/train/recoveryHooks'
import type { SkipReason } from '@/features/train/logic/plannedSkips'
import type { RecoveryEstimate } from '@/features/train/logic/recovery'
import { KIMELO, KIMELO_NAP, SERIOUS_REASONS, recoveryHue } from '@/features/train/logic/skipCopy'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'

/**
 * „Mi történt?" (Kímélő mód S2, mezo-q4xt2.2 — prototype elo/nap.html `kmSheet()`): the Nap hub's
 * „Nem vagyok jól" entry. The four serious reasons (each in its own accent), then „Meddig tarthat?"
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
    <Sheet glass onClose={onClose} labelledBy="km-nap-title" className="nap-kmsheet">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-heart" eyebrow={KIMELO_NAP.sheetEyebrow} title={KIMELO_NAP.sheetTitle} titleId="km-nap-title"
            sub={KIMELO_NAP.sheetSub} onClose={close} />
          <div className="trm-whyg" role="group" aria-label={KIMELO_NAP.sheetTitle}>
            {SERIOUS_REASONS.map((r) => (
              <button key={r.id} type="button" className={cn('trm-whyc', cat === r.id && 'on')} aria-pressed={cat === r.id}
                style={{ '--c': recoveryHue(r.id) } as CSSProperties} disabled={busy} onClick={() => setCat(r.id)}>
                <Icon3D name={r.icon} size={30} />
                <span>{r.label}</span>
              </button>
            ))}
          </div>
          {cat && (
            <div className="nap-kmdur" style={{ '--kc': recoveryHue(cat) } as CSSProperties}>
              <RecoveryDurationRow value={estimate} disabled={busy}
                onPick={(e) => setEstimate((prev) => (prev === e ? null : e))} />
            </div>
          )}
          <div className="trm-whynote">
            <Icon3D name="t-heart" size={22} />
            <span><b>{KIMELO_NAP.noteLead}</b>{KIMELO_NAP.noteRest}</span>
          </div>
          <div className="uvl-foot nap-kmfoot">
            <button type="button" className="uvl-cta is-wide" disabled={!cat || busy}
              onClick={() => {
                if (!cat) return
                openRecovery.mutate({ category: cat, estimate: estimate ?? 'UNKNOWN' }, {
                  onSuccess: () => {
                    toast.show({ kind: 'success', text: KIMELO.toastOn })
                    close()
                  },
                })
              }}>
              <Icon3D name="t-shield" size={20} />{KIMELO_NAP.cta}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
