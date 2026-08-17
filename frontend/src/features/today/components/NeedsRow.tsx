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

const SIZE = 46
const STROKE = 4.5
const R = (SIZE - STROKE) / 2
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
                  cx={CENTER} cy={CENTER} r={R + 3.5}
                  fill="none" stroke="var(--error-base)" strokeWidth={2}
                />
              )}
              <text x={CENTER} y="29" textAnchor="middle" fontSize="15">{s.emoji}</text>
            </svg>
          </button>
        )
      })}
    </div>
  )
}
