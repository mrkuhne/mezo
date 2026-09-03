// ============================================================
// Mezo · Diagnózis — the on-demand report catalog (mezo-hqfi.4).
// Source of truth: mezo-body.html #page-diagnozis (design round 2, ×1.18).
// Anatomy: hero (i-eletjel + count) → the gold-ringed ask card (the live
// question + generate CTA + the quota line — the seam where the paywall
// will later live) → the upcoming-question grid (config-driven, dashed,
// HAMAROSAN) → past reports as predtiles, newest first.
// Honest states: generate is live-only (a real SMART call); 409 → „kevés
// adat", 429 → „napi keret", both rendered as product copy, never as an
// error toast. Empty list → an inviting first-run card, not a blank.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useDiagnoses, useDiagnosisActions } from '@/data/hooks'
import { confidenceLine, generatedLabel, strengthLabel } from '@/features/insights/logic/diagnosisCopy'
import { LIVE_QUESTIONS, UPCOMING_QUESTIONS, questionOf } from '@/features/insights/logic/diagnosisCatalog'


const ERROR_COPY: Record<string, string> = {
  insufficient: 'Kettőnél kevesebb területről van adat az elmúlt két hétben — a Mezo nem tippel.',
  quota: 'Ma már elfogyott a napi kereted — holnap újra kérdezhetsz.',
  failed: 'Most nem sikerült — próbáld újra kicsit később.',
}

export function DiagnosisListPage() {
  const navigate = useNavigate()
  const { diagnoses, mode, isPending } = useDiagnoses()
  const { generateAsync, generating, error } = useDiagnosisActions()
  const live = mode === 'live'
  const heroCount = useCountUp(diagnoses.length)

  const onAsk = async (phenomenon: string) => {
    if (!live || generating) return
    const fresh = await generateAsync(phenomenon).catch(() => null)
    if (fresh) navigate(`/mezo/diagnozis/${fresh.id}`)
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero icon="i-eletjel" name="Diagnózis" big={heroCount}
        sub="kérdések a Mezónak → gyanúsítottak evidenciával → próba" />
      <PageBody>
        <EntranceGroup className="col gap-md">
          {LIVE_QUESTIONS.map((q, qi) => (
            <div key={q.phenomenon} className="mzp-pred propcard rise" style={{ '--d': `${qi * 60}ms` } as React.CSSProperties}>
              <span className="mz-eyebrow" style={{ color: 'var(--mz-qxp-ink)' }}>✦ Kérdezd meg</span>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{q.question}</div>
              <p style={{ fontSize: 11, fontWeight: 300, lineHeight: 1.5, marginTop: 5, color: 'var(--mz-ink-soft)' }}>
                {q.blurb}
              </p>
              <div className="mzp-decrow">
                <button type="button" className="mzp-cta" disabled={!live || generating} onClick={() => onAsk(q.phenomenon)}>
                  {generating ? '… a két hét adatait olvasom' : '✦ Kérdezd meg most'}
                </button>
              </div>
            </div>
          ))}
          {error != null && (
            <p style={{ fontSize: 10.5, color: 'var(--mz-ink-soft)' }}>{ERROR_COPY[error]}</p>
          )}
          <p style={{ fontSize: 9, textAlign: 'center', color: 'var(--mz-ink-mut)' }}>
            {live ? 'napi 3 kérdés · a megnyitás mindig ingyen' : 'demo — a kérdezés az élő appban fut'}
          </p>

          <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>
            További kérdések · a recept kész, sorban jönnek
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {UPCOMING_QUESTIONS.map((q) => (
              <div key={q} className="mzp-dgq">
                <div className="qq">{q}</div>
                <div className="qs">HAMAROSAN</div>
              </div>
            ))}
          </div>

          <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>Korábbi riportok</span>
          {diagnoses.length === 0 && !isPending && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Még nem kérdezted meg. A Mezo az elmúlt két hét adataiból keres okokat.
              </p>
            </div>
          )}
          {diagnoses.map((d, i) => (
            <button key={d.id} type="button" className="mzp-pred lav rise" style={{ '--d': `${70 + i * 70}ms`, textAlign: 'left', width: '100%' } as React.CSSProperties}
              onClick={() => navigate(`/mezo/diagnozis/${d.id}`)} aria-label={`Diagnózis · ${generatedLabel(d.generatedAt)}`}>
              <div className="mz-mrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClayIcon name="i-eletjel" size={19} />
                <span className="mzp-stch pend">{confidenceLine(d.confidence)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mz-ink-mut)', fontVariantNumeric: 'tabular-nums' }}>
                  {generatedLabel(d.generatedAt)}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 7, lineHeight: 1.4 }}>{questionOf(d.phenomenon)}</div>
              <div style={{ fontSize: 11, fontWeight: 300, marginTop: 3, lineHeight: 1.45, color: 'var(--mz-ink-soft)' }}>{d.verdict.split(' — ')[0]}</div>
              <div style={{ fontSize: 10, fontWeight: 300, marginTop: 4, color: 'var(--mz-ink-soft)' }}>
                {d.suspects.length} gyanúsított · a legerősebb: {d.suspects[0]?.title} ({strengthLabel(d.suspects[0]?.strength ?? 'weak')})
              </div>
            </button>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
