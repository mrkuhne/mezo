// ============================================================
// Mezo · Diagnózis riport — one on-demand report (mezo-hqfi.4).
// Source of truth: mezo-body.html #page-diagnozis-reszlet (round 2, ×1.18).
// Anatomy: hero (the question + the window line) → verdict card with the
// confidence chip → ranked suspect cards: rank 1 gold-ringed (the hub's
// "single decision" language), evidence rows resolved through
// evidenceIndexes with value/delta/source provenance, the probe block and
// the ✓ Próbáljuk ki CTA that flips to the sage acknowledgement → the
// stale footer with ↻ Frissítsd. Writes are live-only.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useDiagnosis, useDiagnosisActions } from '@/data/hooks'
import { confidenceLine, deltaLabel, generatedLabel, strengthLabel, windowLine } from '@/features/insights/logic/diagnosisCopy'
import { questionOf } from '@/features/insights/logic/diagnosisCatalog'
import type { Diagnosis, DiagnosisSuspect } from '@/data/types'

function SuspectCard({ d, s, live, started, onProbe, delayMs }: {
  d: Diagnosis; s: DiagnosisSuspect; live: boolean; started: boolean
  onProbe: () => void; delayMs: number
}) {
  const rows = s.evidenceIndexes.map((i) => d.evidence[i]).filter((e) => e != null)
  return (
    <div className={s.rank === 1 ? 'mzp-pred propcard rise' : 'mzp-pred lav rise'}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={s.rank === 1 ? 'mzp-rankb' : 'mzp-rankb two'}>{s.rank}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</span>
        <span className={s.strength === 'strong' ? 'mzp-stch ok' : 'mzp-stch pend'} style={{ marginLeft: 'auto' }}>
          {strengthLabel(s.strength)}
        </span>
      </div>
      <p style={{ fontSize: 11, fontWeight: 300, lineHeight: 1.55, marginTop: 7 }}>{s.claim}</p>
      <div style={{ marginTop: 8 }}>
        {rows.map((e, i) => (
          <div key={i} className="mzp-evrow">
            <span className="lb">{e.label}</span>
            {e.kind === 'metric' ? (
              <>
                {e.value !== undefined && <span className="vl">{String(e.value).replace('.', ',')}</span>}
                {deltaLabel(e.delta) != null && <span className="dl bad">{deltaLabel(e.delta)}</span>}
              </>
            ) : (
              e.detail != null && <span className="vl">{e.detail}</span>
            )}
            {e.sourceHu != null && (
              <span className="src">
                {e.sourceHu}
                {e.coverageDays != null ? ` · ${e.coverageDays} nap` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mzp-probe">
        <div className="pt">Próba · {s.totalDays} nap</div>
        <div className="px">{s.probeText}</div>
      </div>
      {started ? (
        <div className="mzp-actual">◐ Aktív kísérlet lett — a Kísérletek oldalon követed.</div>
      ) : (
        <div className="mzp-decrow">
          <button type="button" className="mzp-cta" disabled={!live} onClick={onProbe}>✓ Próbáljuk ki</button>
        </div>
      )}
    </div>
  )
}

export function DiagnosisDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { diagnosis, mode, isPending, notFound } = useDiagnosis(id)
  const { startExperiment, startedRank, pending } = useDiagnosisActions()
  const live = mode === 'live'

  if (notFound || (diagnosis == null && !isPending)) {
    return (
      <MozaikPage tone="lav">
        <PageHead onBack={() => navigate('/mezo/diagnozis')} label="‹ Diagnózis" />
        <PageBody>
          <div className="card" style={{ padding: 18, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>Ez a riport nincs meg — lehet, hogy törölted.</p>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }
  if (diagnosis == null) {
    return (
      <MozaikPage tone="lav">
        <PageHead onBack={() => navigate('/mezo/diagnozis')} label="‹ Diagnózis" />
        <PageBody><div className="card" style={{ padding: 18 }} aria-busy="true" /></PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo/diagnozis')} label="‹ Diagnózis" />
      <PageHero name={questionOf(diagnosis.phenomenon)} sub={windowLine(diagnosis.generatedAt, diagnosis.windowDays)} />
      <PageBody>
        <EntranceGroup className="col gap-md">
          <div className="mzp-pred lav rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mzp-stch pend">{confidenceLine(diagnosis.confidence)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mz-ink-mut)', fontVariantNumeric: 'tabular-nums' }}>
                {generatedLabel(diagnosis.generatedAt)}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>{diagnosis.verdict}</p>
          </div>

          {diagnosis.suspects.map((s) => (
            <SuspectCard key={s.rank} d={diagnosis} s={s} live={live && !pending}
              started={startedRank === s.rank}
              onProbe={() => startExperiment(diagnosis.id, s.rank)}
              delayMs={70 * s.rank} />
          ))}

          {diagnosis.stale && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '2px 0 6px' }}>
              <span style={{ fontSize: 10, color: 'var(--mz-ink-mut)' }}>azóta új adatod érkezett a riport ablakában</span>
            </div>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
