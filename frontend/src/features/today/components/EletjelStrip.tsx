// ============================================================
// Mezo · EletjelStrip — a NapMezoPage Életjelek tabjának kompakt státusz-sávja
// (mezo-ho9k): 6 cella (eyebrow + mini ring + %). Az egész sáv egy gomb — a teljes
// /nap/eletjel oldalra visz. Honest states: pending alatt a hívó nem rendereli (nincs
// kitalált százalék). A piros/kritikus cella warn-t kap.
// Üveg (mezo-me75u.3, prototypes/uveg-nap.html#uzenetek/eletjelek): a sáv EGY rose `.glass`
// gomb, benne hat LAPOS mini cella a saját igény-színében (`--c`), mini ringgel a kit ring-
// receptjén (§5); a warn cella coral, coral inset gyűrűvel.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { ClayIconName } from '@/shared/ui/clay'
import type { NeedKey, NeedState } from '@/features/today/logic/needs'
import { VITAL_TILE } from '@/features/today/pages/EletjelPage'

/** Az igények üveg-színe (a §2 sötét Mozaik-akcentusok) — a cella és a nudge-kártya `--c`-je.
 *  A `VITAL_TILE` ink/ring hexei a világos tile-nyelvéi, sötét alapon nem olvashatók. */
export const NEED_HUE: Record<NeedKey, string> = {
  energia: 'var(--dv-sage)',
  hidratacio: 'var(--dv-sky)',
  pihenes: 'var(--dv-lav)',
  mozgas: 'var(--dv-coral)',
  lelek: 'var(--dv-rose)',
  rend: 'var(--dv-amber)',
}

/** Egy nudge-kártya a kiváltó igény ikonját hordozza (`MezoMessageItem.icon`, VITAL_TILE-ból) —
 *  ebből kapja vissza az igény színét. Ismeretlen ikonra `undefined` (a hívó alapszíne marad). */
export function needHueForIcon(icon: ClayIconName | undefined): string | undefined {
  if (!icon) return undefined
  const key = (Object.keys(VITAL_TILE) as NeedKey[]).find((k) => VITAL_TILE[k].icon === icon)
  return key ? NEED_HUE[key] : undefined
}

const R = 15
const CIRC = 2 * Math.PI * R

export function EletjelStrip({ states, onOpen }: { states: NeedState[]; onOpen: () => void }) {
  return (
    <button type="button" className="nap-ejstrip glass rise" style={{ '--d': '40ms', '--c': 'var(--dv-rose)' } as React.CSSProperties}
      onClick={onOpen} aria-label="Életjelek részletei">
      {states.map((s) => {
        const meta = VITAL_TILE[s.key]
        const warn = s.band === 'red' || s.band === 'critical'
        const pct = Math.max(0, Math.min(100, s.pct))
        return (
          <span key={s.key} className={cn('nap-ejcell', warn && 'warn')}
            style={{ '--c': warn ? 'var(--dv-coral)' : NEED_HUE[s.key] } as React.CSSProperties}>
            <span className="eb">{meta.eyebrow}</span>
            <svg className="nap-ejring uv-ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="uv-ring-track" cx="18" cy="18" r={R} strokeWidth="3.5" />
              <circle className="uv-ring-prog" cx="18" cy="18" r={R} strokeWidth="3.5"
                strokeDasharray={`${Math.max(0.5, (pct / 100) * CIRC)} ${CIRC}`} transform="rotate(-90 18 18)" />
            </svg>
            <span className="pct">{s.pct}%</span>
          </span>
        )
      })}
    </button>
  )
}
