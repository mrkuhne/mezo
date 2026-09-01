import { Mosaic, Tile } from '@/shared/ui/mozaik'
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
 * behavior from the old KnowledgeListPage) + the base-view section mosaic (3 tiles →
 * ?view=tenyek|kategoriak|profil). `acceptedEvents`/`pendingLifeEvents` stay page-level state
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
    onDecideLifeEvent, facts, buckets, kindCount, kategLine, profileNode, profileLine, onNavigate,
  } = props

  return (
    <>
      {degraded ? (
        <div className="card rise" style={{ '--d': '0ms', padding: 14 } as React.CSSProperties}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
          </span>
        </div>
      ) : candidates.length > 0 && (
        <div className="col gap-sm rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          {/* prototype .candc: the approval inbox speaks gold, not lavender */}
          <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-amber-ink)' }}>
            Jóváhagyásra vár · {candidates.length}
          </span>
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
      )}

      {(['LIFE_EVENT', 'SEASON'] as const).map((kind) => {
        const pending = pendingLifeEvents.filter((c) => c.kind === kind)
        const settled = acceptedEvents.filter((a) => a.kind === kind)
        if (pending.length === 0 && settled.length === 0) return null
        return (
          <div key={kind} className="col gap-sm">
            <span className="eyebrow" style={{ color: 'var(--amber-deep)' }}>
              {/* A darabszám a MÉG DÖNTÉSRE VÁRÓ jelölteké. Enélkül a csoport utolsó elfogadása
                  után „…jelöltek · 0" állna a megerősítő kártya fölött. */}
              {pending.length > 0
                ? `${CANDIDATE_COPY[kind].eyebrow} · ${pending.length}`
                : CANDIDATE_COPY[kind].settled}
            </span>
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
        )
      })}

      <Mosaic>
        {!degraded && (
          <Tile
            wash="sage" icon="i-polc" eyebrow="Tények" badge={facts.length}
            line={`${buckets.inPrompt.length} a chatben · ${buckets.waiting.length} vár · ${buckets.off.length} kikapcsolva`}
            onClick={() => onNavigate('tenyek')} delayMs={100}
          />
        )}
        <Tile
          wash="lav" icon="i-retegek" eyebrow="Kategóriák" badge={kindCount}
          line={kategLine} onClick={() => onNavigate('kategoriak')} delayMs={130}
        />
        {profileNode && (
          <Tile
            wash="rose" icon="i-checkin" eyebrow="Így beszélj velem" className="mz-tile-wide"
            line={profileLine} onClick={() => onNavigate('profil')} delayMs={160}
          />
        )}
      </Mosaic>
    </>
  )
}
