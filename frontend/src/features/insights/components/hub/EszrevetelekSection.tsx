import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { useToast } from '@/shared/ui/ToastProvider'
import { EvidenceList } from '@/shared/ui/evidence/EvidenceList'
import { localDateString } from '@/shared/lib/dates'
import { useKnowledgeHubActions, useKnowledgeObservations } from '@/data/insights/knowledgeHubHooks'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import { obsState } from '@/features/insights/logic/hubCounts'
import { OBS_TOPICS, TOPIC_ICON, groupBy, topicOf } from '@/features/insights/logic/hubTopics'
import { matches } from '@/features/insights/logic/hubSearch'
import {
  DEGRADED, DRIFT_EYEBROW, EMPTY, FOOT, OBS_FILTERS, OBS_ORIGIN, SEARCH, SOURCE_EYEBROW, TOAST,
  confirmedOn, groupCount, lead, obsFoldHint, obsStatus, type ObsFilter,
} from '@/features/insights/logic/hubCopy'
import { HubActs, HubRow } from '@/features/insights/components/hub/HubRow'
import { HubFold } from '@/features/insights/components/hub/HubFold'
import { HubSearch, Highlight, NoHits } from '@/features/insights/components/hub/HubSearch'
import type { ForgetRequest } from '@/features/insights/hooks/useForgetUndo'

const ACCENT = 'var(--dv-amber)'
const rowKey = (o: KnowledgeObservation) => `o:${o.patternId}`
const foldKey = (t: string) => `o:${t}`

export interface EszrevetelekSectionProps {
  /** the `&obs=<patternId>` deep link target: its topic opens and its row carries the highlight */
  highlightPatternId: string | null
  forget: (req: ForgetRequest) => void
  isHidden: (key: string) => boolean
}

/** The status line under an observation (prototype `th-st`): a glowing dot when it holds, a gold
 *  one on the newer half of a drift pair, a hollow ring when it is silent or replaced. */
function StatusLine({ o, replacedAt }: { o: KnowledgeObservation; replacedAt?: string | null }) {
  const { text, tone } = obsStatus({ ...o, replacedAt })
  return (
    <span className="th-st" data-tone={tone} style={tone === 'gold' ? ({ '--k': ACCENT } as CSSProperties) : undefined}>
      <i className={tone === 'off' ? 'o' : undefined} />{text}
    </span>
  )
}

/** "Honnan tudom?" for an observation: it is computed from the user's days, so the evidence is
 *  already on the item (capped at 5, rendered only through the shared evidence list). */
function ObsSource({ o }: { o: KnowledgeObservation }) {
  return (
    <div className="th-src">
      <span className="h">{SOURCE_EYEBROW}</span>
      <p className="o">{OBS_ORIGIN}</p>
      {o.evidence.length > 0 && <EvidenceList evidence={o.evidence.slice(0, 5)} today={localDateString()} />}
    </div>
  )
}

/**
 * S6 (mezo-d6ivw.6): the Észrevételek section of the Tudástár (`?view=eszrevetelek`, prototype
 * `eszrevetelek()`) — confirmed observations by topic, state chips that count exactly like the hub
 * tile (`obsState`), a search, and three verbs (no Javítom: an observation is computed; the fact
 * learned from it is edited under Rólad). Under "Mind" a drift pair is ONE row: the older half
 * sits inside the newer one, struck through, with its own verbs.
 */
