// ============================================================
// Mezo · PeopleHetiPage — Emberek S3 hub, "Heti kép" sibling page (mezo-06o0.2 Task 6)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderHeti() +
// emberek-head.html `.tonemixc`/`.tonemix`/`.mixleg`/`.dirgrid`/`.dirt`/`.arr2`/`.why2`/
// `.wk`/`.momentt`/`.bigq`/`.quiett`/`.nm3`/`.q3` (×1.18, ported as `.ppl-tonemixc`/
// `.ppl-tonemix`/`.ppl-mixleg`/`.ppl-dirgrid`/`.ppl-dirt`/`.ppl-arr2`/`.ppl-why2`/`.ppl-wk`/
// `.ppl-momentt`/`.ppl-bigq`/`.ppl-quiett`/`.ppl-qnm`/`.ppl-qtx` in prototype.css's existing
// ppl- section).
//
// The weekly scope for the hero, tone-mix and "A hét pillanata" is peopleDerive's shared
// `weekWindow` helper — the rolling 7×24h window measured from the newest mention's OWN
// timestamp (never `Date.now()`), the same window PeopleEmlitesekPage's hero + "Hét"
// scope chip and the hub's `hubLines` all use, so this page's own "N említés e héten"
// always agrees with theirs for the same data. "Irányok" and "Csendben maradt" instead
// read `PersonEntry.mentionsThisWeek` directly (a persisted per-person cadence field that
// can legitimately diverge from a live recount of the mentions array — the same field
// PersonCard already trusts), per the brief's own wording ("people with mentionsThisWeek
// > 0" / "mentionsThisWeek===0 személyek").
//
// Honest empty states: no toned mention this week swaps the tone-mix bar for a dashed-card
// line instead of a fabricated 0%-everywhere bar; a null weekMoment omits "A hét pillanata"
// entirely; no quiet person omits "Csendben maradt" entirely — same idiom every other S3
// page in this slice already uses.
//
// Emberek S6 (mezo-06o0.8): the direction card now reads the server's own
// `person.direction`/`person.directionReason` — computed from the real toned mentions by
// `PersonAffectTrendCalculator`, the single source of truth the backend and this page now
// share. S3's local `whyLine` (a deterministic majority-tone stand-in for the "why" line,
// explicitly temporary per its own comment) is retired along with it.
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { usePeople } from '@/data/hooks'
import { toneMix, quietPeople, weekMoment, trendHeights, weekWindow } from '@/features/me/logic/peopleDerive'
import { TONE_META, SRC_META } from '@/features/me/logic/peopleVisuals'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import type { Mention, PersonEntry } from '@/data/types'

// 16px prototype spark height × 1.18 frame scale ≈ 19px — same idiom as PersonCard/kor.
const SPARK_MAX_PX = 19

type Direction = PersonEntry['direction']
const DIR_ARROW: Record<Direction, string> = { down: '↘', up: '↗', flat: '→' }
const DIR_COLOR: Record<Direction, string> = {
  down: 'var(--ppl-tone-nehez)',
  up: 'var(--ppl-tone-jo)',
  flat: 'var(--mz-ink-mut)',
}
const DIR_WEIGHT: Record<Direction, number> = { down: 0, up: 1, flat: 2 }

function DirCard({ person, weekMentions, onTap, delayMs }: {
  person: PersonEntry
  weekMentions: Mention[]
  onTap: () => void
  delayMs: number
}) {
  const direction = person.direction
  const own = weekMentions.filter((m) => m.person_id === person.id)
  const style = { '--d': `${delayMs}ms` } as CSSProperties

  return (
    <button type="button" className={`ppl-dirt ${direction} rise`} style={style} onClick={onTap}>
      <div className="row" style={{ gap: 7, width: '100%' }}>
        <span className="ppl-mavat">{person.initial}</span>
        <b style={{ fontSize: 10.5 }}>{person.name}</b>
        <span className="ppl-arr2" style={{ color: DIR_COLOR[direction], marginLeft: 'auto' }}>{DIR_ARROW[direction]}</span>
      </div>
      {own.length > 0 && (
        <div className="ppl-spark">
          {trendHeights(person.affectTrend, SPARK_MAX_PX).map((h, i) => (
            <i key={i} style={{ height: `${h}px`, background: DIR_COLOR[direction], opacity: 0.45 + i * 0.07 } as CSSProperties} />
          ))}
        </div>
      )}
      {person.directionReason && <div className="ppl-why2">{person.directionReason}</div>}
      <span className="ppl-wk">{person.mentionsThisWeek}× E HÉTEN</span>
    </button>
  )
}

