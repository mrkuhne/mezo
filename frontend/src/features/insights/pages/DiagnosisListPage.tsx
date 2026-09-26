// ============================================================
// Mezo · Kérdezd a csapatot — the Diagnózis page in the team world (mezo-u3712).
// Parity reference: docs/design_2.0/prototypes/uveg-diagnozis.html `kerdezd` (owner OK
// 2026-09-26). Spec: docs/superpowers/specs/2026-09-26-kerdezd-a-csapatot-design.md.
// Rhythm: back pill (to where you came from) → head → today's quota → the latest answer (the
// page's ONE glass, bible §3.4) → „Mit kérdezel?" (one flat list, every question with its host)
// → „Korábbi válaszok" (flat rows, filterable by host). Asking happens in the AskTeamSheet.
// Honest states: generate is live-only (a real SMART call); the quota line is derived from the
// list and the backend's 429 stays the authority; the empty list invites, never blanks.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDiagnoses } from '@/data/hooks'
import type { AskTeamOrigin } from '@/features/insights/components/AskTeamRow'
import { AskTeamSheet } from '@/features/insights/components/AskTeamSheet'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { LIVE_QUESTIONS, UPCOMING_QUESTIONS, hostOf, questionOf, type DiagnosisQuestion } from '@/features/insights/logic/diagnosisCatalog'
import { confidenceLine, generatedLabel, strengthLabel } from '@/features/insights/logic/diagnosisCopy'
import { DAILY_QUOTA, newestFirst, quotaLeft } from '@/features/insights/logic/diagnosisTeam'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { Icon3D } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'
import '@/features/insights/kerdezd.css'

const DEFAULT_ORIGIN: AskTeamOrigin = { from: '/mezo/csapat', label: 'A csapat' }

/** The certainty meter's fill — a picture of the three-step confidence word, nothing more. */
export const CERT_FILL = { weak: '33%', moderate: '66%', strong: '100%' } as const

function isOrigin(v: unknown): v is AskTeamOrigin {
  return typeof v === 'object' && v != null && typeof (v as AskTeamOrigin).from === 'string'
    && typeof (v as AskTeamOrigin).label === 'string'
}

