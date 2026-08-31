// ============================================================
// Mezo · PeopleHetiPage — Emberek S3 hub, "Heti kép" sibling page (mezo-06o0.2 Task 6)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderHeti() +
// emberek-head.html `.tonemixc`/`.tonemix`/`.mixleg`/`.dirgrid`/`.dirt`/`.arr2`/`.why2`/
// `.wk`/`.momentt`/`.bigq`/`.quiett`/`.nm3`/`.q3` (×1.18, ported as `.ppl-tonemixc`/
// `.ppl-tonemix`/`.ppl-mixleg`/`.ppl-dirgrid`/`.ppl-dirt`/`.ppl-arr2`/`.ppl-why2`/`.ppl-wk`/
// `.ppl-momentt`/`.ppl-bigq`/`.ppl-quiett`/`.ppl-qnm`/`.ppl-qtx` in prototype.css's existing
// ppl- section).
//
// The weekly scope for the tone-mix and "A hét pillanata" is the rolling 7-day window
// measured from the newest mention's OWN timestamp (Task 5's isThisWeek rule — the same
// "hét" scope PeopleEmlitesekPage's chip already uses) — never `Date.now()`, so a mock
// seed frozen in the past still shows a real week's worth of data. "Irányok" and "Csendben
// maradt" instead read `PersonEntry.mentionsThisWeek` directly (a persisted count that can
// legitimately diverge from a live recount of the mentions array — the same field the hub
// tiles and PersonCard already trust), per the brief's own wording ("people with
// mentionsThisWeek > 0" / "mentionsThisWeek===0 személyek").
//
// Honest empty states: no toned mention this week swaps the tone-mix bar for a dashed-card
// line instead of a fabricated 0%-everywhere bar; a null weekMoment omits "A hét pillanata"
// entirely; no quiet person omits "Csendben maradt" entirely — same idiom every other S3
// page in this slice already uses.
//
// `whyLine` below is S3's own DETERMINISTIC stand-in for the "why" line under each
// direction card (majority tone among that person's own week mentions) — S4 replaces this
// with real LLM prose once the memory/insight pipeline can generate it.
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { usePeople } from '@/data/hooks'
import { toneMix, directionFor, quietPeople, weekMoment, trendHeights, type Direction } from '@/features/me/logic/peopleDerive'
import { TONE_META, SRC_META } from '@/features/me/logic/peopleVisuals'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import type { Mention, PersonEntry } from '@/data/types'

// 16px prototype spark height × 1.18 frame scale ≈ 19px — same idiom as PersonCard/kor.
const SPARK_MAX_PX = 19
const DAY_MS = 24 * 60 * 60 * 1000

const DIR_ARROW: Record<Direction, string> = { down: '↘', up: '↗', flat: '→' }
const DIR_COLOR: Record<Direction, string> = {
  down: 'var(--ppl-tone-nehez)',
  up: 'var(--ppl-tone-jo)',
  flat: 'var(--mz-ink-mut)',
}
const DIR_WEIGHT: Record<Direction, number> = { down: 0, up: 1, flat: 2 }

/** Rolling 7-day window measured from the newest mention's own ts (Task 5's rule) —
 *  never Date.now(), so a frozen mock seed still reads as "this week". */
function weeklyMentions(mentions: Mention[]): Mention[] {
  const newestTs = mentions.reduce((max, m) => Math.max(max, new Date(m.ts).getTime()), 0)
  const cutoff = newestTs - 7 * DAY_MS
  return mentions.filter((m) => new Date(m.ts).getTime() >= cutoff)
}

/** S3's deterministic "why" line — majority tone among this PERSON's own week mentions.
 *  Neither positive nor negative holding a strict majority (a tie, a mixed/neutral lead,
 *  or no toned week mention at all) reads honestly as "változó hetek" rather than guessing. */
function whyLine(personWeekMentions: Mention[]): string {
  const toned = personWeekMentions.filter((m) => m.tone)
  if (toned.length === 0) return 'változó hetek'
  const negative = toned.filter((m) => m.tone === 'negative').length
  const positive = toned.filter((m) => m.tone === 'positive').length
  if (negative > toned.length / 2) return 'többször nehéz tónus'
  if (positive > toned.length / 2) return 'sok jó pillanat'
  return 'változó hetek'
}

function DirCard({ person, weekMentions, onTap, delayMs }: {
  person: PersonEntry
  weekMentions: Mention[]
  onTap: () => void
  delayMs: number
}) {
  const direction = directionFor(person.affectTrend)
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
      <div className="ppl-why2">{whyLine(own)}</div>
      <span className="ppl-wk">{person.mentionsThisWeek}× E HÉTEN</span>
    </button>
  )
}

export function PeopleHetiPage() {
  const navigate = useNavigate()
  const { people, mentions, logMention } = usePeople()
  const [quietTarget, setQuietTarget] = useState<PersonEntry | null>(null)

  const weekMentions = weeklyMentions(mentions)
  const slices = toneMix(weekMentions)
  const moment = weekMoment(weekMentions)
  const momentPerson = moment ? people.find((p) => p.id === moment.person_id) : undefined
  const momentSrc = moment ? SRC_META[moment.source] : null
  const momentTone = moment?.tone ? TONE_META[moment.tone] : null

  const directed = people
    .filter((p) => p.mentionsThisWeek > 0)
    .map((p) => ({ person: p, direction: directionFor(p.affectTrend) }))
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
