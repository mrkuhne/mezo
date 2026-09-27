import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { useToast } from '@/shared/ui/ToastProvider'
import { usePeople } from '@/data/me/peopleHooks'
import { toneColor } from '@/features/me/logic/peopleVisuals'
import { FACT_KIND_ICON, FACT_KIND_LABEL } from '@/features/me/logic/personFactCopy'
import { byNameHu, matches } from '@/features/insights/logic/hubSearch'
import {
  DEGRADED, EMPTY, FOOT, MUTED_GROUP, PERSON_PAGE_LINK, SEARCH, SOURCE_EYEBROW, TOAST, groupCount, lead,
  personFactOrigin, personFactSub, personHead, personRowSub, whyText,
} from '@/features/insights/logic/hubCopy'
import { HubRow } from '@/features/insights/components/hub/HubRow'
import { HubFold } from '@/features/insights/components/hub/HubFold'
import { HubSearch, Highlight, NoHits } from '@/features/insights/components/hub/HubSearch'
import type { ForgetRequest } from '@/features/insights/hooks/useForgetUndo'
import type { PersonEntry, PersonFact } from '@/data/types'

export interface EmberekSectionProps {
  /** `&person=<id>` — the person sub-view; an id the list does not know reads as the list. */
  personId: string | null
  /** A row click; `carry` is the list query when it matched that person's facts (not the name),
   *  so the person view opens already filtered to those hits (the prototype's `data-pq`). */
  onOpenPerson: (id: string, carry: string) => void
  /** the query carried into the person view (see `onOpenPerson`) */
  initialPersonQuery?: string
  forget: (req: ForgetRequest) => void
  isHidden: (key: string) => boolean
}

const rowKey = (f: PersonFact) => `p:${f.id}`
const accentOf = (p: PersonEntry) => toneColor(p.affect_baseline)

/**
 * S6 (mezo-d6ivw.6): the Emberek section of the Tudástár (`?view=emberek`, prototype `emberek()`
 * and `person()`) — everyone Mezo knows something about, alphabetically (no ranking), searchable
 * by name AND by what it knows; one person = its own sub-view with the four verbs on every fact.
 * People are not gated by the companion switch, so there is no degraded branch.
 */
export function EmberekSection({ personId, onOpenPerson, initialPersonQuery = '', forget, isHidden }: EmberekSectionProps) {
  const { people, isPending, isError, refetch, toggleFactAsync, undoFactAsync, editFact } = usePeople()

  if (isPending) return <GhostState message={DEGRADED.loading} />
  if (isError) return <GhostState message={DEGRADED.error} ctaLabel="Újra" onCta={refetch} />

  const visible = people
    .map((p) => ({ ...p, facts: p.facts.filter((f) => !isHidden(rowKey(f))) }))
    .filter((p) => p.facts.length > 0)
    .sort((a, b) => byNameHu(a.name, b.name))
  const person = personId ? people.find((p) => p.id === personId) ?? null : null

  if (person) {
    return (
      <PersonView
        person={person}
        initialQuery={initialPersonQuery}
        isHidden={isHidden}
        onMute={(f, on) => toggleFactAsync(person.id, f.id, !on)}
        onEdit={(f, text) => editFact(person.id, f.id, text)}
        onForget={(f) => forget({ key: rowKey(f), label: f.text, computed: false, commit: () => undoFactAsync(person.id, f.id) })}
      />
    )
  }
  if (visible.length === 0) return <DashCard icon="t-people" text={EMPTY.people} />
  return <PeopleList people={visible} onOpenPerson={onOpenPerson} />
}

function PeopleList({ people, onOpenPerson }: { people: PersonEntry[]; onOpenPerson: EmberekSectionProps['onOpenPerson'] }) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const rows = people.flatMap((p) => {
    const nameHit = matches(p.name, q) || matches(p.relationshipHu, q)
    const factHits = q ? p.facts.filter((f) => matches(f.text, q)).length : 0
    if (q && !nameHit && !factHits) return []
    const on = p.facts.filter((f) => f.includeInPrompt).length
    const sub = personRowSub(on, p.facts.length - on)
    return [(
      <button key={p.id} type="button" className="th-prow" style={{ '--c': accentOf(p) } as CSSProperties}
        onClick={() => onOpenPerson(p.id, factHits && !matches(p.name, q) ? q : '')}>
        <span className="th-mono" style={{ '--c': accentOf(p) } as CSSProperties}>{p.initial || p.name.charAt(0)}</span>
        <span className="t"><b><Highlight text={p.name} query={q} /></b><small>{p.relationshipHu}</small></span>
        <span className="n">
          <b>{q && factHits ? `${factHits} találat` : sub.main}</b>
          {sub.muted && <small>{sub.muted}</small>}
        </span>
        <span className="chev" aria-hidden="true">›</span>
      </button>
    )]
  })
  return (
    <>
      <p className="th-lead rise">{lead.people(people.length, people.flatMap((p) => p.facts).length)}</p>
      <HubSearch value={query} onChange={setQuery} placeholder={SEARCH.people} />
      {q && rows.length === 0
        ? <NoHits query={q} onClear={() => setQuery('')} />
        : <div className="th-links th-links-flush">{rows}</div>}
      <p className="th-foot"><b>{FOOT.people[0]}</b>{FOOT.people[1]}</p>
    </>
  )
}

