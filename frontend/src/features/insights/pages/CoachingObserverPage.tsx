// ============================================================
// Mezo · Megfigyelő — minden szabály verdiktje egy napra (mezo-6269.3,
// spec 2026-09-05 §6.3). A tábla SORRENDJE maga az információ: ez a rangsor
// választotta a napi kártyát. Nap-lapozó (a padló a szerver earliestDate-je),
// szabályonként egy csempe kinyíló bizonyítékkal, alul a nap átmenetei —
// utóbbi csak akkor, ha volt változás (üres doboz helyett semmi).
// Nulla per-flagKey markup: a szerver tömbjét rendereljük, ahogy jött.
// ============================================================
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useCoachingTrace } from '@/data/hooks'
import { CoachingRuleTile } from '@/features/insights/components/CoachingRuleTile'
import { dayLabel, hhmm, splitOf } from '@/features/insights/logic/coachingCopy'
import { addDays, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'

export function CoachingObserverPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = localDateString()
  const asked = params.get('d')
  // A future ?d= is not an error worth a screen — it clamps to today, the FuelLogPage idiom.
  const date = asked != null && asked <= today ? asked : today

  const { day, isPending, isError } = useCoachingTrace(date)
  const split = splitOf(day)
  // The floor is the SERVER's: it knows when tracing started. While it is unknown (unresolved
  // fetch) paging back stays open rather than pretending there is no history.
  const canBack = day.earliestDate == null || date > day.earliestDate
  const canForward = date < today
  const empty = !isPending && !isError && split.total === 0

  const step = (deltaDays: number) => {
    const next = addDays(date, deltaDays)
    setParams((prev) => {
      const q = new URLSearchParams(prev)
      if (next === today) q.delete('d')
      else q.set('d', next)
      return q
    }, { replace: true })
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo/coaching')} label="‹ Coaching" />
      <PageHero name="Megfigyelő"
        sub={split.total === 0 ? undefined : `${split.raised + split.suppressed} jelzett · ${split.total} szabály`}>
        <div className="mzo-daysw">
          <button type="button" aria-label="Előző nap" disabled={!canBack} onClick={() => step(-1)}>‹</button>
          <span className="mzo-dlbl">
            <b>{dayLabel(date, today)}</b>
            <small>{huWeekdayFullIso(date).toLowerCase()}</small>
          </span>
          <button type="button" aria-label="Következő nap" disabled={!canForward} onClick={() => step(1)}>›</button>
        </div>
      </PageHero>
      <PageBody principle="A sorrend a döntés: felül a legsúlyosabb, és pontosan ebből választott a motor.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                Ezt a napot most nem tudom beolvasni — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {empty && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Ezen a napon még nem futott kiértékelés.
              </p>
            </div>
          )}
          {split.total > 0 && split.raised + split.suppressed === 0 && (
            <p style={{ fontSize: 11, color: 'var(--mz-ink-soft)', textAlign: 'center' }}>
              Ma egy szabály sem jelzett — mind a {split.total} rendben.
            </p>
          )}

          {day.rules.map((rule, i) => (
            <CoachingRuleTile key={rule.flagKey} rule={rule}
              winner={rule.flagKey === day.winner?.flagKey} delayMs={40 + i * 30} />
          ))}

          {day.transitions.length > 0 && (
            <>
              <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>A nap változásai</span>
              <div className="mzo-tl">
                {day.transitions.map((t, i) => (
                  <div key={`${t.at}-${t.flagKey}-${i}`} className="mzo-tlrow">
                    <span className="tm">{hhmm(t.at)}</span>
                    <span className="nm">{t.label}</span>
                    <span>{t.reasonText}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
