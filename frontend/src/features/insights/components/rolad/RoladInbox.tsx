import { useState } from 'react'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon3D } from '@/shared/ui/clay'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { LifeEventCandidateCard } from '@/features/insights/components/LifeEventCandidateCard'
import { LifeEventAcceptedCard } from '@/features/insights/components/LifeEventAcceptedCard'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import type { Settled, useRoladInbox } from '@/features/insights/hooks/useRoladInbox'
import { riseStyle } from './riseStyle'

export type RoladInboxState = ReturnType<typeof useRoladInbox>

const GONE_ICON = { snooze: 't-clock', reject: 't-skip' } as const

/** A decided item's afterlife (prototype `inboxCard`): a kept fact stays a sage glass case, a kept
 *  graph node the flat accepted row, a snoozed/rejected one a quiet dashed line. */
function SettledRow({ s, style }: { s: Settled; style: React.CSSProperties }) {
  if (s.outcome === 'keep') {
    if (s.kind !== 'FACT') {
      return <div className="rise" style={style}><LifeEventAcceptedCard title={s.title} edgeCount={s.edgeCount} /></div>
    }
    return (
      <div className="glass tf-case tf-c-sage tf-s-sage tud9-case kr9-kept rise" style={style} data-settled="keep">
        <span className="tf-crow"><span className="tf-st">Tényjelölt</span></span>
        <span className="tf-cmain">
          <Icon3D name="t-note" size={36} />
          <span className="tf-ctxt"><span className="tf-ctitle">{s.title}</span></span>
        </span>
        <span className="tf-after"><Icon3D name="t-tick" size={15} />{ROLAD_COPY.keep}</span>
      </div>
    )
  }
  return (
    <div className="kr9-gone rise" style={style} data-settled={s.outcome}>
      <Icon3D name={GONE_ICON[s.outcome]} size={22} />
      <span><b>{s.title}</b><small>{ROLAD_COPY[s.outcome]}</small></span>
    </div>
  )
}

/**
 * Rólad (U9b, mezo-zpxv7): „Döntésre vár” — the decision inbox moved here from the Tudástár. Fact
 * candidates (gold) and life-event / season candidates (gold / sky) in one list, each with the four
 * decisions; a decided item keeps its place and turns into its afterlife line. `degraded` (the
 * companion switch is off) only hides the fact half — graph candidates keep rendering.
 */
export function RoladInbox({ inbox, delay = 0 }: { inbox: RoladInboxState; delay?: number }) {
  const {
    facts, candidates, lifeEvents, settled, degraded, isPending, isError, refetch,
    isLifeEventsError, refetchLifeEvents,
  } = inbox

  // First-seen order, so a decided card turns into its afterlife line IN PLACE instead of jumping
  // to the end (the hook drops decided ids from the open lists). Derived state, set during render.
  const openIds = [...candidates.map((c) => c.id), ...lifeEvents.map((c) => c.id)]
  const [order, setOrder] = useState<string[]>(openIds)
  const unseen = [...openIds, ...settled.map((s) => s.id)].filter((id) => !order.includes(id))
  if (unseen.length > 0) setOrder([...order, ...unseen])

  const open = candidates.length + lifeEvents.length
  const hint = isPending || isError ? null : open > 0 ? `${open} JELÖLT` : settled.length > 0 ? 'MIND ELDÖNTVE' : null

  const cardFor = (id: string, i: number) => {
    const style = riseStyle(delay + i * 45)
    const c = candidates.find((x) => x.id === id)
    if (c) {
      const conflictFact = c.conflictsWithFactId ? facts.find((f) => f.id === c.conflictsWithFactId) ?? null : null
      return (
        <div key={id} className="rise" style={style}>
          <FactCandidateCard
            candidate={c}
            conflictFact={conflictFact}
            onToggleConflict={inbox.toggleFact}
            onDecide={(decision, refinedText) =>
              refinedText === undefined ? inbox.decideFact(c, decision) : inbox.decideFact(c, decision, refinedText)}
          />
        </div>
      )
    }
    const le = lifeEvents.find((x) => x.id === id)
    if (le) {
      return (
        <div key={id} className="rise" style={style}>
          <LifeEventCandidateCard
            candidate={le}
            onDecide={(decision, refined) =>
              refined === undefined ? inbox.decideLifeEvent(le, decision) : inbox.decideLifeEvent(le, decision, refined)}
          />
        </div>
      )
    }
    const s = settled.find((x) => x.id === id)
    return s ? <SettledRow key={id} s={s} style={style} /> : null
  }

  let body
  if (isPending) body = <GhostState message="A javaslatok betöltése…" />
  else if (isError) body = <GhostState message="Nem sikerült betölteni a javaslatokat." ctaLabel="Újra" onCta={refetch} />
  else {
    const items = [...order, ...unseen].filter((id, i, all) => all.indexOf(id) === i)
    const cards = items.map(cardFor).filter(Boolean)
    body = (
      <>
        {degraded && (
          <div className="tf-dash kr9-dash rise" style={riseStyle(delay)}>
            <Icon3D name="t-info" size={28} />
            <span>A társ jelenleg nincs bekapcsolva — a tényjavaslatok most nem elérhetők.</span>
          </div>
        )}
        {cards.length > 0 && <div className="tf-rows">{cards}</div>}
        {cards.length === 0 && !degraded && <p className="kr9-quiet">Nincs döntésre váró javaslat.</p>}
        {/* mezo-plbev item 2: the life-event/season candidates are a SEPARATE honest layer (own
            404 semantics) — their failure never wipes the section, just adds a quiet retry line
            under whatever fact cards are already working. */}
        {isLifeEventsError && (
          <p className="kr9-quiet">
            {ROLAD_COPY.lifeEventCandidatesError}{' '}
            <button type="button" className="kr9-link" onClick={refetchLifeEvents}>{ROLAD_COPY.retry}</button>
          </p>
        )}
      </>
    )
  }

  return (
    <section aria-labelledby="kr9-inbox-h" data-rolad-inbox>
      <div className="tf-sec">
        <h2 id="kr9-inbox-h">Döntésre vár</h2>
        {hint && <span className="tf-hint">{hint}</span>}
      </div>
      {body}
    </section>
  )
}
