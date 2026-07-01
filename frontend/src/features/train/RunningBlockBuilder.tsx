// ============================================================
// Mezo · RunningBlockBuilder — full-screen takeover for a single running
// block (sibling route /train/futas/:id, NO sub-nav). Own back-button header
// (← Futás), status-aware eyebrow + auto-save indicator + ⋯ overflow menu
// (Duplikálás / Törlés), editable title + goal, a 1–8 add/remove week row
// driving the RunWeekEditor, and a single status-dependent bottom CTA
// (Aktiválás | Lezárás). Edits auto-save (debounced) and flush on back.
// Accent --info. Mirrors MesocycleBuilder's shell.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRunning } from '@/data/hooks'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { RunWeekEditor } from '@/features/train/components/RunWeekEditor'
import { toUpsert, duplicateDraft, addWeek, removeLastWeek } from '@/data/train/runningDraft'
import type { RunningBlockUpsertRequest } from '@/data/train/runningApi'

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

  // Dirty = the in-progress draft differs from the loaded block. Compute
  // safely when block is undefined so the hook never throws before the
  // not-found early return runs.
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(block ? toUpsert(block) : {}),
    [draft, block],
  )

  // Auto-save: debounce a pending edit and persist it without an explicit
  // Save button. The cleanup clears the timer on unmount, so tests that finish
  // before 600ms never trigger a save.
  useEffect(() => {
    if (!block || !dirty) return
    const t = setTimeout(() => saveRunningBlock(block.id, draft), 600)
    return () => clearTimeout(t)
  }, [draft, dirty, block, saveRunningBlock])

  const backToList = () => {
    if (block && dirty) saveRunningBlock(block.id, draft)
    navigate('/train/futas')
  }

  const addWeekToDraft = () => setDraft((d) => ({ ...d, weeks: Math.min(8, (d.weeks || 1) + 1), structure: addWeek(d.structure) }))
  const removeWeek = () => {
    setDraft((d) => ({ ...d, weeks: Math.max(1, (d.weeks || 1) - 1), structure: removeLastWeek(d.structure) }))
    setSelectedWeek((w) => Math.min(w, Math.max(1, (draft.weeks || 1) - 1)))
  }

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

  if (!draft.structure) {
    return <div style={{ padding: 24 }}><span className="text-secondary" style={{ fontSize: 13 }}>Betöltés…</span></div>
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="eyebrow" style={{ color: RUN }}>Builder · {statusEyebrow}</span>
          <div className="row gap-md">
            <span className="label-mono" style={{ fontSize: 9, color: dirty ? 'var(--text-tertiary)' : 'var(--success)' }}>
              {runningMutationPending ? 'Mentés…' : dirty ? 'Nem mentve' : '✓ Mentve'}
            </span>
            <OverflowMenu
              onDuplicate={() => saveRunningBlock(null, duplicateDraft(block), { onSuccess: backToList })}
              onDelete={() => deleteRunningBlock(block.id, { onSuccess: backToList })}
            />
          </div>
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

      {/* Week add/remove row — 1–8 */}
      <div style={{ padding: '16px 24px 4px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="label-mono">Hetek · 1–8</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: draft.weeks || 1 }, (_, i) => i + 1).map((w) => {
            const active = w === clampedWeek
            return (
              <button key={w} type="button" aria-pressed={active} onClick={() => setSelectedWeek(w)} className="notch-4"
                style={{ minWidth: 38, padding: '8px 10px', background: active ? 'color-mix(in srgb, var(--info) 8%, transparent)' : 'var(--surface-1)', border: `1px solid ${active ? 'color-mix(in srgb, var(--info) 40%, transparent)' : 'var(--border-subtle)'}`, color: active ? RUN : 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}>
                {w}
              </button>
            )
          })}
          {(draft.weeks || 1) > 1 && (
            <button type="button" aria-label="Utolsó hét eltávolítása" onClick={removeWeek} className="notch-4"
              style={{ minWidth: 38, padding: '8px 10px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>−</button>
          )}
          {(draft.weeks || 1) < 8 && (
            <button type="button" aria-label="Hét hozzáadása" onClick={addWeekToDraft} className="notch-4"
              style={{ minWidth: 38, padding: '8px 10px', background: 'transparent', border: '1px dashed color-mix(in srgb, var(--info) 45%, transparent)', color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 14 }}>＋</button>
          )}
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

      {/* Single status CTA */}
      <div className="col gap-sm" style={{ padding: '16px 24px 32px' }}>
        {block.status === 'planned' && (
          <CtaPrimary className="notch-8" onClick={() => { activateRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            <Icon name="check" size={16} /> Aktiválás · {block.startDate}
          </CtaPrimary>
        )}
        {block.status === 'active' && (
          <CtaGhost className="notch-4" style={{ padding: 12, borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
            onClick={() => { closeRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            Lezárás
          </CtaGhost>
        )}
      </div>
    </div>
  )
}

function OverflowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-label="További műveletek" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="notch-4" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 16 }}>⋯</button>
      {open && (
        <div className="card notch-4" style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, minWidth: 150, background: 'var(--surface-3)', border: '1px solid var(--border-strong)' }}>
          <button type="button" onClick={() => { setOpen(false); onDuplicate() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>Duplikálás</button>
          <button type="button" onClick={() => { setOpen(false); onDelete() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, color: 'var(--error)' }}>Törlés</button>
        </div>
      )}
    </div>
  )
}
