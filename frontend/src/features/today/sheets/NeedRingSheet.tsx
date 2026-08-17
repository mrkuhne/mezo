// ============================================================
// Mezo · NeedRingSheet — one "Életjel-ring" (Sims-style need) opened up into its
// detail sheet (mezo-dhzk, Task 4). Prezentációs: everything it shows comes from the
// `NeedState` the caller (NeedsRow → TodayPage) already computed via `useNeeds` — no
// hook, no data source in here, same doctrine as MezoMessagesSheet. `onCta` is the
// sheet's ONLY side-effecting exit: it fires the ring's quick-log action and TodayPage
// decides what that means (open a sheet, log water, navigate) — this component never
// mutates anything itself.
// `wakeTime`/`bedTime` (SleepGoal, already in TodayPage's scope) are NOT part of
// `NeedState` — the sim only needs a moment-in-time, but the "MA" timeline needs the
// day's own wake→bed span to place today's fills proportionally, so they are their own
// two props rather than smuggled onto the state shape.
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-4-brief.md
// ============================================================
import { cn } from '@/shared/lib/cn'
import { Sheet } from '@/shared/ui/Sheet'
import { NEEDS_TUNING, type NeedKey, type NeedState } from '@/features/today/logic/needs'

const SIZE = 64
const STROKE = 6
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const CENTER = SIZE / 2

const MINUTES_PER_DAY = 24 * 60

/** `HH:mm` for a `Date` — no shared helper for this exists yet (`@/shared/lib/dates` only
 *  has ISO/HU date formatters, not a clock-time one), so a small local one lives here. */
const hhmm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

