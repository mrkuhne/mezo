// ============================================================
// Mezo · PersonDetailPage — Emberek S3 hub, person-detail full page (mezo-06o0.2 Task 4).
// Replaces PersonDetailSheet (a modal) with a real route: `/me/people/:id`, reached from
// the KorPage/HetiPage grid tiles. Source of truth: docs/design_2.0/prototypes/src/
// emberek-body.html renderDet() + emberek-head.html `.trendcard`/`.affbars`/`.affax`/
// `.ctxcard`/`.ctxbar`/`.factcard`/`.fact`/`.pavat.lg` (×1.18, ported as `.ppl-trendcard`/
// `.ppl-affbars`/`.ppl-affax`/`.ppl-ctxcard`/`.ppl-ctxbar`/`.ppl-factcard`/`.ppl-fact`/
// `.ppl-avat-lg` in prototype.css's existing ppl- section). S5 (mezo-06o0.4) adds the
// "Kapcsolt események · gráf" section — `person.graphEdges` rendered `.ppl-lsec`/`.ppl-evt`
// rows (renderDet() order: after "Milyen helyzetekben", before "Amit Mezo tud"), omitted
// entirely when the person has no graph edges.
//
// Query-controlled route guard (house rule): an unknown :id redirects to `/me/people/kor`
// ONLY once `usePeople().isPending` has settled — a pending bootstrap must never look like
// a genuinely-missing person and bounce the user away mid-load.
//
// Honest empty states, same idiom as PersonCard/PeopleKorPage: an empty affectTrend draws
// no bars (a `—` card instead of a fabricated flat line); no context-labeled mentions omits
// the whole "Milyen helyzetekben" card; no knownFacts omits "Amit Mezo tud" entirely.
//
// Üveg (mezo-me75u.7, prototype `ember()`): the person page keeps its own avatar hero — a
// frameless rose halo, the big avatar ringed in the person's TONE (the affect ring's fill kept),
// name + relationship. Flat stat cells (the mood cell in the tone colour); every section is a
// glass card with its eyebrow above it: the mood arc in the person's tone, the contexts rose,
// the graph edges lavender (flat rows inside), the known facts as flat lavender chips (no card),
// the timeline rose (flat rows inside); „Log most" is the lit rose pill with the t-mic.
import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { contextBreakdown, trendAxisLabels, trendHeights } from '@/features/me/logic/peopleDerive'
import { TONE_META, CTX_META, SRC_META, GRAPH_KIND_META, GRAPH_KIND_FALLBACK, toneColor } from '@/features/me/logic/peopleVisuals'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'
import type { Mention } from '@/data/types'

// 44px prototype bar-area height × 1.18 frame scale ≈ 52; the trend bars themselves
// read `trendHeights(trend, TREND_MAX_PX)` for their scaleY(1) target height.
const TREND_MAX_PX = 50
const TIMELINE_MAX = 8

