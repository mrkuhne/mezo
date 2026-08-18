// ============================================================
// Mezo · NeedsRow — a 6 "Életjel-ring" (Sims-style needs) sora a MezoChip
// alatt (mezo-dhzk). Prezentációs: az állapotot (`NeedState[]`) és a nyitó
// callbacket a hívó (TodayPage) adja — nincs benne adat-hook, a
// MezoChip.tsx mintáját követi. Minden ring egy 46px-es inline SVG-kör:
// egy `--divider` sínbe rajzolt ív mutatja a `pct`-et, kritikus sávban
// piros ívvel + lüktető halóval (`.td-need-halo`, `todayReducedMotion`
// alatt nyugalomban). A gomb a teljes 44×44 tap-target (`todayTapTargets`).
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-3-brief.md
// ============================================================
import type { NeedKey, NeedState } from '@/features/today/logic/needs'

// A gyűrű LÁTHATÓ külső átmérője `RING`; a rajzterület ennél `PAD`-dal nagyobb minden
// irányban, mert a kör külső éle (és kritikus sávban a haló) különben pont a viewBox
// határára esne, és az antialiasing levágná a tetejét/oldalát — nyolcszögűnek látszott
// (mezo-1bu2). A ring mérete változatlan, csak a körülötte lévő levegő nőtt.
const RING = 46
const STROKE = 4.5
const HALO_GAP = 3.5
const HALO_STROKE = 2
const PAD = 3
const SIZE = RING + 2 * PAD
const R = (RING - STROKE) / 2
const C = 2 * Math.PI * R
const CENTER = SIZE / 2

export function NeedsRow({ states, onOpen }: {
  states: NeedState[]
  onOpen: (key: NeedKey) => void
}) {
  return (
    <div className="td-needs" role="group" aria-label="Életjelek">
      {states.map((s) => {
        const critical = s.band === 'critical'
        const label = `${s.label} ${s.pct}%${critical ? ', kritikus' : ''}`
        const offset = C * (1 - s.pct / 100)
        return (
          <button
            key={s.key}
            type="button"
            className="td-need np-press"
            aria-label={label}
            onClick={() => onOpen(s.key)}
          >
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="var(--divider)" strokeWidth={STROKE} />
              <circle
                cx={CENTER} cy={CENTER} r={R} fill="none"
                stroke={critical ? 'var(--error-base)' : s.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                style={{ transition: 'stroke-dashoffset 400ms var(--ease-out)' }}
              />
              {critical && (
                <circle
                  className="td-need-halo"
                  cx={CENTER} cy={CENTER} r={R + HALO_GAP}
                  fill="none" stroke="var(--error-base)" strokeWidth={HALO_STROKE}
                />
              )}
              <text x={CENTER} y={CENTER + 6} textAnchor="middle" fontSize="15">{s.emoji}</text>
            </svg>
          </button>
        )
      })}
    </div>
  )
}