const toMinuteOfDay = (hhmm2: string): number => {
  const [h, m] = hhmm2.split(':').map(Number)
  return h * 60 + m
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** The quick-log CTA per ring — `rend` has none (no Today surface logs it directly). */
const CTA_LABEL: Partial<Record<NeedKey, string>> = {
  energia: '🍽️ Étkezés logolása',
  hidratacio: '💧 +250 ml — Logolás',
  pihenes: '😴 Alvás logolása',
  mozgas: '💪 Irány a Train',
  lelek: '💗 Check-in',
}

/** "MI TÖLTI?" — static, per-ring, mirrors `NEEDS_TUNING.refill`'s shares in prose. */
const FILLS_TEXT: Record<NeedKey, string> = {
  energia: 'Főétkezés +40% · Snack +15%',
  hidratacio: 'Egy pohár víz (250 ml) +12%',
  pihenes: 'Éjszakai alvás — az órák aránya a célhoz',
  mozgas: 'Edzés/sport/futás → 100% · Aktivitás +25%',
  lelek: 'Check-in +20% · Reggeli szándék +15% · Reflexió/napzárás +25%',
  rend: 'Habit-pipa +12%',
}

/** The forecast strip's refill hint: which quick action refills this ring, and by how
 *  much — `pihenes` has none (the night's sleep sets it, nothing "tops it up" mid-day). */
const REFILL_HINT: Partial<Record<NeedKey, { amount: number; label: string }>> = {
  energia: { amount: NEEDS_TUNING.refill.mainMeal, label: 'Egy főétkezés' },
  hidratacio: { amount: NEEDS_TUNING.refill.waterGlass, label: 'Egy pohár víz' },
  mozgas: { amount: NEEDS_TUNING.refill.activity, label: 'Egy aktivitás' },
  lelek: { amount: NEEDS_TUNING.refill.checkin, label: 'Egy check-in' },
  rend: { amount: NEEDS_TUNING.refill.habitTick, label: 'Egy habit-pipa' },
}

/** `Így {HH:mm} körül nullázódik.` (+ a refill hint, where one applies) when a forecast
 *  exists; the flat "already empty" copy when it's already at 0; else nothing to say. */
function forecastText(state: NeedState): string | null {
  if (state.zeroAt) {
    const hint = REFILL_HINT[state.key]
    const tail = hint
      ? ` ${hint.label} (+${hint.amount}%) ~${Math.round(hint.amount / NEEDS_TUNING.rings[state.key].awakeRate)} órát ad hozzá.`
      : ''
    return `Így ${hhmm(state.zeroAt)} körül nullázódik.${tail}`
  }
  if (state.pct === 0) return 'Lemerült — töltsd fel egy loggal.'
  return null
}

export function NeedRingSheet({ state, wakeTime, bedTime, onClose, onCta }: {
  state: NeedState
  wakeTime: string
  bedTime: string
  onClose: () => void
  onCta: (key: NeedKey) => void
}) {
  const critical = state.band === 'critical'
  const warn = state.band === 'red' || state.band === 'critical'
  const offset = C * (1 - state.pct / 100)
  const ctaLabel = CTA_LABEL[state.key]
  const forecast = forecastText(state)

  // Today's wake→bed span, wrap-aware (an overnight bedTime < wakeTime pushes bed past
  // midnight) — the same minute-of-day math `needs.ts` uses for the sim itself.
  const wakeMin = toMinuteOfDay(wakeTime)
  const bedMin0 = toMinuteOfDay(bedTime)
  const bedMin = bedMin0 <= wakeMin ? bedMin0 + MINUTES_PER_DAY : bedMin0
  const span = bedMin - wakeMin
  const leftOf = (at: Date): number => {
    const raw = at.getHours() * 60 + at.getMinutes()
    const m = raw < wakeMin ? raw + MINUTES_PER_DAY : raw
    return clamp01((m - wakeMin) / span) * 100
  }
  const nowLeft = leftOf(new Date())

  return (
    <Sheet onClose={onClose} labelledBy="need-sheet-title">
      {(close) => (
        <>
          <div className="td-sheet-h">
            <h2 id="need-sheet-title">{state.label}</h2>
            <button type="button" onClick={close}>Kész</button>
          </div>

          <div className="td-need-head">
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
              <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="var(--divider)" strokeWidth={STROKE} />
              <circle
                cx={CENTER} cy={CENTER} r={R} fill="none"
                stroke={critical ? 'var(--error-base)' : state.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
              <text x={CENTER} y="37" textAnchor="middle" fontSize="20">{state.emoji}</text>
            </svg>
            <div className="td-need-head-info">
              <div className="td-need-head-name">{state.label}</div>
              <div className="td-need-head-last">
                {state.lastFill
                  ? `Utolsó log: ${hhmm(state.lastFill.at)} · ${state.lastFill.label}`
                  : 'Ma még nincs log'}
              </div>
            </div>
            <div className={cn('td-need-head-pct', warn && 'is-warn')}>
              <b>{state.pct}%</b>
              <span>−{state.ratePerHour}%/óra</span>
            </div>
          </div>

          {forecast && <div className="td-need-cast">{forecast}</div>}

          {ctaLabel && (
            <button type="button" className="td-cta" onClick={() => { onCta(state.key); close() }}>
              {ctaLabel}
            </button>
          )}

          <div className="td-sec">
            <div className="td-sech"><b>MI TÖLTI?</b></div>
            <div className="td-need-fills"><div>{FILLS_TEXT[state.key]}</div></div>
          </div>

          <div className="td-sec">
            <div className="td-sech"><b>MA</b></div>
            {state.todayFills.length === 0 ? (
              <div className="td-need-tl-empty">Ma még nincs log.</div>
            ) : (
              <div className="td-need-tl">
                <div className="td-need-tl-now" style={{ left: `${nowLeft}%` }}>
                  <span>most</span>
                </div>
                {state.todayFills.map((f, i) => (
                  <div
                    key={i} className="td-need-tl-dot" title={f.label}
                    style={{ left: `${leftOf(f.at)}%` }}
                  >
                    <i />
                    <span>{hhmm(f.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