function DetTimelineRow({ mention, delayMs }: { mention: Mention; delayMs?: number }) {
  const src = SRC_META[mention.source]
  const tone = mention.tone ? TONE_META[mention.tone] : TONE_META.neutral
  const ctx = mention.contextLabel ? CTX_META[mention.contextLabel] : null
  const style = {
    '--tc': `var(${tone.cssVar})`,
    ...(delayMs !== undefined ? { '--d': `${delayMs}ms` } : {}),
  } as CSSProperties

  return (
    <div className="ppl-mrowt ppl-tlrow rise" style={style}>
      <Icon3D name={src.art} size={24} />
      <div className="ppl-tlbody">
        <div className="ppl-mtop">
          <span className="ppl-tldot" aria-label={`tónus: ${tone.label}`} role="img" />
          <span className="ppl-mtime">{mention.timeLabel} · {mention.dayLabel}</span>
          {ctx && <span className="ppl-mtiechip">{ctx.label}</span>}
        </div>
        <p className="ppl-mx">„{mention.excerpt}”</p>
      </div>
    </div>
  )
}

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { people, mentions, logMention, isPending } = usePeople()
  const [logOpen, setLogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const person = people.find((p) => p.id === id)

  if (!person) {
    // Pending ≠ missing — never bounce away while the bootstrap is still in flight.
    if (isPending) return null
    return <Navigate to="/me/people/kor" replace />
  }

  const personMentions = mentions.filter((m) => m.person_id === person.id)
  const color = toneColor(person.affect_baseline)
  const last = person.affectTrend[person.affectTrend.length - 1] ?? 0
  const ringPct = Math.max(0, Math.min(100, Math.round((last / 5) * 100)))
  const toneMeta = TONE_META[person.affect_baseline] as (typeof TONE_META)[keyof typeof TONE_META] | undefined
  const trend = trendHeights(person.affectTrend, TREND_MAX_PX)
  const axisLabels = trendAxisLabels(person.affectTrendStart, new Date())
  const hasTrend = trend.length > 0 && axisLabels !== null
  const ctxSlices = contextBreakdown(personMentions)
  const timeline = personMentions.slice(0, TIMELINE_MAX)
  const hasTonelessRow = timeline.some((m) => !m.tone)

  const avatStyle = { '--c': color, '--ac': color, '--av': `${ringPct}%` } as CSSProperties

  return (
    <MozaikPage tone="rose" className="ppl-page ppl-detail">
      <PageHead glass onBack={() => navigate(-1)} label="Vissza">
        <button type="button" className="pgact ppl-act ppl-act-flat" onClick={() => setEditOpen(true)}>
          Szerkesztés
        </button>
      </PageHead>

      <EntranceGroup>
        <section className="mz-page-hero ppl-phero uv-halo" style={{ '--pc': color } as CSSProperties}>
          <div className="ppl-avat-lg" style={avatStyle}>
            <div className="ppl-avin">{person.initial}</div>
          </div>
          <div className="mz-hero-nm">{person.name}</div>
          <div className="mz-hero-sb">
            {person.relationshipHu}{person.contactCadenceLabel ? ` · ${person.contactCadenceLabel}` : ''}
          </div>
        </section>

        <PageBody>
          <StatStrip className="rise ppl-stats">
            <StatCell value={person.mentionCount} label="összes" />
            <StatCell value={`${person.mentionsThisWeek}×`} label="e héten" />
            <StatCell
              value={toneMeta ? <span className="ppl-stat-tone" style={{ '--c': color } as CSSProperties}>{toneMeta.label}</span> : '—'}
              label="hangulat"
            />
          </StatStrip>

          <div className="ppl-lsec rise">
            <span className="mz-eyebrow">Hangulat-ív</span>
          </div>
          <div
            className={`ppl-trendcard rise ${hasTrend ? 'glass' : 'uv-empty'}`}
            style={{ '--c': color, '--i': 2 } as CSSProperties}
          >
            {hasTrend && axisLabels ? (
              <>
                <div className="ppl-affbars">
                  {trend.map((h, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${h}px`,
                        opacity: 0.4 + i * 0.08,
                        '--d': `${200 + i * 50}ms`,
                      } as CSSProperties}
                    />
                  ))}
                </div>
                <div className="ppl-affax">
                  <span>{axisLabels[0]}</span>
                  <span>{axisLabels[1]}</span>
                </div>
              </>
            ) : (
              <p className="ppl-trend-emptytx">— nincs elég adat a hangulat-ívhez</p>
            )}
          </div>

          {ctxSlices.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Milyen helyzetekben</span>
              </div>
              <div className="ppl-ctxcard glass rise" style={{ '--i': 3 } as CSSProperties}>
                {ctxSlices.map((slice) => (
                  <div className="ppl-ctxbar" key={slice.ctx}>
                    <span className="ppl-ctxlb">{CTX_META[slice.ctx].label}</span>
                    <span className="ppl-ctxtr">
                      <div style={{ '--w': `${slice.pct}%`, '--dc': `var(${CTX_META[slice.ctx].cssVar})` } as CSSProperties} />
                    </span>
                    <span className="ppl-ctxpc">{slice.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {person.graphEdges.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Kapcsolt események · gráf</span>
                <span className="ppl-lcnt">{person.graphEdges.length}</span>
              </div>
              <div className="ppl-evtcard glass rise" style={{ '--i': 4 } as CSSProperties}>
                {person.graphEdges.map((edge, i) => {
                  const meta = GRAPH_KIND_META[edge.nodeKind] ?? GRAPH_KIND_FALLBACK
                  return (
                    <button
                      key={`${i}-${edge.nodeKind}-${edge.title}`}
                      type="button"
                      className={`ppl-evt ppl-evt-${meta.tone}`}
                      onClick={() => navigate(`/me/knowledge?kind=${edge.nodeKind}`)}
                    >
                      <span className="ppl-evtpic"><Icon3D name={meta.art} size={30} /></span>
                      <span className="grow">
                        <b>{edge.title}</b>
                        <span className="ppl-evtmt">{meta.label} · {edge.relationHu} · {edge.strength}</span>
                      </span>
                      <span className="ppl-chev" aria-hidden="true">›</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {person.knownFacts.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Amit Mezo tud</span>
              </div>
              <div className="ppl-factcard rise">
                {person.knownFacts.map((fact, i) => (
                  <span key={i} className="ppl-fact">{fact}</span>
                ))}
              </div>
            </>
          )}

          {timeline.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Idővonal</span>
              </div>
              <div className="ppl-tlcard glass rise" style={{ '--i': 5 } as CSSProperties}>
                {timeline.map((mention, i) => (
                  <DetTimelineRow key={mention.id} mention={mention} delayMs={220 + i * 30} />
                ))}
              </div>
            </>
          )}
          {hasTonelessRow && (
            <p className="ppl-foot rise">A tónust az éjszakai kör tölti.</p>
          )}

          <button
            type="button"
            className="ppl-logcta rise"
            onClick={() => setLogOpen(true)}
          >
            <Icon3D name="t-mic" size={20} /> Log most
          </button>
        </PageBody>
      </EntranceGroup>

      {logOpen && (
        <PersonLogSheet
          onClose={() => setLogOpen(false)}
          onSave={logMention}
          people={people}
          initialPersonId={person.id}
        />
      )}

      {editOpen && (
        <PersonEditSheet person={person} onClose={() => setEditOpen(false)} />
      )}
    </MozaikPage>
  )
}
