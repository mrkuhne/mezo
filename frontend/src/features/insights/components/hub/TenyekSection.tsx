import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { useToast } from '@/shared/ui/ToastProvider'
import { EvidenceList } from '@/shared/ui/evidence/EvidenceList'
import { localDateString } from '@/shared/lib/dates'
import { FACT_CATEGORIES, factCategoryLabel } from '@/data/insights/knowledge'
import { useFactEvidence, useKnowledgeHubActions } from '@/data/insights/knowledgeHubHooks'
import { humanizeFactText, sortFacts } from '@/features/insights/logic/factCopy'
import { matches } from '@/features/insights/logic/hubSearch'
import {
  CHIP, DEGRADED, EMPTY, EVIDENCE_UNAVAILABLE, FACTS_NOTE, GO_TO_OBSERVATION, LINKS, MUTED_GROUP, MUTED_HINT,
  ORIGIN, SEARCH, SOURCE_EYEBROW, TOAST, WHY_ICON, groupCount, lead, onHint, reinforced, whyText,
} from '@/features/insights/logic/hubCopy'
import { HubRow } from '@/features/insights/components/hub/HubRow'
import { HubFold } from '@/features/insights/components/hub/HubFold'
import { HubSearch, NoHits } from '@/features/insights/components/hub/HubSearch'
import type { ForgetRequest } from '@/features/insights/hooks/useForgetUndo'
import type { FactCategory, KnowledgeFact } from '@/data/types'

/** Üveg (U9 · mezo-me75u.9): kategória → 3D ikon + akcentus (prototype `CAT`): edzés égkék
 *  súlyzó · étkezés zsálya tál · egészség rózsa szív · élet borostyán nap. */
const CATEGORY_SKIN: Record<FactCategory, { icon: Icon3DName; accent: string }> = {
  train: { icon: 't-dumbbell', accent: 'var(--dv-sky)' },
  fuel: { icon: 't-bowl', accent: 'var(--dv-sage)' },
  health: { icon: 't-heart', accent: 'var(--dv-rose)' },
  life: { icon: 't-sun', accent: 'var(--dv-amber)' },
}

const MUTED_KEY = 'f:muted'
const rowKey = (f: KnowledgeFact) => `f:${f.id}`
const groupOf = (f: KnowledgeFact) => (f.active ? `f:${f.category}` : MUTED_KEY)
/** What the search looks at: the sentence the user sees, plus the promoting pattern's title. */
const haystack = (f: KnowledgeFact) => `${humanizeFactText(f.text)} ${f.patternTitle ?? ''}`

export interface TenyekSectionProps {
  facts: KnowledgeFact[]
  degraded: boolean
  isPending: boolean
  isError: boolean
  refetch: () => void
  /** the `?fact=` deep link target: its fold opens and its row carries the one-shot highlight */
  highlightFactId: string | null
  forget: (req: ForgetRequest) => void
  isHidden: (key: string) => boolean
}

/** "Honnan tudom?" for one fact — mounted only while open, so the evidence fetch is lazy. */
function FactSource({ fact, onOpenObservation }: { fact: KnowledgeFact; onOpenObservation: (id: string) => void }) {
  const manual = fact.source === 'manual'
  const { evidence, unavailable } = useFactEvidence(manual ? null : fact.id)
  const patternId = fact.source === 'pattern' ? fact.patternId ?? null : null
  return (
    <div className="th-src">
      <span className="h">{SOURCE_EYEBROW}</span>
      <p className="o">{ORIGIN[fact.source]}</p>
      {!manual && (unavailable
        ? <p className="o">{EVIDENCE_UNAVAILABLE}</p>
        : evidence.length > 0 && <EvidenceList evidence={evidence.slice(0, 5)} today={localDateString()} />)}
      {patternId && (
        <button type="button" className="go" onClick={() => onOpenObservation(patternId)}>{GO_TO_OBSERVATION}</button>
      )}
    </div>
  )
}

/**
 * S6 (mezo-d6ivw.6): the Rólad section of the Tudástár (`?view=tenyek`, prototype `tenyek()`) —
 * facts grouped by topic in collapsible folds, a search that opens every fold with hits, the muted
 * facts under "Elhallgattatott" with the reason they are silent, the four verbs on every row, and
 * the door to the team's dossier. Facts-always (mezo-d6ivw.8): no per-row "in use" marker — every
 * fact that is on goes into every conversation.
 */
