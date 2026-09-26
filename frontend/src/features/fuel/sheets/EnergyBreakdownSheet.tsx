import type { CSSProperties, ReactNode } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

// Shared, presentational explanation of a composed daily-energy number (base + movement ± deficit).
// Opened from the Fuel "Mai cél" chips and the Profile Alap-TDEE card; both build the `EnergyBreakdown`
// prop from their own data (no data hooks here). Design: docs/superpowers/specs/2026-07-27-energy-breakdown-explanation-design.md.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi `SH.energy`): a sheet-en belül nincs üveg — az egyenlet egy
// lapos cella, a három szakasz a saját hue-jában árnyalt blokk (a kiemelt fényes kerettel), a
// csempék lapos cellák a Titanium 3D ikonokkal. Emoji nincs.

export type EnergySection = 'base' | 'movement' | 'deficit'
export interface EnergyBlock {
  label: string
  kind: 'gym' | 'sport' | 'run'
  min: number
  kcal: number
}
/** One summand of the served movement (mezo-32m82): the weekly plan's share of the day, and the
 *  unplanned credit. The parts ARE the total — the `+ … =` row closes on `movement.kcal`. */
export interface EnergyPart {
  key: 'planned' | 'extra'
  label: string
  kcal: number
}
export interface EnergyBreakdown {
  base: { kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ' }
  /** `parts` (Fuel, the served day): the summands that close on `kcal`; `blocks` are then only
   *  informational per-session previews, shown without operators. No `parts` (the Én hub's TDEE):
   *  one weekly-average tile. */
  movement: { kcal: number; isWeeklyAvg: boolean; parts?: EnergyPart[]; blocks?: EnergyBlock[] }
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
const signed = (n: number) => (n < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
// HU decimal comma for the small multiplier / rate values (2 fraction digits).
const dec = (n: number) => n.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// One roomy tile: optional 3D icon + name, uppercase sub-label, display value + faint unit.
function Tile({ icon, name, sub, value, unit, result }: {
  icon?: Icon3DName
  name?: string
  sub: string
  value: string
  unit?: string
  result?: boolean
}) {
  return (
    <div className={`flp-etile${result ? ' is-result' : ''}`}>
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

export function EnergyBreakdownSheet({ breakdown, initial, onClose }: {
  breakdown: EnergyBreakdown
  initial: EnergySection
  onClose: () => void
}) {
  const { base, movement, deficit, target } = breakdown
  const hl = (s: EnergySection) => s === initial

  return (
    <Sheet onClose={onClose} labelledBy="energy-breakdown-title">
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
            A napi cél nem statikus — az alapanyagcserédből, {movement.parts ? 'a heti edzésterved mai részéből' : movement.isWeeklyAvg ? 'a heti betáblázott mozgásból' : 'a ma rögzített mozgásodból'}{deficit ? ' és a célod deficitjéből' : ''} áll össze.
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
              <span className="flp-estit">Alaphő · NEAT</span>
              <span className="flp-esamt">{nf(base.kcal)}</span>
            </div>
            <div className="flp-etiles">
              <Tile icon="t-flame" name="Alapanyagcsere" sub={FORMULA_LABEL[base.formula]} value={nf(base.bmr)} unit="kcal" />
              <div className="op">×</div>
              <Tile icon="t-hike" name="NEAT-szorzó" sub={base.neatLabel || 'életmód'} value={dec(base.neat)} unit="×" />
              <div className="op">=</div>
              <Tile result sub="Alaphő" value={nf(base.kcal)} unit="kcal" />
            </div>
            <p className="flp-ewhy">
              Az <b>alapanyagcseréd</b> ({FORMULA_LABEL[base.formula]}) szorozva az <b>életmód-szorzóddal</b>. Ennyit égetsz el egy átlagos napon <b>edzés nélkül</b>.
            </p>
          </Seg>

          {/* MOVEMENT */}
          <Seg tone="amber" on={hl('movement')}>
            <div className="flp-esh">
              <span className="flp-estit">{movement.parts ? 'Mozgás' : 'Betáblázott mozgás'}</span>
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
            {movement.parts && movement.blocks && movement.blocks.length > 0 && (
              <>
                {/* Informational only — the day's sessions are NOT summands of the served total. */}
                <span className="flp-einfo">A mai edzéseid becsült többlete, tájékoztatásul</span>
                <div className="flp-etiles is-info">
                  {movement.blocks.map((b, i) => (
                    <Tile key={i} icon={BLOCK_ICON[b.kind]} name={b.label} sub={`${b.min} perc`} value={nf(b.kcal)} unit="kcal" />
                  ))}
                </div>
              </>
            )}
            <p className="flp-ewhy">
              {movement.parts
                ? <>A heti edzésterved <b>egyenletesen oszlik el</b> a hét napjain (edzésnapon kicsit több jut). A terven kívüli mozgásod aznap hozzáadódik. A becslés a nyugalmi energiád feletti többletet számolja.</>
                : movement.isWeeklyAvg
                  ? <>A <b>heti</b> betáblázott edzéseid becsült energiája (MET-alapú, a testsúlyoddal skálázva). Mozgós napon több, pihenőnapon 0 — <b>ezért nem fix</b> a napi cél.</>
                  : <>A <b>ma</b> rögzített edzéseid becsült energiája (MET-alapú, a testsúlyoddal skálázva). A tervezett, de még el nem végzett edzés nem számít bele — <b>a keret akkor nő, amikor rögzíted</b>.</>}
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
