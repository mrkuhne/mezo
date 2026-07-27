import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'

// Shared, presentational explanation of a composed daily-energy number (base + movement ± deficit).
// Opened from the Fuel "Mai cél" chips and the Profile Alap-TDEE card; both build the `EnergyBreakdown`
// prop from their own data (no data hooks here). Design: docs/superpowers/specs/2026-07-27-energy-breakdown-explanation-design.md.

export type EnergySection = 'base' | 'movement' | 'deficit'
export interface EnergyBlock {
  label: string
  kind: 'gym' | 'sport' | 'run'
  min: number
  kcal: number
}
export interface EnergyBreakdown {
  base: { kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ' }
  movement: { kcal: number; isWeeklyAvg: boolean; blocks?: EnergyBlock[] }
  deficit?: { kcal: number; rateKgPerWk: number; goalLabel: string; rationale?: string }
  target: number
}

const BLOCK_EMOJI: Record<EnergyBlock['kind'], string> = { gym: '🏋️', sport: '🏐', run: '🏃' }
const FORMULA_LABEL = { KATCH: 'Katch-McArdle', MSJ: 'Mifflin-St Jeor' } as const

// The app renders plain rounded kcal (no thousands grouping — see the screenshots / BiometricCard).
const nf = (n: number) => String(Math.round(n))
const signed = (n: number) => (n < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
// HU decimal comma for the small multiplier / rate values (2 fraction digits).
const dec = (n: number) => n.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// One roomy tile: optional icon+name header, uppercase sub-label, display value + faint unit.
function Tile({ tone, emoji, name, sub, value, unit, result }: {
  tone?: 'sage' | 'amber' | 'coral'
  emoji?: string
  name?: string
  sub: string
  value: string
  unit?: string
  result?: boolean
}) {
  return (
    <div className={`btile${tone ? ' ' + tone : ''}${result ? ' result' : ''}`}>
      {name && (
        <div className="thd">
          {emoji && <span className="emo">{emoji}</span>}
          <span className="nm">{name}</span>
        </div>
      )}
      <div className="sub">{sub}</div>
      <div className="val">
        {value}
        {unit && <span className="u">{unit}</span>}
      </div>
    </div>
  )
}

export function EnergyBreakdownSheet({ breakdown, initial, onClose }: {
  breakdown: EnergyBreakdown
  initial: EnergySection
  onClose: () => void
}) {
  const { base, movement, deficit, target } = breakdown
  const hl = (s: EnergySection) => (s === initial ? ' hl' : '')

  return (
    <Sheet onClose={onClose} labelledBy="energy-breakdown-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Napi cél</span>
              <h2 id="energy-breakdown-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 19, margin: '3px 0 2px' }}>
                Honnan jön a {nf(target)} kcal?
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.4 }}>
                A napi cél nem statikus — az alapanyagcserédből, a mai betáblázott mozgásból{deficit ? ' és a célod deficitjéből' : ''} áll össze.
              </p>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Equation bar — at-a-glance summary */}
          <div className="eqbar">
            <div className="t base"><div className="k">Alap</div><div className="v">{nf(base.kcal)}</div></div>
            <div className="op">+</div>
            <div className="t move"><div className="k">Mozgás</div><div className="v">{nf(movement.kcal)}</div></div>
            {deficit && (
              <>
                <div className="op">−</div>
                <div className="t def"><div className="k">Deficit</div><div className="v">{nf(Math.abs(deficit.kcal))}</div></div>
              </>
            )}
            <div className="op">=</div>
            <div className="t res"><div className="k">Mai cél</div><div className="v">{nf(target)}</div></div>
          </div>

          {/* BASE */}
          <div className={`seg${hl('base')}`}>
            <div className="sh">
              <span className="sdot dot-sage" />
              <span className="stit txt-sage">Alaphő · NEAT</span>
              <span className="samt txt-sage">{nf(base.kcal)}</span>
            </div>
            <div className="btiles">
              <Tile tone="sage" emoji="🔥" name="Alapanyagcsere" sub={FORMULA_LABEL[base.formula]} value={nf(base.bmr)} unit="kcal" />
              <div className="op">×</div>
              <Tile tone="sage" emoji="🚶" name="NEAT-szorzó" sub={base.neatLabel || 'életmód'} value={dec(base.neat)} unit="×" />
              <div className="op">=</div>
              <Tile result sub="Alaphő" value={nf(base.kcal)} unit="kcal" />
            </div>
            <p className="why">
              Az <b>alapanyagcseréd</b> ({FORMULA_LABEL[base.formula]}) szorozva az <b>életmód-szorzóddal</b>. Ennyit égetsz el egy átlagos napon <b>edzés nélkül</b>.
            </p>
          </div>

          {/* MOVEMENT */}
          <div className={`seg${hl('movement')}`}>
            <div className="sh">
              <span className="sdot dot-amber" />
              <span className="stit txt-amber">Betáblázott mozgás</span>
              <span className="samt txt-amber">{signed(movement.kcal)}</span>
            </div>
            <div className="btiles">
              {movement.blocks && movement.blocks.length > 0 ? (
                <>
                  {movement.blocks.map((b, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      {i > 0 && <div className="op">+</div>}
                      <Tile tone="amber" emoji={BLOCK_EMOJI[b.kind]} name={b.label} sub={`${b.min} perc`} value={nf(b.kcal)} unit="kcal" />
                    </div>
                  ))}
                  <div className="op">=</div>
                  <Tile result sub="Mai mozgás" value={signed(movement.kcal)} unit="kcal" />
                </>
              ) : (
                <Tile tone="amber" emoji="📅" name="Heti átlag" sub="betáblázott ÷ 7" value={signed(movement.kcal)} unit="kcal" />
              )}
            </div>
            <p className="why">
              A <b>{movement.isWeeklyAvg ? 'heti' : 'mai'}</b> betáblázott edzéseid becsült energiája (MET-alapú, a testsúlyoddal skálázva). Mozgós napon több, pihenőnapon 0 — <b>ezért nem fix</b> a napi cél.
            </p>
          </div>

          {/* DEFICIT — a derivation (goal rate → prescribed daily gap), NOT an exact equation:
              the engine's projected rate tracks the real weight trend, so rate×kcalPerKg need not
              reconcile with the daily balance. Hence "→", and 7700 stays a rough guide in the prose. */}
          {deficit && (
            <div className={`seg${hl('deficit')}`}>
              <div className="sh">
                <span className="sdot dot-coral" />
                <span className="stit txt-coral">Deficit · {deficit.goalLabel}</span>
                <span className="samt txt-coral">{signed(deficit.kcal)}</span>
              </div>
              <div className="btiles">
                <Tile tone="coral" emoji="🎯" name="Cél ütem" sub={deficit.goalLabel} value={dec(Math.abs(deficit.rateKgPerWk))} unit="kg/hét" />
                <div className="op">→</div>
                <Tile result sub="Napi deficit" value={signed(deficit.kcal)} unit="kcal" />
              </div>
              <p className="why">
                {deficit.rationale
                  ? deficit.rationale
                  : (
                    <>
                      A <b>{deficit.goalLabel}</b> célod ~<b>{dec(Math.abs(deficit.rateKgPerWk))} kg/hét</b> üteméhez a motor napi ~{nf(Math.abs(deficit.kcal))} kcal deficitet szab (≈7700 kcal / 1 kg zsír, a valós súlytrendedhez igazítva). Ennyivel eszel a fenntartó alatt.
                    </>
                  )}
              </p>
            </div>
          )}
          <div style={{ height: 10 }} />
        </>
      )}
    </Sheet>
  )
}
