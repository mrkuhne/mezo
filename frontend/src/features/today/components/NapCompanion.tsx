// ============================================================
// Mezo · NapCompanion — a Nap/Mai jelenlét-jel (visszaöltöztetés, mezo-ju4j6.10).
//
// A Titán-kori jel (folyékony titán szirmok + arany mag, WebGL-jelenettel és lusta three.js
// chunkkal — `TitanCompanion`/`TitanScene`, mezo-mhum) a spec kill-listáján volt. Helyén a
// visszaállított világ jele áll: az AGYAG Mezo-szimbólum, mögötte a szükséglet-színekből
// kevert halo-sáv (stíluskönyv §2.2 C — a régi világ így csinált hőst).
//
// Ez a hely EGYBEN a Boop-avatar foglalt helye (Phase 8b, mezo-ju4j6.15): a méret és a
// pozíció ott már nem mozdul, csak az ábra cserél.
//
// Ami NEM változott: a jel gomb, az „Életjelek" címke, a koppintás az Életjelek felületre
// visz, és az aura az ELSŐ HÁROM szükséglet színét viseli, sávonként halványítva (őszinte,
// de nyugodt) — a szín itt jelentés, nem bőr, ezért marad.
// ============================================================
import type { NeedState } from '@/features/today/logic/needs'
import { NEED_META } from '@/features/today/logic/needs'
import { ClayIcon } from '@/shared/ui/clay'

const AURA_ALPHA: Record<NeedState['band'], number> = {
  green: 0.35,
  yellow: 0.22,
  red: 0.12,
  critical: 0.12,
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

export function NapCompanion({ states, onOpenSignals }: { states: NeedState[]; onOpenSignals: () => void }) {
  const auraVars = Object.fromEntries(
    states.slice(0, 3).map((s, i) => [`--aura-${i}`, withAlpha(NEED_META[s.key].color, AURA_ALPHA[s.band])]),
  ) as React.CSSProperties

  return (
    <button type="button" className="nap-companion" onClick={onOpenSignals} aria-label="Életjelek">
      <span className="nap-companion-halo" style={auraVars} aria-hidden="true" />
      <span className="nap-companion-mark" aria-hidden="true"><ClayIcon name="i-mezo" size={142} /></span>
    </button>
  )
}
