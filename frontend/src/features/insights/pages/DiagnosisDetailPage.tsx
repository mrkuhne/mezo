// ============================================================
// Mezo · Diagnózis riport — one on-demand report (mezo-hqfi.4).
// Source of truth: mezo-body.html #page-diagnozis-reszlet (round 2, ×1.18).
// Anatomy: hero (the question + the window line) → verdict card with the
// confidence chip → ranked suspect cards: rank 1 gold-ringed (the hub's
// "single decision" language), evidence rows resolved through
// evidenceIndexes with value/delta/source provenance, the probe block and
// the ✓ Próbáljuk ki CTA that flips to the sage acknowledgement → the
// stale footer with ↻ Frissítsd. Writes are live-only.
// Üveg (mezo-me75u.8, prototype uveg-mezo-body.html `diag`): frameless halo hero
// (t-diagnose, window line eyebrow, the question, the verdict, the certainty pill);
// Számvetés = one flat card; rank 1 = THE one `.glass` (amber), ranks 2+ = flat cards
// of the same anatomy. Style: prototype.css `── uveg mezo1 diagnozis (`, `.dgx-page`.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useDiagnosis, useDiagnosisActions } from '@/data/hooks'
import { anchoredWindowLine, confidenceLine, deltaLabel, generatedLabel, strengthLabel, windowLine } from '@/features/insights/logic/diagnosisCopy'
import { questionOf } from '@/features/insights/logic/diagnosisCatalog'
import type { Diagnosis, DiagnosisConfidence, DiagnosisSuspect } from '@/data/types'

/** The certainty meter's fill — a picture of the three-step confidence word, nothing more. */
const CERT_FILL: Record<DiagnosisConfidence, string> = { weak: '33%', moderate: '66%', strong: '100%' }

