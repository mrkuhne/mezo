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
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { usePersonEffects } from '@/data/me/personEffectsHooks'
import { contextBreakdown, trendAxisLabels, trendHeights } from '@/features/me/logic/peopleDerive'
import { TONE_META, CTX_META, SRC_META, GRAPH_KIND_META, GRAPH_KIND_FALLBACK, toneColor } from '@/features/me/logic/peopleVisuals'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'
import type { Mention, PersonEffect, PersonFact, PersonFactKind } from '@/data/types'

// S4 (mezo-d6ivw.4): a "Hatás · együttjárás" kártya — óvatos, nem-oki mondat + KÜLÖN
// erősség/bizonyosság jelzés (Exist-minta). A stressz-metrika polaritása itt fordul meg:
// "lower" stressz = "nyugodtabb vagy" (jó irány), nem a nyers irány szó szerinti fordítása.
const METRIC_COPY: Record<PersonEffect['metric'], { higher: string; lower: string }> = {
  mental: { higher: 'jobb a hangulatod', lower: 'nyomottabb a hangulatod' },
  energy: { higher: 'több az energiád', lower: 'kevesebb az energiád' },
  stress: { higher: 'feszültebb vagy', lower: 'nyugodtabb vagy' },
}

function effectSentence(name: string, e: PersonEffect): string {
  return `Úgy tűnik, azokon a napokon, amikor ${name} szóba kerül, ${METRIC_COPY[e.metric][e.direction]}.`
}

// Wire values (enyhe/kozepes/eros, gyenge/kozepes/eros) → accented display labels + dot count.
const STRENGTH_META: Record<PersonEffect['strength'], { label: string; n: number }> = {
  enyhe: { label: 'enyhe', n: 1 },
  kozepes: { label: 'közepes', n: 2 },
  eros: { label: 'erős', n: 3 },
}
const CONFIDENCE_META: Record<PersonEffect['confidence'], { label: string; n: number }> = {
  gyenge: { label: 'gyenge', n: 1 },
  kozepes: { label: 'közepes', n: 2 },
  eros: { label: 'erős', n: 3 },
}

function formatMeanDiff(meanDiff: number): string {
  return Math.abs(meanDiff).toFixed(1).replace('.', ',')
}

function EffectDots({ n, ring, label }: { n: number; ring?: boolean; label: string }) {
  return (
    <span className={`ppl-effdots${ring ? ' ring' : ''}`} role="img" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

// S3 (mezo-d6ivw.3): a normalizált tények fajta-címkéi a kártyán.
const FACT_KIND_LABEL: Record<PersonFactKind, string> = {
  preference: 'kedveli / nem szereti',
  relationship_state: 'kapcsolat most',
  shared_activity: 'közös',
  important_date: 'fontos dátum',
  sensitivity: 'érzékeny',
}

function factProvenance(f: PersonFact): string {
  const src = f.sourceKind === 'chat_turn' ? 'chatből' : 'éjszakai jegyzetből'
  const date = new Date(f.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  return `${src} · ${date}`
}

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
  const { people, mentions, logMention, isPending, undoFact, toggleFact, markFactsSeen } = usePeople()
  const [logOpen, setLogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const person = people.find((p) => p.id === id)
  const { effects } = usePersonEffects(person?.id)

  // S3: az „új" jelölésű (jellemzően éjszakai) tények első megtekintéskor látottá válnak. A
  // badge-hez az ELSŐ betöltéskori állapotot pillanatképezzük, így a jelölés ezen az oldalon
  // még látszik akkor is, amikor a bélyegzés (markFactsSeen) már megtörtént.
  const [unseenIds, setUnseenIds] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (person && unseenIds === null) {
      const fresh = new Set(person.facts.filter((f) => !f.seen).map((f) => f.id))
      setUnseenIds(fresh)
      if (fresh.size > 0) markFactsSeen(person.id)
    }
  }, [person, unseenIds, markFactsSeen])

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

          {effects.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Hatás · együttjárás</span>
              </div>
              <div className="ppl-effcard glass rise" style={{ '--c': color, '--i': 3 } as CSSProperties}>
                {effects.map((e, i) => (
                  <div className="ppl-effrow" key={`${e.metric}-${i}`}>
                    <p className="ppl-effsent">{effectSentence(person.name, e)}</p>
                    <div className="ppl-effmeta">
                      <span className="ppl-effsig">
                        <small>EGYÜTTJÁRÁS</small>
                        <EffectDots n={STRENGTH_META[e.strength].n} label={`erősség: ${STRENGTH_META[e.strength].label}`} />
                        <em>{STRENGTH_META[e.strength].label}</em>
                      </span>
                      <span className="ppl-effsig">
                        <small>BIZONYOSSÁG</small>
                        <EffectDots n={CONFIDENCE_META[e.confidence].n} ring label={`bizonyosság: ${CONFIDENCE_META[e.confidence].label}`} />
                        <em>{CONFIDENCE_META[e.confidence].label}</em>
                      </span>
                      <em className="ppl-effn">{e.subjectDays} nap alapján · átlagosan ~{formatMeanDiff(e.meanDiff)} ponttal</em>
                    </div>
                  </div>
                ))}
                <p className="ppl-efffoot">Együttjárás, nem ok-okozat.</p>
              </div>
            </>
          )}

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

          {(person.facts.length > 0 || person.knownFacts.length > 0) && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow">Amit Mezo tud</span>
                {person.facts.length > 0 && <span className="ppl-lcnt">{person.facts.length}</span>}
              </div>
              {person.facts.length > 0 && (
                <div className="ppl-pfcard glass rise" style={{ '--i': 5 } as CSSProperties}>
                  {person.facts.map((f) => (
                    <div key={f.id} className="ppl-pfrow">
                      <div className="ppl-pfbody">
                        <div className="ppl-pfmeta">
                          <span className={`ppl-pfkind ppl-pfkind-${f.kind}`}>{FACT_KIND_LABEL[f.kind]}</span>
                          {unseenIds?.has(f.id) && <span className="ppl-pfnew">új</span>}
                          <span className="ppl-pfsrc">{factProvenance(f)}</span>
                        </div>
                        <p className="ppl-pftx">{f.text}</p>
                      </div>
                      <div className="ppl-pfacts">
                        <button
                          type="button"
                          className={`ppl-pftoggle${f.includeInPrompt ? ' on' : ''}`}
                          role="switch"
                          aria-checked={f.includeInPrompt}
                          aria-label={`Használja a beszélgetésekben: ${f.text}`}
                          onClick={() => toggleFact(person.id, f.id, !f.includeInPrompt)}
                        >
                          <span className="ppl-pfknob" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="ppl-pfdel"
                          aria-label={`Tény törlése: ${f.text}`}
                          onClick={() => undoFact(person.id, f.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {person.knownFacts.length > 0 && (
                <div className="ppl-factcard rise">
                  {person.knownFacts.map((fact, i) => (
                    <span key={i} className="ppl-fact">{fact}</span>
                  ))}
                </div>
              )}
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
