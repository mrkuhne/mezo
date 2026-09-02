// ============================================================
// Mezo · EletjelStrip — a NapMezoPage Életjelek tabjának kompakt státusz-sávja
// (mezo-ho9k): 6 cella (eyebrow + mini conic ring + %), az EletjelPage tile-
// nyelvén (VITAL_TILE skin). Az egész sáv egy gomb — a teljes /nap/eletjel
// oldalra visz. Honest states: pending alatt a hívó nem rendereli (nincs
// kitalált százalék). A piros/kritikus cella warn-t kap.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { NeedState } from '@/features/today/logic/needs'
import { VITAL_TILE } from '@/features/today/pages/EletjelPage'

export function EletjelStrip({ states, onOpen }: { states: NeedState[]; onOpen: () => void }) {
  return (
    <button type="button" className="nap-ejstrip rise" style={{ '--d': '40ms' } as React.CSSProperties}
      onClick={onOpen} aria-label="Életjelek részletei">
      {states.map((s) => {
        const meta = VITAL_TILE[s.key]
        const warn = s.band === 'red' || s.band === 'critical'
        return (
          <span key={s.key} className={cn('nap-ejcell', warn && 'warn')}>
            <span className="eb" style={{ color: meta.ink }}>{meta.eyebrow}</span>
            <span className="ej-rr" style={{ '--v': s.pct, '--c': meta.ring } as React.CSSProperties} aria-hidden="true" />
            <span className="pct">{s.pct}%</span>
          </span>
        )
      })}
    </button>
  )
}
