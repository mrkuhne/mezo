import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosisActions } from '@/data/hooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import type { Diagnosis } from '@/data/types'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import type { DiagnosisQuestion } from '@/features/insights/logic/diagnosisCatalog'
import { DAILY_QUOTA } from '@/features/insights/logic/diagnosisTeam'
import { TEAM } from '@/features/insights/logic/team'
import { addDays, huMonthDay } from '@/shared/lib/dates'
import { Icon3D } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'

export const ASK_ERROR_COPY: Record<string, string> = {
  insufficientData: 'Kettőnél kevesebb területről van adat az elmúlt két hétben — a csapat nem tippel.',
  insufficientWeighins: 'Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.',
  quota: 'Ma már elfogyott a napi kereted — holnap újra kérdezhetsz.',
  failed: 'Most nem sikerült — próbáld újra kicsit később.',
}

/** What the host does while the report is generated — the prototype's four steps. They advance
 *  on a timer and the LAST one stays lit until the real response lands (never a fake „kész"). */
const STEPS = ['Összegyűjti az adataidat', 'Összeveti a megszokottal', 'Rangsorolja a gyanúsítottakat', 'Próbát javasol']
const STEP_MS = 1400

function weekLabel(monday: string): string {
  const end = addDays(monday, 6)
  return `${huMonthDay(monday)} – ${huMonthDay(end)}`
}

function Working({ question }: { question: DiagnosisQuestion }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="kt-work" role="status" aria-live="polite">
      <FeedAvatar id={question.host} size={56} />
      <strong>{TEAM[question.host].name} utánanéz</strong>
      <ol className="kt-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'is-done' : i === step ? 'is-on' : undefined}>
            <i aria-hidden="true">{i < step ? '✓' : ''}</i>{label}
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Kérdezd a csapatot — the ask sheet (mezo-u3712, prototype uveg-diagnozis.html `openAsk`): who
 * looks, what they look at, what it costs; the weight question picks a week and reopens an
 * existing non-stale report for it instead of spending a question (the mezo-85x5r lookup).
 */
export function AskTeamSheet({ question, diagnoses, live, left, onClose }: {
  question: DiagnosisQuestion | null
  diagnoses: Diagnosis[]
  live: boolean
  left: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { generateAsync, generating, error } = useDiagnosisActions()
  const [week, setWeek] = useState<'this' | 'last'>('this')
  const thisMonday = mondayIso()
  const anchor = week === 'this' ? thisMonday : addDays(thisMonday, -7)
  const q = question

  const existing = q?.weekAnchored
    ? diagnoses
      .filter((d) => d.phenomenon === q.phenomenon && d.anchorStart === anchor && !d.stale)
      .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0]
    : undefined

  const ask = async () => {
    if (!q || !live || generating) return
    const fresh = await generateAsync(q.phenomenon, q.weekAnchored ? anchor : undefined).catch(() => null)
    if (fresh) navigate(`/mezo/diagnozis/${fresh.id}`)
  }

  const host = q ? TEAM[q.host] : null
  return (
    <GlassBox open={q != null} onClose={onClose} label={q?.question ?? ''}
      eyebrow={host ? `${host.name} nézi meg` : undefined}
      tint={host ? `var(--dv-${host.accent === 'gold' ? 'amber' : host.accent})` : undefined}
      art={q ? <FeedAvatar id={q.host} size={40} /> : undefined}>
      {q && (generating ? <Working question={q} /> : (
        <div className="kt-ask">
          {q.weekAnchored && (
            <div className="kt-weeks" role="group" aria-label="Melyik hét?">
              {(['this', 'last'] as const).map((w) => (
                <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)}>
                  {w === 'this' ? 'Ez a hét' : 'Múlt hét'}
                  <small>{weekLabel(w === 'this' ? thisMonday : addDays(thisMonday, -7))}</small>
                </button>
              ))}
            </div>
          )}
          <p className="kt-ask-note">Ezt nézi meg: {q.window}.</p>
          <div className="kt-looks">{q.looks.map((l) => <span key={l}>{l}</span>)}</div>
          {existing ? (
            <>
              <p className="kt-ask-note"><strong>Erre a hétre már van válaszod</strong> ({huMonthDay(existing.generatedAt.slice(0, 10))}) — azt nyitjuk meg, nem kell új kérdés.</p>
              <button type="button" className="kt-go" onClick={() => navigate(`/mezo/diagnozis/${existing.id}`)}>
                <Icon3D name="t-book" size={20} />Megnyitom a választ
              </button>
            </>
          ) : !live ? (
            <p className="kt-ask-note">demo — a kérdezés az élő appban fut</p>
          ) : left === 0 ? (
            <p className="kt-ask-note">{ASK_ERROR_COPY.quota}</p>
          ) : (
            <>
              <button type="button" className="kt-go" onClick={() => void ask()}>
                <Icon3D name="t-spark" size={20} />Kérdezem
              </button>
              <p className="kt-cost">1 a mai {DAILY_QUOTA} kérdésedből · kb. 20 másodperc</p>
            </>
          )}
          {error != null && <p className="kt-ask-note is-error" role="status">{ASK_ERROR_COPY[error]}</p>}
        </div>
      ))}
    </GlassBox>
  )
}