interface PersonViewProps {
  person: PersonEntry
  initialQuery: string
  isHidden: (key: string) => boolean
  /** Rejects when the write failed (already rolled back). */
  onMute: (f: PersonFact, on: boolean) => Promise<unknown>
  onEdit: (f: PersonFact, text: string) => void
  onForget: (f: PersonFact) => void
}

function PersonView({ person, initialQuery, isHidden, onMute, onEdit, onForget }: PersonViewProps) {
  const toast = useToast()
  const [query, setQuery] = useState(initialQuery)
  const [mutedOpen, setMutedOpen] = useState(false)
  const [mutedClosedWhileSearching, setMutedClosedWhileSearching] = useState(false)
  const q = query.trim()
  const onQuery = (v: string) => { setQuery(v); setMutedClosedWhileSearching(false) }

  const facts = person.facts.filter((f) => !isHidden(rowKey(f)))
  const on = facts.filter((f) => f.includeInPrompt)
  const muted = facts.filter((f) => !f.includeInPrompt)
  const onHits = on.filter((f) => matches(f.text, q))
  const mutedHits = muted.filter((f) => matches(f.text, q))
  const accent = accentOf(person)
  const foldOpen = q ? !mutedClosedWhileSearching : mutedOpen
  const MUTED_KEY = `p:${person.id}:muted`

  const row = (f: PersonFact) => (
    <HubRow
      key={f.id}
      rowKey={rowKey(f)}
      icon={FACT_KIND_ICON[f.kind]}
      accent={accent}
      text={f.text}
      query={q}
      sub={personFactSub(FACT_KIND_LABEL[f.kind], f)}
      why={f.includeInPrompt ? null : { text: whyText('user', null), icon: 't-mute' }}
      muted={!f.includeInPrompt}
      canEdit
      source={() => (
        <div className="th-src">
          <span className="h">{SOURCE_EYEBROW}</span>
          <p className="o">{personFactOrigin(f.sourceKind)}</p>
        </div>
      )}
      onMute={(next) => {
        onMute(f, next).catch(() => toast.show({ kind: 'error', text: TOAST.muteFailed }))
        // the prototype's `openFor`: a freshly silenced fact's new home opens
        if (next) { setMutedOpen(true); setMutedClosedWhileSearching(false) }
        toast.show({ kind: 'info', text: next ? TOAST.muted : TOAST.unmuted })
      }}
      onEdit={(text) => { onEdit(f, text); toast.show({ kind: 'info', text: TOAST.edited }) }}
      onForget={() => onForget(f)}
    />
  )

  return (
    <>
      <div className="th-pg rise" style={{ '--c': accent } as CSSProperties}>
        <span className="th-mono" style={{ '--c': accent } as CSSProperties}>{person.initial || person.name.charAt(0)}</span>
        <span><b>{person.relationshipHu}</b><small>{personHead(on.length, muted.length)}</small></span>
        <Link to={`/me/people/${person.id}`} className="th-link">{PERSON_PAGE_LINK}</Link>
      </div>
      <HubSearch value={query} onChange={onQuery} placeholder={SEARCH.person(person.name)} />
      {q && onHits.length === 0 && mutedHits.length === 0 ? (
        <NoHits query={q} onClear={() => onQuery('')} />
      ) : (
        <>
          {onHits.length > 0
            ? <div className="th-list">{onHits.map(row)}</div>
            : <div className="th-empty">{EMPTY.personNone}</div>}
          {((!q && muted.length > 0) || mutedHits.length > 0) && (
            <HubFold id={MUTED_KEY} icon="t-mute" label={MUTED_GROUP}
              count={groupCount(q, q ? mutedHits.length : muted.length)}
              open={foldOpen}
              onToggle={() => (q ? setMutedClosedWhileSearching((c) => !c) : setMutedOpen((o) => !o))}>
              <div className="th-list">{mutedHits.map(row)}</div>
            </HubFold>
          )}
        </>
      )}
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