export function PeopleHetiPage() {
  const navigate = useNavigate()
  const { people, mentions, logMention } = usePeople()
  const [quietTarget, setQuietTarget] = useState<PersonEntry | null>(null)

  const { inWindow } = weekWindow(mentions, new Date())
  const weekMentions = mentions.filter(inWindow)
  const slices = toneMix(weekMentions)
  const moment = weekMoment(weekMentions)
  const momentPerson = moment ? people.find((p) => p.id === moment.person_id) : undefined
  const momentSrc = moment ? SRC_META[moment.source] : null
  const momentTone = moment?.tone ? TONE_META[moment.tone] : null

  const directed = people
    .filter((p) => p.mentionsThisWeek > 0)
    .map((p) => ({ person: p, direction: p.direction }))
    .sort((a, b) => DIR_WEIGHT[a.direction] - DIR_WEIGHT[b.direction])

  const quiet = quietPeople(people)

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/people')} label="‹ Kapcsolatok" />

      <PageHero icon="i-heti" name="Heti kép" big={weekMentions.length} sub="említés e héten" />

      <PageBody>
        <EntranceGroup>
          <div className="ppl-tonemixc rise" style={{ '--d': '0ms' } as CSSProperties}>
            <div className="mz-tile-top">
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>A hét tónusa</span>
              <span className="ppl-mixcnt">{weekMentions.length} említés</span>
            </div>
            {slices.length > 0 ? (
              <>
                <div className="ppl-tonemix">
                  {slices.map((slice, i) => (
                    <i
                      key={slice.tone}
                      style={{ width: `${slice.pct}%`, background: `var(${TONE_META[slice.tone].cssVar})`, '--d': `${150 + i * 120}ms` } as CSSProperties}
                    />
                  ))}
                </div>
                <div className="ppl-mixleg">
                  {slices.map((slice) => (
                    <span key={slice.tone}>
                      <i style={{ background: `var(${TONE_META[slice.tone].cssVar})` } as CSSProperties} />
                      {slice.count} {TONE_META[slice.tone].label.toLowerCase()}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="ppl-empty" style={{ marginTop: 9 }}>Még nincs tónusozott említés ezen a héten.</p>
            )}
          </div>

          {directed.length > 0 && (
            <>
              <div className="ppl-lsec rise" style={{ '--d': '40ms' } as CSSProperties}>
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Irányok · 7 nap</span>
              </div>
              <div className="ppl-dirgrid">
                {directed.map(({ person }, i) => (
                  <DirCard
                    key={person.id}
                    person={person}
                    weekMentions={weekMentions}
                    delayMs={60 + i * 30}
                    onTap={() => navigate(`/me/people/${person.id}`)}
                  />
                ))}
              </div>
            </>
          )}

          {moment && momentPerson && momentSrc && (
            <>
              <div className="ppl-lsec rise" style={{ '--d': '120ms' } as CSSProperties}>
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>A hét pillanata</span>
              </div>
              <div className="ppl-momentt rise" style={{ '--d': '140ms' } as CSSProperties}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="ppl-mavat">{momentPerson.initial}</span>
                  <div className="col" style={{ flex: 1 }}>
                    <b style={{ fontSize: 10 }}>{momentPerson.name}</b>
                    <span className="ppl-mt">{moment.dayLabel} {moment.timeLabel} · {momentSrc.label}</span>
                  </div>
                  {momentTone && (
                    <span
                      aria-hidden="true"
                      style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${momentTone.cssVar})`, flex: 'none' } as CSSProperties}
                    />
                  )}
                </div>
                <div className="ppl-bigq">„{moment.excerpt}”</div>
              </div>
            </>
          )}

          {quiet.length > 0 && (
            <>
              <div className="ppl-lsec rise" style={{ '--d': '170ms' } as CSSProperties}>
                <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-mut)' }}>Csendben maradt</span>
                <span className="ppl-cnt">{quiet.length}</span>
              </div>
              {quiet.map((person, i) => (
                <div key={person.id} className="ppl-quiett rise" style={{ '--d': `${190 + i * 30}ms` } as CSSProperties}>
                  <span className="ppl-mavat">{person.initial}</span>
                  <div className="col" style={{ flex: 1 }}>
                    <div className="ppl-qnm">{person.name}</div>
                    <div className="ppl-qtx">{person.lastMentionLabel} — jólesne neki egy jel?</div>
                  </div>
                  <button type="button" className="cta-ghost" style={{ padding: '4px 10px', fontSize: 9 }} onClick={() => setQuietTarget(person)}>
                    Írok neki
                  </button>
                </div>
              ))}
            </>
          )}

          <p className="ppl-foot rise" style={{ '--d': '240ms' } as CSSProperties}>
            Az irányok és a tónus-sáv az e heti említésekből jönnek — a hétfői heti áttekintés erre is kitér.
          </p>
        </EntranceGroup>
      </PageBody>

      {quietTarget && (
        <PersonLogSheet
          onClose={() => setQuietTarget(null)}
          onSave={logMention}
          people={people}
          initialPersonId={quietTarget.id}
        />
      )}
    </MozaikPage>
  )
}
