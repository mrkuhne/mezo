// ============================================================
// Mezo · PersonDetailPage — Emberek S3 hub, person-detail full page (mezo-06o0.2 Task 4).
// Replaces PersonDetailSheet (a modal) with a real route: `/me/people/:id`, reached from
// the KorPage/HetiPage grid tiles. Source of truth: docs/design_2.0/prototypes/src/
// emberek-body.html renderDet() + emberek-head.html `.trendcard`/`.affbars`/`.affax`/
// `.ctxcard`/`.ctxbar`/`.factcard`/`.fact`/`.pavat.lg` (×1.18, ported as `.ppl-trendcard`/
// `.ppl-affbars`/`.ppl-affax`/`.ppl-ctxcard`/`.ppl-ctxbar`/`.ppl-factcard`/`.ppl-fact`/
// `.ppl-avat-lg` in prototype.css's existing ppl- section). NO "Kapcsolt események" here
// — that's S5's job.
//
// Query-controlled route guard (house rule): an unknown :id redirects to `/me/people/kor`
// ONLY once `usePeople().isPending` has settled — a pending bootstrap must never look like
// a genuinely-missing person and bounce the user away mid-load.
//
// Honest empty states, same idiom as PersonCard/PeopleKorPage: an empty affectTrend draws
// no bars (a `—` card instead of a fabricated flat line); no context-labeled mentions omits
// the whole "Milyen helyzetekben" card; no knownFacts omits "Amit Mezo tud" entirely.
import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { affectColor } from '@/data/me/people'
import { contextBreakdown, trendAxisLabels, trendHeights } from '@/features/me/logic/peopleDerive'
import { TONE_META, CTX_META, SRC_META } from '@/features/me/logic/peopleVisuals'
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
  const style = delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as CSSProperties) : undefined

  return (
    <div className="ppl-mrowt rise" style={style}>
      <div className="ppl-mtop">
        {src.clay ? <ClayIcon name={src.clay} size={12} /> : <Icon name={src.icon ?? 'anchor'} size={10} />}
        <span className="ppl-mtime">{mention.timeLabel} · {mention.dayLabel}</span>
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${tone.cssVar})`, flex: 'none' }}
        />
        {ctx && <span className="ppl-mtiechip">{ctx.label}</span>}
      </div>
      <p className="ppl-mx">„{mention.excerpt}”</p>
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
  const color = affectColor(person.affect_baseline)
  const last = person.affectTrend[person.affectTrend.length - 1] ?? 0
  const ringPct = Math.max(0, Math.min(100, Math.round((last / 5) * 100)))
  const toneMeta = TONE_META[person.affect_baseline] as (typeof TONE_META)[keyof typeof TONE_META] | undefined
  const trend = trendHeights(person.affectTrend, TREND_MAX_PX)
  const axisLabels = trendAxisLabels(person.affectTrend, new Date())
  const ctxSlices = contextBreakdown(personMentions)
  const timeline = personMentions.slice(0, TIMELINE_MAX)
  const hasTonelessRow = timeline.some((m) => !m.tone)

  const avatStyle = { '--ac': color, '--av': `${ringPct}%` } as CSSProperties

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate(-1)} label="‹ A köröm">
        <button
          type="button"
          className="pgact"
          onClick={() => setEditOpen(true)}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          <Icon name="pencil" size={12} /> Szerkesztés
        </button>
      </PageHead>

      <EntranceGroup>
        <div className="mz-page-hero">
          <div className="ppl-avat-lg" style={avatStyle}>
            <div className="ppl-avin">{person.initial}</div>
          </div>
          <div className="mz-hero-nm" style={{ marginTop: 6 }}>{person.name}</div>
          <div className="mz-hero-sb">
            {person.relationshipHu}{person.contactCadenceLabel ? ` · ${person.contactCadenceLabel}` : ''}
          </div>
        </div>

        <PageBody>
          <StatStrip className="rise">
            <StatCell value={person.mentionCount} label="összes" />
            <StatCell value={`${person.mentionsThisWeek}×`} label="e héten" />
            <StatCell value={toneMeta?.label ?? '—'} label="hangulat" />
          </StatStrip>

          <div className="ppl-trendcard rise">
            <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>Hangulat-ív</span>
            {trend.length > 0 && axisLabels ? (
              <>
                <div className="ppl-affbars">
                  {trend.map((h, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${h}px`,
                        background: color,
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
              <p className="ppl-empty" style={{ marginTop: 9 }}>— nincs elég adat a hangulat-ívhez</p>
            )}
          </div>

          {ctxSlices.length > 0 && (
            <div className="ppl-ctxcard rise">
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>Milyen helyzetekben</span>
              {ctxSlices.map((slice) => (
                <div className="ppl-ctxbar" key={slice.ctx}>
                  <span className="ppl-ctxlb">{CTX_META[slice.ctx].label}</span>
                  <span className="ppl-ctxtr">
                    <div style={{ '--w': `${slice.pct}%`, background: `var(${CTX_META[slice.ctx].cssVar})` } as CSSProperties} />
                  </span>
                  <span className="ppl-ctxpc">{slice.pct}%</span>
                </div>
              ))}
            </div>
          )}

          {person.knownFacts.length > 0 && (
            <div className="ppl-factcard rise">
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>Amit Mezo tud</span>
              <div style={{ marginTop: 6 }}>
                {person.knownFacts.map((fact, i) => (
                  <span key={i} className="ppl-fact">{fact}</span>
                ))}
              </div>
            </div>
          )}

          <div className="col gap-sm">
            {timeline.map((mention, i) => (
              <DetTimelineRow key={mention.id} mention={mention} delayMs={220 + i * 30} />
            ))}
          </div>
          {hasTonelessRow && (
            <p className="ppl-foot rise">A tónust az éjszakai kör tölti.</p>
          )}

          <button
            type="button"
            className="cta-primary rise"
            style={{ marginTop: 14, width: '100%' }}
            onClick={() => setLogOpen(true)}
          >
            <ClayIcon name="i-mikrofon" size={14} /> Log most
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