export function TenyekSection(props: TenyekSectionProps) {
  const { facts, degraded, isPending, isError, refetch, highlightFactId, forget, isHidden } = props
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const { muteFact, editFact, forgetFact } = useKnowledgeHubActions()
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [closedWhileSearching, setClosedWhileSearching] = useState<Record<string, boolean>>({})

  const q = query.trim()
  const target = highlightFactId ? facts.find((f) => f.id === highlightFactId) ?? null : null
  const targetGroup = target ? groupOf(target) : null
  const isOpen = (g: string) => (q ? !closedWhileSearching[g] : openGroups[g] ?? g === targetGroup)
  const toggleGroup = (g: string) => {
    if (q) setClosedWhileSearching((s) => ({ ...s, [g]: !s[g] }))
    else setOpenGroups((s) => ({ ...s, [g]: !isOpen(g) }))
  }
  const onQuery = (v: string) => { setQuery(v); setClosedWhileSearching({}) }

  const openObservation = (patternId: string) => {
    const next: Record<string, string> = { view: 'eszrevetelek', obs: patternId }
    const start = params.get('start')
    setParams(start ? { ...next, start } : next)
  }

  if (isPending) return <GhostState message={DEGRADED.loading} />
  if (isError) return <GhostState message={DEGRADED.error} ctaLabel="Újra" onCta={refetch} />
  if (degraded) return <DashCard icon="t-info" text={DEGRADED.facts} />
  if (facts.length === 0) return <DashCard icon="t-note" text={EMPTY.facts} />

  const visible = facts.filter((f) => !isHidden(rowKey(f)))
  const active = visible.filter((f) => f.active)
  const muted = sortFacts(visible.filter((f) => !f.active))
  const groups = FACT_CATEGORIES
    .map(([cat, label]) => {
      const all = sortFacts(active.filter((f) => f.category === cat))
      return { cat, label, all, hits: all.filter((f) => matches(haystack(f), q)) }
    })
    .filter((g) => g.all.length > 0)
  const mutedHits = muted.filter((f) => matches(haystack(f), q))
  const hitCount = groups.reduce((n, g) => n + g.hits.length, 0) + mutedHits.length

  const row = (f: KnowledgeFact) => {
    const text = humanizeFactText(f.text)
    const skin = CATEGORY_SKIN[f.category]
    const tag: ReactNode = f.source === 'pattern' && f.patternId
      ? (
        <button type="button" className="th-tag" onClick={() => openObservation(f.patternId!)}>
          <Icon3D name="t-pattern" size={15} />{CHIP.pattern}
        </button>
      )
      : CHIP[f.source]
    const reason = f.mutedReason ?? 'user'
    return (
      <HubRow
        key={f.id}
        rowKey={rowKey(f)}
        icon={skin.icon}
        accent={skin.accent}
        text={text}
        query={q}
        sub={<>{reinforced(f.reinforced)} · {tag}{!f.active && ` · ${factCategoryLabel(f.category).toLowerCase()}`}</>}
        why={f.active ? null : { text: whyText(reason, f.mutedAt ?? null), icon: WHY_ICON[reason] }}
        muted={!f.active}
        canEdit
        source={() => <FactSource fact={f} onOpenObservation={openObservation} />}
        onMute={(on) => {
          muteFact(f.id, on).catch(() => toast.show({ kind: 'error', text: TOAST.muteFailed }))
          // the prototype's `openFor`: the fact's new home opens so the user sees where it went
          setOpenGroups((s) => ({ ...s, [on ? MUTED_KEY : `f:${f.category}`]: true }))
          setClosedWhileSearching({})
          toast.show({ kind: 'info', text: on ? TOAST.muted : TOAST.unmuted })
        }}
        onEdit={(next) => { editFact(f.id, next); toast.show({ kind: 'info', text: TOAST.edited }) }}
        onForget={() => forget({ key: rowKey(f), label: text, computed: false, commit: () => forgetFact(f.id) })}
        highlight={f.id === highlightFactId}
      />
    )
  }

  return (
    <>
      <p className="th-lead rise">{lead.facts(visible.length, groups.length, active.length, muted.length)}</p>
      <HubSearch value={query} onChange={onQuery} placeholder={SEARCH.facts} />
      {q && hitCount === 0 ? (
        <NoHits query={q} onClear={() => onQuery('')} />
      ) : (
        <>
          {!q && <p className="th-fn th-facts-note">{FACTS_NOTE}</p>}
          {groups.filter((g) => !q || g.hits.length > 0).map((g) => {
            const id = `f:${g.cat}`
            return (
              <HubFold key={id} id={id} icon={CATEGORY_SKIN[g.cat].icon} label={g.label}
                count={groupCount(q, q ? g.hits.length : g.all.length)} hint={onHint(g.all.length)}
                open={isOpen(id)} onToggle={() => toggleGroup(id)}>
                <div className="th-list">{g.hits.map(row)}</div>
              </HubFold>
            )
          })}
          {(!q || mutedHits.length > 0) && (
            <HubFold id={MUTED_KEY} icon="t-mute" label={MUTED_GROUP}
              count={groupCount(q, q ? mutedHits.length : muted.length)} hint={MUTED_HINT.facts}
              open={isOpen(MUTED_KEY)} onToggle={() => toggleGroup(MUTED_KEY)}>
              <div className="th-list">{mutedHits.map(row)}</div>
            </HubFold>
          )}
        </>
      )}
      <div className="th-sec"><h2>{LINKS.teamSection}</h2></div>
      <div className="th-links th-links-flush">
        <Link to="/mezo/karakter" className="th-lk">
          <Icon3D name="t-council" size={26} />
          <span><b>{LINKS.dossier}</b><small>{LINKS.dossierSub}</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </Link>
      </div>
    </>
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
