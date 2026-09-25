import { useId } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { LifeEventCandidateCard } from '@/features/insights/components/LifeEventCandidateCard'
import { LifeEventAcceptedCard } from '@/features/insights/components/LifeEventAcceptedCard'
import { CANDIDATE_COPY } from '@/data/insights/graph'
import type { KnowledgeFact, FactCandidate, FactDecision, LifeEventCandidate, LifeEventDecision } from '@/data/types'

interface AcceptedEvent {
  id: string
  kind: LifeEventCandidate['kind']
  title: string
  edgeCount: number
}

/**
 * mezo-ms9a shell: the approval inbox (candidates + LIFE_EVENT/SEASON groups, unchanged
 * behavior from the old KnowledgeListPage) + the base-view doors (glass rows →
 * ?view=tenyek|kategoriak). `acceptedEvents`/`pendingLifeEvents` stay page-level state
 * in the shell (KnowledgeListPage) so the confirmation survives a view switch — this component
 * only renders what it is handed.
 */
export function KnowledgeBaseView(props: {
  /** A társ-kapcsoló 404-je (mezo-ms9a): CSAK a tény-felületet fedi — a candidate-inbox blokk
   *  és a Tények csempe helyett a degraded kártya áll, de a LIFE_EVENT/SEASON csoportok és a
   *  Kategóriák/Így beszélj velem csempék a gráf-hookok saját (független) adatával rendereinek. */
  degraded: boolean
  candidates: FactCandidate[]
  onDecideCandidate: (id: string, decision: FactDecision, refinedText?: string) => void
  /** Task 12 (mezo-ms9a): a konfliktus-jelzés „A régit kikapcsolom" checkboxa ezt hívja az
   *  ütköző tény id-jával — a shell ide a meglévő `useKnowledgeActions().toggle`-t adja. */
  onToggleConflict: (factId: string, active: boolean) => void
  pendingLifeEvents: LifeEventCandidate[]
  acceptedEvents: AcceptedEvent[]
  onAcceptLifeEvent: (candidate: LifeEventCandidate, refined?: { title?: string; summary?: string }) => void
  onDecideLifeEvent: (id: string, decision: LifeEventDecision, refined?: { title?: string; summary?: string }) => void
  facts: KnowledgeFact[]
  buckets: { inPrompt: KnowledgeFact[]; waiting: KnowledgeFact[]; off: KnowledgeFact[] }
  kindCount: number
  kategLine: string
  profileNode: { summary: string | null } | null
  profileLine: string
  onNavigate: (view: 'tenyek' | 'kategoriak' | 'profil') => void
}) {
  const {
    degraded, candidates, onDecideCandidate, onToggleConflict, pendingLifeEvents, acceptedEvents, onAcceptLifeEvent,
    onDecideLifeEvent, facts, buckets, kindCount, kategLine, onNavigate,
  } = props

  return (
    <>
      {degraded ? (
        <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <Icon3D name="t-info" size={28} />
          <span>A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.</span>
        </div>
      ) : candidates.length > 0 && (
        /* Üveg (U9): the approval inbox is the ONE loud group of the page — glass amber cases. */
        <section className="tud9-group tud9-inbox rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <h2 className="tud9-sech">Jóváhagyásra vár · {candidates.length}</h2>
          <div className="tf-rows">
            {candidates.map((c) => (
              <FactCandidateCard
                key={c.id}
                candidate={c}
                conflictFact={facts.find((f) => f.id === c.conflictsWithFactId) ?? null}
                onToggleConflict={onToggleConflict}
                onDecide={(decision, refinedText) => onDecideCandidate(c.id, decision, refinedText)}
              />
            ))}
          </div>
        </section>
      )}

      {(['LIFE_EVENT', 'SEASON'] as const).map((kind) => {
        const pending = pendingLifeEvents.filter((c) => c.kind === kind)
        const settled = acceptedEvents.filter((a) => a.kind === kind)
        if (pending.length === 0 && settled.length === 0) return null
        return (
          <section key={kind} className="tud9-group rise">
            <h2 className="tud9-sech">
              {/* A darabszám a MÉG DÖNTÉSRE VÁRÓ jelölteké. Enélkül a csoport utolsó elfogadása
                  után „…jelöltek · 0" állna a megerősítő kártya fölött. */}
              {pending.length > 0
                ? `${CANDIDATE_COPY[kind].eyebrow} · ${pending.length}`
                : CANDIDATE_COPY[kind].settled}
            </h2>
            <div className="tf-rows">
              {settled.map((a) => (
                <LifeEventAcceptedCard key={a.id} title={a.title} edgeCount={a.edgeCount} />
              ))}
              {pending.map((c) => (
                <LifeEventCandidateCard
                  key={c.id}
                  candidate={c}
                  onDecide={(decision, refined) => {
                    if (decision === 'accept') onAcceptLifeEvent(c, refined)
                    onDecideLifeEvent(c.id, decision, refined)
                  }}
                />
              ))}
            </div>
          </section>
        )
      })}

      <section className="tud9-group rise">
        <h2 className="tud9-sech">A tudás</h2>
        <div className="tf-rows">
          {!degraded && (
            <DoorRow
              label="Tények" icon="t-note" accent="sage" badge={facts.length}
              line={`${buckets.inPrompt.length} a chatben · ${buckets.waiting.length} vár · ${buckets.off.length} kikapcsolva`}
              onClick={() => onNavigate('tenyek')}
            />
          )}
          <DoorRow
            label="Kategóriák" icon="t-graph" accent="lav" badge={kindCount}
            line={kategLine} onClick={() => onNavigate('kategoriak')}
          />
        </div>
      </section>
    </>
  )
}

/** A base-view door (prototype `rowg`): glass row, 3D icon, name + line, count badge. The
 *  accessible name stays the bare section name (as the old Mozaik tile's did); the line is
 *  its description. */
function DoorRow({ label, icon, accent, badge, line, onClick }: {
  label: string
  icon: Icon3DName
  accent: 'sage' | 'lav'
  badge: number
  line: string
  onClick: () => void
}) {
  const lineId = useId()
  return (
    <button type="button" className={`glass tf-rowg tf-c-${accent} tud9-door`} aria-label={label} aria-describedby={lineId} onClick={onClick}>
      <Icon3D name={icon} size={40} />
      <span className="tf-rowtxt">
        <span className="tf-rowname">{label}</span>
        <span className="tf-rowsub" id={lineId}>{line}</span>
      </span>
      <span className="tf-rowbadge">{badge}</span>
    </button>
  )
}