export function EszrevetelekSection({ highlightPatternId, forget, isHidden }: EszrevetelekSectionProps) {
  const { observations, degraded, isPending, isError, refetch } = useKnowledgeObservations()
  const { muteFact, forgetObservation } = useKnowledgeHubActions()
  const toast = useToast()
  const [filter, setFilter] = useState<ObsFilter>('mind')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [closedWhileSearching, setClosedWhileSearching] = useState<Record<string, boolean>>({})

  if (isPending) return <GhostState message={DEGRADED.loading} />
  if (isError) return <GhostState message={DEGRADED.error} ctaLabel="Újra" onCta={refetch} />
  if (degraded) return <DashCard icon="t-info" text={DEGRADED.section} />

  const visible = observations.filter((o) => !isHidden(rowKey(o)))
  if (visible.length === 0) return <DashCard icon="t-pattern" text={EMPTY.observations} />

  const byPattern = new Map(visible.map((o) => [o.patternId, o]))
  const newerOf = (o: KnowledgeObservation) => (o.replacedByPatternId ? byPattern.get(o.replacedByPatternId) ?? null : null)
  const olderOf = (o: KnowledgeObservation) => (o.replacesPatternId ? byPattern.get(o.replacesPatternId) ?? null : null)
  const inPair = (o: KnowledgeObservation) => newerOf(o) !== null
  const inFilter = (f: ObsFilter, o: KnowledgeObservation) => (f === 'mind' ? !inPair(o) : obsState(o) === f)
  const count = (f: ObsFilter) => (f === 'mind' ? visible.length : visible.filter((o) => inFilter(f, o)).length)
  const paired = filter === 'mind'

  const q = query.trim()
  const hit = (o: KnowledgeObservation) => {
    const older = paired ? olderOf(o) : null
    return matches(o.title, q) || (older !== null && matches(older.title, q))
  }
  // a deep link to the older half of a pair lands on the newer row that carries it
  const target = highlightPatternId ? byPattern.get(highlightPatternId) ?? null : null
  const targetGroup = target ? foldKey(topicOf(newerOf(target) ?? target)) : null
  const isOpen = (g: string) => (q ? !closedWhileSearching[g] : openGroups[g] ?? g === targetGroup)
  const toggleGroup = (g: string) => {
    if (q) setClosedWhileSearching((s) => ({ ...s, [g]: !s[g] }))
    else setOpenGroups((s) => ({ ...s, [g]: !isOpen(g) }))
  }
  const onQuery = (v: string) => { setQuery(v); setClosedWhileSearching({}) }

  const mute = (o: KnowledgeObservation, on: boolean) => {
    if (!o.factId) return
    muteFact(o.factId, on)
    toast.show({ kind: 'info', text: on ? TOAST.muted : TOAST.unmuted })
  }
  const forgetObs = (o: KnowledgeObservation) =>
    forget({ key: rowKey(o), label: o.title, computed: true, commit: () => forgetObservation(o.patternId) })

  const groups = groupBy(visible.filter((o) => inFilter(filter, o)), topicOf, OBS_TOPICS)
    .map((g) => ({ ...g, hits: g.items.filter(hit) }))
    .filter((g) => !q || g.hits.length > 0)
  const hitCount = groups.reduce((n, g) => n + g.hits.length, 0)

  const row = (o: KnowledgeObservation) => {
    const older = paired ? olderOf(o) : null
    return (
      <HubRow
        key={o.patternId}
        rowKey={rowKey(o)}
        icon={TOPIC_ICON[topicOf(o)]}
        accent={ACCENT}
        text={o.title}
        query={q}
        sub={confirmedOn(o.confirmedAt)}
        status={<StatusLine o={o} replacedAt={newerOf(o)?.confirmedAt ?? null} />}
        muted={!!o.factMutedReason}
        canEdit={false}
        canMute={!!o.factId}
        source={() => <ObsSource o={o} />}
        onMute={(on) => mute(o, on)}
        onForget={() => forgetObs(o)}
        highlight={o.patternId === highlightPatternId}
        after={older && (
          <DriftBlock older={older} newer={o} query={q} highlight={older.patternId === highlightPatternId}
            onMute={(on) => mute(older, on)} onForget={() => forgetObs(older)} />
        )}
      />
    )
  }

  const chips = (
    <div className="th-chips">
      {OBS_FILTERS.map(([k, label]) => (
        <button key={k} type="button" className={cn(filter === k && 'on')} aria-pressed={filter === k} onClick={() => setFilter(k)}>
          {label} <b>{count(k)}</b>
        </button>
      ))}
    </div>
  )

  return (
    <>
      <p className="th-lead rise">{lead.observations}</p>
      <HubSearch value={query} onChange={onQuery} placeholder={SEARCH.observations} />
      {chips}
      {q && hitCount === 0 ? (
        <NoHits query={q} onClear={() => onQuery('')} />
      ) : groups.length === 0 ? (
        <div className="th-empty">{EMPTY.obsState}</div>
      ) : (
        groups.map((g) => {
          const id = foldKey(g.key)
          const holds = g.items.filter((o) => obsState(o) === 'igaz').length
          return (
            <HubFold key={id} id={id} icon={TOPIC_ICON[g.key]} label={g.key}
              count={groupCount(q, q ? g.hits.length : g.items.length)}
              hint={paired && holds < g.items.length ? obsFoldHint(holds) : undefined}
              open={isOpen(id)} onToggle={() => toggleGroup(id)}>
              <div className="th-list">{g.hits.map(row)}</div>
            </HubFold>
          )
        })
      )}
      <p className="th-foot"><b>{FOOT.observations[0]}</b>{FOOT.observations[1]}</p>
    </>
  )
}

/** The older half of a drift pair, inside the newer row (prototype `th-drift`): struck through
 *  while replaced; when the user switched its fact back on, both are used and it says so. */
function DriftBlock({ older, newer, query, highlight, onMute, onForget }: {
  older: KnowledgeObservation
  newer: KnowledgeObservation
  query: string
  highlight: boolean
  onMute: (on: boolean) => void
  onForget: () => void
}) {
  const on = !!older.factId && !older.factMutedReason
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView?.({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount-centring (the T10 idiom)
  }, [])
  return (
    <div ref={ref} data-row={rowKey(older)} className={cn('th-drift', on && 'is-on', highlight && 'tud9-hl')}
      style={{ '--c': ACCENT } as CSSProperties}>
      <span className="eb">{on ? DRIFT_EYEBROW.bothOn : DRIFT_EYEBROW.older(older.confirmedAt)}</span>
      <b><Highlight text={older.title} query={query} /></b>
      <StatusLine o={older} replacedAt={newer.confirmedAt} />
      <HubActs
        muted={!!older.factMutedReason}
        canMute={!!older.factId}
        source={() => <ObsSource o={older} />}
        onMute={onMute}
        onForget={onForget}
      />
    </div>
  )
}

function DashCard({ icon, text }: { icon: Icon3DName; text: string }) {
  return (
    <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as CSSProperties}>
      <Icon3D name={icon} size={28} />
      <span>{text}</span>
    </div>
  )
}
