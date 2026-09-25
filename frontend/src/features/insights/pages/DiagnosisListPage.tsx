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
// Üveg (mezo-me75u.8, prototype uveg-mezo-body.html `diagnozis`): halo hero with
// t-diagnose; the three ask cards are THE glass objects (lavender); upcoming =
// dashed tiles; past reports = flat rows. Style: prototype.css
// `── uveg mezo1 diagnozis (` block, scoped to `.dgx-page`.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useDiagnoses, useDiagnosisActions } from '@/data/hooks'
import { confidenceLine, generatedLabel, strengthLabel } from '@/features/insights/logic/diagnosisCopy'
import { LIVE_QUESTIONS, UPCOMING_QUESTIONS, questionOf } from '@/features/insights/logic/diagnosisCatalog'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'


const ERROR_COPY: Record<string, string> = {
  insufficientData: 'Kettőnél kevesebb területről van adat az elmúlt két hétben — a Mezo nem tippel.',
  insufficientWeighins: 'Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.',
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
    // weight is week-anchored (mezo-85x5r) — the catalog card always diagnoses the current week.
    const anchorStart = phenomenon === 'weight' ? mondayIso() : undefined
    const fresh = await generateAsync(phenomenon, anchorStart).catch(() => null)
    if (fresh) navigate(`/mezo/diagnozis/${fresh.id}`)
  }

  return (
    <MozaikPage tone="lav" className="dgx-page">
      <PageHead glass onBack={() => navigate(ALL_FEATURES_ROUTE)} label="Összes funkció" />
      <PageHero art="t-diagnose" accent="var(--dv-lav)" name="Diagnózis"
        big={<>{heroCount}<small> riport</small></>}
        sub="kérdések a Mezónak → gyanúsítottak evidenciával → próba" />
      <PageBody>
        <EntranceGroup className="dgx-body">
          <div className="dgx-asks">
            {LIVE_QUESTIONS.map((q, qi) => (
              <div key={q.phenomenon} className={generating ? 'dgx-ask glass is-busy rise' : 'dgx-ask glass rise'}
                style={{ '--d': `${qi * 60}ms`, '--i': qi } as React.CSSProperties}>
                <span className="dgx-eb uv-eyebrow"><Icon3D name="t-spark" size={18} /> Kérdezd meg</span>
                <h3 className="dgx-ask-q">{q.question}</h3>
                <p className="dgx-ask-blurb">{q.blurb}</p>
                <button type="button" className="dgx-cta" disabled={!live || generating} onClick={() => onAsk(q.phenomenon)}>
                  {generating ? '… a két hét adatait olvasom' : <><Icon3D name="t-spark" size={18} /> Kérdezd meg most</>}
                </button>
              </div>
            ))}
          </div>
          {error != null && (
            <p className="dgx-note is-error" role="status">{ERROR_COPY[error]}</p>
          )}
          <p className="dgx-note">
            {live ? 'napi 3 kérdés · a megnyitás mindig ingyen' : 'demo — a kérdezés az élő appban fut'}
          </p>

          <span className="dgx-sec uv-eyebrow">További kérdések · a recept kész, sorban jönnek</span>
          <div className="dgx-soon">
            {UPCOMING_QUESTIONS.map((q) => (
              <div key={q} className="dgx-soon-tile uv-empty">
                <div className="qq">{q}</div>
                <div className="qs">HAMAROSAN</div>
              </div>
            ))}
          </div>

          <span className="dgx-sec uv-eyebrow">Korábbi riportok</span>
          {diagnoses.length === 0 && !isPending && (
            <div className="dgx-empty uv-empty">
              <Icon3D name="t-diagnose" size={44} />
              <p>Még nem kérdezted meg. A Mezo az elmúlt két hét adataiból keres okokat.</p>
            </div>
          )}
          {diagnoses.length > 0 && (
            <div className="dgx-reps">
              {diagnoses.map((d, i) => (
                <button key={d.id} type="button" className="dgx-rep rise" style={{ '--d': `${70 + i * 70}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/mezo/diagnozis/${d.id}`)} aria-label={`Diagnózis · ${generatedLabel(d.generatedAt)}`}>
                  <span className="dgx-rep-top">
                    <span className="dgx-chip"><Icon3D name="t-gem" size={16} />{confidenceLine(d.confidence)}</span>
                    <span className="dgx-rep-date">{generatedLabel(d.generatedAt)}</span>
                    <span className="dgx-chev" aria-hidden="true">›</span>
                  </span>
                  <strong className="dgx-rep-q">{questionOf(d.phenomenon)}</strong>
                  <span className="dgx-rep-v">{d.verdict.split(' — ')[0]}</span>
                  <small className="dgx-rep-s">
                    {d.suspects.length} gyanúsított · a legerősebb: {d.suspects[0]?.title} ({strengthLabel(d.suspects[0]?.strength ?? 'weak')})
                  </small>
                </button>
              ))}
            </div>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
