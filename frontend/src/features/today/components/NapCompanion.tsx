// ============================================================
// Mezo · NapCompanion — a Nap/Mai jelenlét-jel (visszaöltöztetés, mezo-ju4j6.10).
//
// A Titán-kori jel (folyékony titán szirmok + arany mag, WebGL-jelenettel és lusta three.js
// chunkkal — `TitanCompanion`/`TitanScene`, mezo-mhum) a spec kill-listáján volt. Helyén
// BOOP áll, mögötte a szükséglet-színekből kevert halo-sáv (stíluskönyv §2.2 C — a régi
// világ így csinált hőst).
//
// A Boop-avatar (Phase 8b, mezo-ju4j6.15) megérkezett ebbe a helyre: a Phase 6 helyőrző
// agyag Mezo-jele helyén maga a figura áll, levendula (a társ saját színe) — a lap arany
// halója adja a kontrasztot. Itt ÉL: tekintet, szemöldök, lélegzet (a mozdulatok a
// prototype.css `boop` blokkjában, csökkentett mozgás mellett kivezetve).
//
// Ami NEM változott: a jel gomb, az „Életjelek" címke, a koppintás az Életjelek felületre
// visz, és az aura az ELSŐ HÁROM szükséglet színét viseli, sávonként halványítva (őszinte,
// de nyugodt) — a szín itt jelentés, nem bőr, ezért marad.
// ============================================================
import type { NeedState } from '@/features/today/logic/needs'
import { NEED_META } from '@/features/today/logic/needs'
import { Boop } from '@/shared/ui/clay'

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
      <span className="nap-companion-mark" aria-hidden="true"><Boop domain="mezo" size={142} alive /></span>
    </button>
  )
}