function SuspectCard({ d, s, live, started, onProbe, delayMs }: {
  d: Diagnosis; s: DiagnosisSuspect; live: boolean; started: boolean
  onProbe: () => void; delayMs: number
}) {
  // Derived (Számvetés) rows are indexable for a suspect's citation but render only once, in
  // the Számvetés card above — never duplicated inside a suspect's own evidence rows.
  const rows = s.evidenceIndexes.map((i) => d.evidence[i]).filter((e) => e != null && e.kind !== 'derived')
  const lead = s.rank === 1
  return (
    <div className={lead ? 'dgx-susp is-lead glass rise' : 'dgx-susp rise'} data-rank={s.rank}
      style={{ '--d': `${delayMs}ms`, '--i': s.rank } as CSSProperties}>
      <div className="dgx-susp-top">
        <span className="dgx-rank">{s.rank}</span>
        <strong className="dgx-susp-t">{s.title}</strong>
        <span className={s.strength === 'strong' ? 'dgx-str is-strong' : 'dgx-str'}>
          {strengthLabel(s.strength)}
        </span>
      </div>
      <p className="dgx-claim">{s.claim}</p>
      {rows.length > 0 && (
        <div className="dgx-evs">
          {rows.map((e, i) => (
            <div key={i} className="dgx-ev">
              <span className="lb">{e.label}</span>
              {e.kind === 'metric' ? (
                <>
                  {e.value !== undefined && <b className="vl">{String(e.value).replace('.', ',')}</b>}
                  {deltaLabel(e.delta) != null && <em className="dl bad">{deltaLabel(e.delta)}</em>}
                </>
              ) : (
                e.detail != null && <b className="vl is-text">{e.detail}</b>
              )}
              {e.sourceHu != null && (
                <small className="src">
                  {e.sourceHu}
                  {e.coverageDays != null ? ` · ${e.coverageDays} nap` : ''}
                </small>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="dgx-probe">
        <Icon3D name="t-flask" size={32} />
        <div>
          <span className="dgx-probe-eb">Próba · {s.totalDays} nap</span>
          <p className="dgx-probe-x">{s.probeText}</p>
        </div>
      </div>
      {started ? (
        <div className="dgx-actual" role="status"><Icon3D name="t-clock" size={20} />Aktív kísérlet lett — a Kísérletek oldalon követed.</div>
      ) : (
        <button type="button" className="dgx-cta" disabled={!live} onClick={onProbe}>
          <Icon3D name="t-tick" size={18} />Próbáljuk ki
        </button>
      )}
    </div>
  )
}

/** The code-computed weight decomposition (mezo-85x5r) — rendered ABOVE the suspects
 *  whenever any evidence item is `kind: 'derived'`. One `.dgx-szrow` per derived item, in
 *  evidence order; these items are the ONLY place they render (suspects cite them by index
 *  but exclude them from their own evidence rows — see `SuspectCard`). One flat card. */
function SzamvetesCard({ derived }: { derived: Diagnosis['evidence'] }) {
  return (
    <section className="dgx-szam rise" data-dgx="szamvetes" style={{ '--d': '0ms' } as CSSProperties}>
      <span className="dgx-sec uv-eyebrow">SZÁMVETÉS</span>
      <div className="dgx-szam-card">
        {derived.map((e, i) => (
          <div key={i} className="dgx-szrow">
            <span className="lb">{e.label}</span>
            {e.detail != null && <b className="vl">{e.detail}</b>}
          </div>
        ))}
      </div>
    </section>
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
      <MozaikPage tone="lav" className="dgx-page">
        <PageHead glass onBack={() => navigate('/mezo/diagnozis')} label="Diagnózis" />
        <PageBody>
          <div className="dgx-empty uv-empty">
            <Icon3D name="t-diagnose" size={44} />
            <p>Ez a riport nincs meg — lehet, hogy törölted.</p>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }
  if (diagnosis == null) {
    return (
      <MozaikPage tone="lav" className="dgx-page">
        <PageHead glass onBack={() => navigate('/mezo/diagnozis')} label="Diagnózis" />
        <PageBody><div className="dgx-loading" aria-busy="true" /></PageBody>
      </MozaikPage>
    )
  }

  const derived = diagnosis.evidence.filter((e) => e.kind === 'derived')
  const heroSub = diagnosis.anchorStart != null
    ? anchoredWindowLine(diagnosis.anchorStart)
    : windowLine(diagnosis.generatedAt, diagnosis.windowDays)

  return (
    <MozaikPage tone="lav" className="dgx-page">
      <PageHead glass onBack={() => navigate('/mezo/diagnozis')} label="Diagnózis" />
      <PageHero art="t-diagnose" accent="var(--dv-lav)" iconSize={78} eyebrow={heroSub}
        name={questionOf(diagnosis.phenomenon)}>
        <p className="dgx-verdict">{diagnosis.verdict}</p>
        <div className="dgx-certrow">
          <span className="dgx-cert">
            <Icon3D name="t-gem" size={22} />
            {confidenceLine(diagnosis.confidence)}
            <i className="uv-bar" aria-hidden="true"><b style={{ '--w': CERT_FILL[diagnosis.confidence] } as CSSProperties} /></i>
          </span>
          <span className="dgx-cert-date">{generatedLabel(diagnosis.generatedAt)}</span>
        </div>
      </PageHero>
      <PageBody>
        <EntranceGroup className="dgx-body">
          {derived.length > 0 && <SzamvetesCard derived={derived} />}

          <span className="dgx-sec uv-eyebrow">Gyanúsítottak · erősség szerint</span>
          <div className="dgx-susps">
            {diagnosis.suspects.map((s) => (
              <SuspectCard key={s.rank} d={diagnosis} s={s} live={live && !pending}
                started={startedRank === s.rank}
                onProbe={() => startExperiment(diagnosis.id, s.rank)}
                delayMs={70 * s.rank} />
            ))}
          </div>

          {diagnosis.stale && (
            <p className="dgx-note">azóta új adatod érkezett a riport ablakában</p>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
