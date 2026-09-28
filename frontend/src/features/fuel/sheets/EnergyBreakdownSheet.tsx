import { type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { CONFIDENCE_WORD } from '@/features/fuel/sheets/learnedBaseFormat'

// Shared, presentational explanation of a composed daily-energy number (base + movement ± deficit).
// Opened from the Fuel "Mai cél" chips and the Profile Alap-TDEE card; both build the `EnergyBreakdown`
// prop from their own data (no data hooks here). Design: docs/superpowers/specs/2026-07-27-energy-breakdown-explanation-design.md.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi `SH.energy`): a sheet-en belül nincs üveg — az egyenlet egy
// lapos cella, a három szakasz a saját hue-jában árnyalt blokk (a kiemelt fényes kerettel), a
// csempék lapos cellák a Titanium 3D ikonokkal. Emoji nincs.
// U10 (mezo-me75u.10): maga a lap is a közös lebegő zsálya üveglap (`<Sheet glass>`).

export type EnergySection = 'base' | 'movement' | 'deficit'
export interface EnergyBlock {
  label: string
  kind: 'gym' | 'sport' | 'run'
  min: number
  kcal: number
  /** Actually logged (mezo-tb3s2) vs. still-scheduled and not yet logged. */
  done: boolean
}
/** One summand of the served movement (mezo-32m82): the weekly plan's share of the day, and the
 *  unplanned credit. The parts ARE the total — the `+ … =` row closes on `movement.kcal`. */
export interface EnergyPart {
  key: 'planned' | 'extra'
  label: string
  kcal: number
}
export interface EnergyBreakdown {
  base: {
    kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ'
    /** Learned-base provenance (mezo-zz91i). Absent/`'formula'` → the BMR × NEAT tiles (unchanged). */
    source?: 'formula' | 'learned'
    /** BMR × NEAT, shown next to a learned base. */
    formulaKcal?: number
    /** Learned base uncertainty (±1 SD kcal); null for formula. */
    sdKcal?: number | null
    confidence?: 'low' | 'medium' | 'high' | null
  }
  /** `parts` (Fuel, the served day): the summands that close on `kcal`; `blocks` are then only
   *  informational per-session previews, shown without operators. No `parts` (the Én hub's TDEE):
   *  one weekly-average tile. */
  movement: {
    kcal: number; isWeeklyAvg: boolean; parts?: EnergyPart[]; blocks?: EnergyBlock[]
    /** Today's not-yet-logged planned sessions' estimated kcal (mezo-tb3s2) — display only, absent
     *  on the Én hub's weekly-average path. */
    pending?: number
    /** Section title override for the weekly-average path (no `parts`) — the Én hub's own
     *  `buildTdeeBreakdown` (mezo-tb3s2). Falls back to the generic label below. */
    label?: string
  }
  deficit?: { kcal: number; rateKgPerWk: number; goalLabel: string; rationale?: string }
  target: number
}

const BLOCK_ICON: Record<EnergyBlock['kind'], Icon3DName> = { gym: 't-dumbbell', sport: 't-volley', run: 't-run' }
const PART_TILE: Record<EnergyPart['key'], { icon: Icon3DName; sub: string }> = {
  planned: { icon: 't-calendar', sub: 'edzésterv' },
  extra: { icon: 't-steps', sub: 'rögzítve, terven kívül' },
}
const SEG_COLOR = { sage: 'var(--dv-sage)', amber: 'var(--dv-amber)', coral: 'var(--dv-coral)' } as const
const FORMULA_LABEL = { KATCH: 'Katch-McArdle', MSJ: 'Mifflin-St Jeor' } as const

// The app renders plain rounded kcal (no thousands grouping — see the screenshots / BiometricCard).
const nf = (n: number) => String(Math.round(n))
// Confidence line SD, rounded to the nearest 10 kcal (mezo-zz91i) — the uncertainty is not that precise.
const round10 = (n: number) => Math.round(n / 10) * 10
const signed = (n: number) => (n < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
// HU decimal comma for the small multiplier / rate values (2 fraction digits).
const dec = (n: number) => n.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// One roomy tile: optional 3D icon + name, uppercase sub-label, display value + faint unit.
function Tile({ icon, name, sub, value, unit, result, pending }: {
  icon?: Icon3DName
  name?: string
  sub: string
  value: string
  unit?: string
  result?: boolean
  /** Still-scheduled, not-yet-logged preview (mezo-tb3s2) — faint, no fill. */
  pending?: boolean
}) {
  return (
    <div className={`flp-etile${result ? ' is-result' : ''}${pending ? ' is-pending' : ''}`}>
      {icon && <Icon3D name={icon} size={36} />}
      <div className="flp-etile-val">
        {value}
        {unit && <span className="u">{unit}</span>}
      </div>
      {name && <span className="flp-etile-nm">{name}</span>}
      <div className="flp-etile-sub">{sub}</div>
    </div>
  )
}

function Seg({ tone, on, children }: { tone: keyof typeof SEG_COLOR; on: boolean; children: ReactNode }) {
  return (
    <div className={`flp-eblk${on ? ' is-hl' : ''}`} style={{ '--c': SEG_COLOR[tone] } as CSSProperties}>
      {children}
    </div>
  )
}

// „Hogy tanultam?” (mezo-3n2so, elo/fuel.html `learnedFoot()`): the learned Alap block ends in ONE
// summary line — the learned base's word + σ̂ — and „Részletek ›” to the learning page, where the
// six-section explainer now lives (with the week-by-week chart and the day switches). Rendered only
// on the learned path, so the formula path (and the Én hub's TDEE) never needs a router.
function LearnedSummaryLink({ line, onClose }: { line: string; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="flp-how-btn" onClick={() => { onClose(); navigate('/fuel/tanulas') }}>
      <Icon3D name="t-lens" size={30} />
      <span className="lbl">{line}<small>Hogy tanultam? — hétről hétre, és a napjaid</small></span>
      <span className="more">Részletek ›</span>
    </button>
  )
}

export function EnergyBreakdownSheet({ breakdown, initial, onClose }: {
  breakdown: EnergyBreakdown
  initial: EnergySection
  onClose: () => void
}) {
  const { base, movement, deficit, target } = breakdown
  const hl = (s: EnergySection) => s === initial

  return (
    <Sheet glass onClose={onClose} labelledBy="energy-breakdown-title" className="uvl-fuel">
      {(close) => (
        <>
          <div className="flp-eh">
            <Icon3D name="t-ring" size={48} />
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="uv-eyebrow">Napi cél</span>
              <h2 id="energy-breakdown-title">
                Honnan jön a {nf(target)} kcal?
              </h2>
            </div>
            <button className="flp-x" onClick={close} aria-label="Bezárás">
              <Icon name="x" size={12} />
            </button>
          </div>
          <p className="flp-elead">
            {movement.isWeeklyAvg
              ? <>A napi cél nem statikus — az alapanyagcserédből, a heti betáblázott mozgásból{deficit ? ' és a célod deficitjéből' : ''} áll össze.</>
              : 'A napi cél nem statikus — az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.'}
          </p>

          {/* Equation bar — at-a-glance summary */}
          <div className="flp-eq">
            <div className="t base"><div className="v">{nf(base.kcal)}</div><div className="k">Alap</div></div>
            <div className="op">+</div>
            <div className="t move"><div className="v">{nf(movement.kcal)}</div><div className="k">Mozgás</div></div>
            {deficit && (
              <>
                <div className="op">−</div>
                <div className="t def"><div className="v">{nf(Math.abs(deficit.kcal))}</div><div className="k">Deficit</div></div>
              </>
            )}
            <div className="op">=</div>
            <div className="t res"><div className="v">{nf(target)}</div><div className="k">Mai cél</div></div>
          </div>

          {/* BASE */}
          <Seg tone="sage" on={hl('base')}>
            <div className="flp-esh">
              <span className="flp-estit">{base.source === 'learned' ? 'Alap · tanult' : 'Alaphő · NEAT'}</span>
              <span className="flp-esamt">{nf(base.kcal)}</span>
            </div>
            {base.source === 'learned' ? (
              <>
                <div className="flp-etiles">
                  {base.formulaKcal != null && (
                    <>
                      <Tile icon="t-hike" name="Képlet szerint" sub="BMR × NEAT" value={nf(base.formulaKcal)} unit="kcal" />
                      <div className="op">→</div>
                    </>
                  )}
                  <Tile result sub="Tanult alap" value={nf(base.kcal)} unit="kcal" />
                </div>
                <p className="flp-ewhy">
                  Ennyit égetsz <b>edzés nélkül</b> — az app a <b>súlytrendedből és a felírt evésedből</b> tanulta meg.
                  {base.formulaKcal != null && <> A képlet {nf(base.formulaKcal)} kcal-t mondana.</>}
                </p>
                <LearnedSummaryLink
                  onClose={onClose}
                  line={['Tanult alap', base.confidence && CONFIDENCE_WORD[base.confidence], base.sdKcal != null && `±${nf(round10(base.sdKcal))} kcal`]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </>
            ) : (
              <>
                <div className="flp-etiles">
                  <Tile icon="t-flame" name="Alapanyagcsere" sub={FORMULA_LABEL[base.formula]} value={nf(base.bmr)} unit="kcal" />
                  <div className="op">×</div>
                  <Tile icon="t-hike" name="NEAT-szorzó" sub={base.neatLabel || 'életmód'} value={dec(base.neat)} unit="×" />
                  <div className="op">=</div>
                  <Tile result sub="Alaphő" value={nf(base.kcal)} unit="kcal" />
                </div>
                <span className="flp-einfo">Képlet alapján</span>
                <p className="flp-ewhy">
                  Az <b>alapanyagcseréd</b> ({FORMULA_LABEL[base.formula]}) szorozva az <b>életmód-szorzóddal</b>. Ennyit égetsz el egy átlagos napon <b>edzés nélkül</b>.
                </p>
              </>
            )}
          </Seg>

          {/* MOVEMENT */}
          <Seg tone="amber" on={hl('movement')}>
            <div className="flp-esh">
              <span className="flp-estit">{movement.parts ? 'Mozgás · ma logolva' : movement.label ?? 'Betáblázott mozgás'}</span>
              <span className="flp-esamt">{signed(movement.kcal)}</span>
            </div>
            <div className="flp-etiles">
              {movement.parts ? (
                <>
                  {movement.parts.map((p, i) => (
                    <div key={p.key} style={{ display: 'contents' }}>
                      {i > 0 && <div className="op">+</div>}
                      <Tile icon={PART_TILE[p.key].icon} name={p.label} sub={PART_TILE[p.key].sub} value={nf(p.kcal)} unit="kcal" />
                    </div>
                  ))}
                  <div className="op">=</div>
                  <Tile result sub="Mai mozgás" value={signed(movement.kcal)} unit="kcal" />
                </>
              ) : (
                <Tile icon="t-calendar" name="Heti átlag" sub="betáblázott ÷ 7" value={signed(movement.kcal)} unit="kcal" />
              )}
            </div>
            {movement.parts && movement.blocks && movement.blocks.some(b => b.done) && (
              <>
                {/* Informational only — the day's sessions are NOT summands of the served total. */}
                <span className="flp-einfo">A mai edzéseid becsült többlete, tájékoztatásul</span>
                <div className="flp-etiles is-info">
                  {movement.blocks.filter(b => b.done).map((b, i) => (
                    <Tile key={i} icon={BLOCK_ICON[b.kind]} name={b.label} sub={`${b.min} perc`} value={nf(b.kcal)} unit="kcal" />
                  ))}
                </div>
              </>
            )}
            {movement.parts && (movement.pending ?? 0) > 0 && (
              <>
                {/* Not yet logged — previewed separately, still not a summand of `kcal` (mezo-tb3s2). */}
                <span className="flp-einfo">Még jön, ha megcsinálod · a keretben még nincs benne</span>
                <div className="flp-etiles is-info">
                  {(movement.blocks ?? []).filter(b => !b.done).map((b, i) => (
                    <Tile key={i} icon={BLOCK_ICON[b.kind]} name={b.label} sub={`tervezett · ${b.min} perc`} value={`+${nf(b.kcal)}`} unit="kcal" pending />
                  ))}
                </div>
              </>
            )}
            <p className="flp-ewhy">
              {movement.parts
                ? <>A keret <b>akkor nő, amikor rögzíted</b> az edzést — a tervezett, még meg nem csinált edzés csak halványan látszik. A becslés a nyugalmi energiád feletti többletet számolja; ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.</>
                : <>A <b>heti</b> edzésterved napi átlaga — a nyugalmi energiád feletti többlet, a saját alapanyagcseréd alapján.</>}
            </p>
          </Seg>

          {/* DEFICIT — a derivation (goal rate → prescribed daily gap), NOT an exact equation:
              the engine's projected rate tracks the real weight trend, so rate×kcalPerKg need not
              reconcile with the daily balance. Hence "→", and 7700 stays a rough guide in the prose. */}
          {deficit && (
            <Seg tone="coral" on={hl('deficit')}>
              <div className="flp-esh">
                <span className="flp-estit">Deficit · {deficit.goalLabel}</span>
                <span className="flp-esamt">{signed(deficit.kcal)}</span>
              </div>
              <div className="flp-etiles">
                <Tile icon="t-ring" name="Cél ütem" sub={deficit.goalLabel} value={dec(Math.abs(deficit.rateKgPerWk))} unit="kg/hét" />
                <div className="op">→</div>
                <Tile result sub="Napi deficit" value={signed(deficit.kcal)} unit="kcal" />
              </div>
              <p className="flp-ewhy">
                {deficit.rationale
                  ? deficit.rationale
                  : (
                    <>
                      A <b>{deficit.goalLabel}</b> célod ~<b>{dec(Math.abs(deficit.rateKgPerWk))} kg/hét</b> üteméhez a motor napi ~{nf(Math.abs(deficit.kcal))} kcal deficitet szab (≈7700 kcal / 1 kg zsír, a valós súlytrendedhez igazítva). Ennyivel eszel a fenntartó alatt.
                    </>
                  )}
              </p>
            </Seg>
          )}
          <div style={{ height: 10 }} />
        </>
      )}
    </Sheet>
  )
}
