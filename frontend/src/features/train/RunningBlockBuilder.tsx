// ============================================================
// Mezo · RunningBlockBuilder — full-screen takeover for a single running
// block (sibling route /train/futas/:id, NO sub-nav). Own back-button header
// (← Futás), status-aware eyebrow, editable title + goal, a week-selector
// chip row driving the RunWeekEditor, and status-dependent bottom actions
// (Mentés / Duplikál / Aktiválás | Blokk lezárása / Törlés). Accent --info.
// Ported from the futas-blocks-builder mockup (RIGHT phone); mirrors
// MesocycleBuilder's shell.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRunning } from '@/data/hooks'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { RunWeekEditor } from './components/RunWeekEditor'
import { toUpsert, duplicateDraft } from '@/data/runningDraft'
import type { RunningBlockResponse, RunningBlockUpsertRequest } from '@/lib/runningApi'

const RUN = 'var(--info)'

const fieldStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--ff-body)',
  fontSize: 13,
  padding: '10px 12px',
  width: '100%',
}

export function RunningBlockBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    runningBlocks, saveRunningBlock, activateRunningBlock,
    closeRunningBlock, deleteRunningBlock, runningMutationPending,
  } = useRunning()

  const block = runningBlocks.find((b) => b.id === id)
  const backToList = () => navigate('/train/futas')

  const [draft, setDraft] = useState<RunningBlockUpsertRequest>(() => (block ? toUpsert(block) : ({} as RunningBlockUpsertRequest)))
  const [selectedWeek, setSelectedWeek] = useState<number>(() => block?.currentWeek || 1)

  // Re-seed the draft when the routed block id changes (don't depend on the
  // whole object — that would clobber in-progress edits on every refetch).
  useEffect(() => {
    if (block) {
      setDraft(toUpsert(block))
      setSelectedWeek(block.currentWeek || 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id])

  if (!block) {
    return (
      <div style={{ padding: '24px' }}>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Ez a futóterv nem található.
        </p>
        <div className="mt-lg">
          <CtaGhost className="notch-4" onClick={backToList}>
            ← Futás
          </CtaGhost>
        </div>
      </div>
    )
  }

  const statusEyebrow =
    block.status === 'active'
      ? `Aktív · Hét ${block.currentWeek}/${block.weeks}`
      : block.status === 'planned'
        ? 'Tervezett'
        : 'Archív'

  const clampedWeek = Math.min(Math.max(selectedWeek, 1), draft.weeks || 1)

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper.
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" onClick={backToList} className="row gap-sm">
          <span style={{ color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow" style={{ color: RUN }}>Futás</span>
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '6px 24px 4px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="eyebrow" style={{ color: RUN }}>Builder · {statusEyebrow}</span>
        </div>
        <div className="col gap-sm mt-sm">
          <input
            aria-label="Cím"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Terv neve"
            style={{ ...fieldStyle, fontFamily: 'var(--ff-display)', fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.01em' }}
          />
          <input
            aria-label="Cél"
            value={draft.goal ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
            placeholder="Cél (pl. sprint-állóképesség)"
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Week selector */}
      <div style={{ padding: '16px 24px 4px' }}>
        <div style={{ marginBottom: 8 }}>
          <span className="label-mono">Hetek</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: draft.weeks || 1 }, (_, i) => i + 1).map((w) => {
            const active = w === clampedWeek
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedWeek(w)}
                className="notch-4"
                style={{
                  minWidth: 40,
                  padding: '8px 10px',
                  background: active ? 'color-mix(in srgb, var(--info) 8%, transparent)' : 'var(--surface-1)',
                  border: `1px solid ${active ? 'color-mix(in srgb, var(--info) 40%, transparent)' : 'var(--border-subtle)'}`,
                  color: active ? RUN : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>

      {/* Week editor */}
      <div style={{ padding: '12px 24px 8px' }}>
        <RunWeekEditor
          structure={draft.structure}
          weekNumber={clampedWeek}
          onStructure={(s) => setDraft((d) => ({ ...d, structure: s }))}
        />
      </div>

      {/* Actions */}
      <BuilderActions
        block={block}
        pending={runningMutationPending}
        onSave={() => saveRunningBlock(block.id, draft, { onSuccess: backToList })}
        onDuplicate={() => saveRunningBlock(null, duplicateDraft(block), { onSuccess: backToList })}
        onActivate={() => { activateRunningBlock(block.id); backToList() }}
        onClose={() => { closeRunningBlock(block.id); backToList() }}
        onDelete={() => deleteRunningBlock(block.id, { onSuccess: backToList })}
      />
    </div>
  )
}

function BuilderActions({
  block, pending, onSave, onDuplicate, onActivate, onClose, onDelete,
}: {
  block: RunningBlockResponse
  pending: boolean
  onSave: () => void
  onDuplicate: () => void
  onActivate: () => void
  onClose: () => void
  onDelete: () => void
}) {
  const errorTint: React.CSSProperties = {
    padding: 12,
    borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)',
    color: 'var(--error)',
  }
  return (
    <div className="col gap-sm" style={{ padding: '16px 24px 32px' }}>
      <CtaPrimary className="notch-8" onClick={onSave} disabled={pending}>
        <Icon name="check" size={16} /> Mentés
      </CtaPrimary>
      <CtaGhost className="notch-4" style={{ padding: 12 }} onClick={onDuplicate} disabled={pending}>
        Duplikál
      </CtaGhost>
      {block.status === 'planned' && (
        <CtaPrimary className="notch-8" onClick={onActivate} disabled={pending}>
          <Icon name="check" size={16} /> Aktiválás
        </CtaPrimary>
      )}
      {block.status === 'active' && (
        <CtaGhost className="notch-4" style={errorTint} onClick={onClose} disabled={pending}>
          Blokk lezárása
        </CtaGhost>
      )}
      <CtaGhost className="notch-4" style={errorTint} onClick={onDelete} disabled={pending}>
        Törlés
      </CtaGhost>
    </div>
  )
}