export function DiagnosisListPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const origin = isOrigin(state) ? state : DEFAULT_ORIGIN
  const { diagnoses, mode, isPending } = useDiagnoses()
  const live = mode === 'live'
  const [filter, setFilter] = useState<TeamCharacterId | 'mind'>('mind')
  const [asking, setAsking] = useState<DiagnosisQuestion | null>(null)

  if (isPending) return <ScreenSkeleton />

  const list = newestFirst(diagnoses)
  const latest = list[0]
  const left = quotaLeft(diagnoses)
  const hosts = [...new Set(list.map((d) => hostOf(d.phenomenon)))]
  const shown = list.filter((d) => filter === 'mind' || hostOf(d.phenomenon) === filter)
  const lastAsked = (phenomenon: string) => list.find((d) => d.phenomenon === phenomenon)

  return (
    <div className="tf-page kt-page">
      <div className="kt-nav">
        <button type="button" className="glass kt-bpill" onClick={() => navigate(origin.from)}>‹ {origin.label}</button>
        <small>Diagnózis</small>
      </div>
      <header className="tf-head">
        <small>A csapat utánanéz</small>
        <h1>Kérdezd a csapatot</h1>
      </header>
      {live && (
        <p className="kt-quota">
          <span className="kt-dots" aria-hidden="true">
            {Array.from({ length: DAILY_QUOTA }, (_, i) => <i key={i} className={i < DAILY_QUOTA - left ? 'is-used' : undefined} />)}
          </span>
          <span>Ma még <strong>{left} kérdés</strong></span>
          <em>a régi válaszok ingyen nyílnak</em>
        </p>
      )}

      {latest ? (
        <Link to={`/mezo/diagnozis/${latest.id}`} className={`glass kt-latest tf-c-${TEAM[hostOf(latest.phenomenon)].accent}`}>
          <span className="kt-lt-top">
            <FeedAvatar id={hostOf(latest.phenomenon)} />
            <span>
              <small>Legutóbbi válasz · {generatedLabel(latest.generatedAt)}</small>
              <strong>{TEAM[hostOf(latest.phenomenon)].name} válaszolt</strong>
            </span>
          </span>
          <span className="kt-lt-q">{questionOf(latest.phenomenon)}</span>
          <span className="kt-lt-v">{latest.verdict}</span>
          <span className="kt-lt-foot">
            <span className="kt-cert"><Icon3D name="t-gem" size={18} />{confidenceLine(latest.confidence)}
              <i aria-hidden="true"><b style={{ width: CERT_FILL[latest.confidence] }} /></i></span>
            <em>Megnyitom ›</em>
          </span>
        </Link>
      ) : (
        <div className="tf-dash">
          <FeedAvatar id="mezo" size={30} />
          <span><strong>Még nem kérdeztél.</strong> Ha valami nem stimmel — fáradt vagy, rosszul alszol, mozog a súlyod —, válassz egy kérdést, és az illetékes csapattag két hét adatából rangsorolt gyanúsítottakat hoz, mindet mért bizonyítékkal.</span>
        </div>
      )}

      <div className="tf-sec"><h2>Mit kérdezel?</h2><span className="tf-hint">Ki nézi meg</span></div>
      <div className="kt-qlist">
        {LIVE_QUESTIONS.map((q) => {
          const who = TEAM[q.host]
          const had = lastAsked(q.phenomenon)
          return (
            <button key={q.phenomenon} type="button" className={`kt-qrow tf-c-${who.accent}`} onClick={() => setAsking(q)}
              aria-label={`${q.question} — ${who.name} nézi meg`}>
              <FeedAvatar id={q.host} size={29} />
              <span className="kt-qtxt">
                <small>{who.name} · {who.area}</small>
                <strong>{q.question}</strong>
                <span>{q.blurb}{had ? ` · utoljára ${generatedLabel(had.generatedAt)}` : ''}</span>
              </span>
              <span className="kt-askpill" aria-hidden="true">Kérdezem</span>
            </button>
          )
        })}
        {UPCOMING_QUESTIONS.map((q) => (
          <div key={q.question} className={`kt-qrow is-soon tf-c-${TEAM[q.host].accent}`}>
            <FeedAvatar id={q.host} size={29} />
            <span className="kt-qtxt">
              <small>{TEAM[q.host].name} · {TEAM[q.host].area}</small>
              <strong>{q.question}</strong>
              <span>a recept kész, sorban jön</span>
            </span>
            <span className="kt-askpill">Hamarosan</span>
          </div>
        ))}
      </div>
      {!live && <p className="tf-note">demo — a kérdezés az élő appban fut</p>}

      {list.length > 0 && (
        <>
          <div className="tf-sec"><h2>Korábbi válaszok</h2><span className="tf-hint">{list.length} válasz</span></div>
          <div className="kt-chips" role="group" aria-label="Szűrés csapattagra">
            <button type="button" aria-pressed={filter === 'mind'} onClick={() => setFilter('mind')}>Mind</button>
            {hosts.map((h) => (
              <button key={h} type="button" aria-pressed={filter === h} onClick={() => setFilter(h)}>
                <FeedAvatar id={h} size={16} />{TEAM[h].name}
              </button>
            ))}
          </div>
          <div className="tf-rows">
            {shown.map((d, i) => {
              const h = hostOf(d.phenomenon)
              return (
                <Link key={d.id} to={`/mezo/diagnozis/${d.id}`} className="kt-past rise"
                  style={{ '--i': i } as CSSProperties} aria-label={`${questionOf(d.phenomenon)} · ${generatedLabel(d.generatedAt)}`}>
                  <FeedAvatar id={h} size={29} />
                  <span className="kt-ptxt">
                    <strong>{questionOf(d.phenomenon)}</strong>
                    <span>{d.verdict}</span>
                  </span>
                  <span className="kt-pmeta">
                    {generatedLabel(d.generatedAt)}
                    {d.stale ? <i className="is-old">Frissíthető</i> : <i>{strengthLabel(d.confidence)}</i>}
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      )}
      <AskTeamSheet question={asking} diagnoses={diagnoses} live={live} left={left} onClose={() => setAsking(null)} />
    </div>
  )
}
