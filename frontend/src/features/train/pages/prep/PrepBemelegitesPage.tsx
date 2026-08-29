// ============================================================
// Mezo · PrepBemelegitesPage — the prep mosaic's Bemelegítés tile opened into
// its own page (mezo-d20.3.8). Source: session-body.html #page-warm. Compact
// hero (total minutes) + stat strip + the fixed 3-block protocol list — same
// static WARMUP_ROWS the old prep screen showed inline; a niggle-aware note
// only renders when today's plan actually flags one (honest, not decorative).
// ============================================================
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { ClayIcon } from '@/shared/ui/clay'

export interface WarmupRow { label: string; time: string; minutes: number }

export function PrepBemelegitesPage({ rows, niggleNote, onBack }: {
  rows: readonly WarmupRow[]
  niggleNote: string | null
  onBack: () => void
}) {
  const totalMin = rows.reduce((s, w) => s + w.minutes, 0)
  return (
    <MozaikPage tone="sky">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <PageHero icon="i-lang" big={`${totalMin}′`} name="Bemelegítés" />
      <PageBody principle="Fix protokoll — a gyakorlat-szintű bemelegítő szettek (B1, B2) már az edzésben élnek.">
        <StatStrip className="mt-sm">
          <StatCell value={`${totalMin}′`} label="összesen" />
          <StatCell value={rows.length} label="blokk" />
          {niggleNote && <StatCell value="✓" label="niggle-tudatos" />}
        </StatStrip>
        <div className="col gap-sm mt-md">
          {rows.map((w, i) => (
            <div key={i} className="row" style={{ padding: '10px 14px', alignItems: 'center', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--np-shadow-row)' }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral-deep)', marginRight: 12 }}>0{i + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{w.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--text-tertiary)' }}>{w.time}</span>
            </div>
          ))}
        </div>
        {niggleNote && (
          <div className="mz-qcard mt-md">
            <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
              <ClayIcon name="i-eletjel" size={22} />
              <div className="mz-qgrow">
                <div className="mz-qtitle" style={{ fontSize: 12 }}>Ma ez duplán számít</div>
                <div className="mz-qwhy">{niggleNote}</div>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </MozaikPage>
  )
}
