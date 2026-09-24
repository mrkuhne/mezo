// ============================================================
// Mezo · RunningBlockBuilderPage — full-screen takeover for a single running
// block (sibling route /train/futas/:id, NO sub-nav). Glass back pill (‹ Futás),
// status-aware eyebrow + auto-save indicator + ⋯ overflow menu (Duplikálás /
// Törlés), editable title + goal, a 1–8 add/remove week row driving the
// RunWeekEditor, and a single status-dependent bottom CTA (Aktiválás | Lezárás).
// Edits auto-save (debounced) and flush on back.
// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `futasterv()` +
// `SH.blkmenu`): the form is ONE sky glass card with flat inputs, week chips and
// flat week-editor rows inside; the saved state wears the 3D tick; the CTA is the
// lit sky primary; the ⋯ menu a glass round button over a glass menu card.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRunning } from '@/data/hooks'
import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead } from '@/shared/ui/mozaik'
import { RunWeekEditor } from '@/features/train/components/RunWeekEditor'
import { toUpsert, duplicateDraft, addWeek, removeLastWeek } from '@/data/train/runningDraft'
import type { RunningBlockUpsertRequest } from '@/data/train/runningApi'

const SKY = { '--c': 'var(--dv-sky)' } as CSSProperties

export function RunningBlockBuilderPage() {
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
      <MozaikPage tone="sky" className="uvs-page uvs-rbb">
        <PageHead glass onBack={backToList} label="Futás" />
        <p className="uvs-ghost uv-empty uv-voice" style={SKY}>Ez a futóterv nem található.</p>
      </MozaikPage>
    )
  }

  if (!draft.structure) {
    return (
      <MozaikPage tone="sky" className="uvs-page uvs-rbb">
        <p className="uvs-ghost uv-empty" style={SKY}>Betöltés…</p>
      </MozaikPage>
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
    <MozaikPage tone="sky" className="uvs-page uvs-rbb">
      <PageHead glass onBack={backToList} label="Futás">
        <OverflowMenu
          onDuplicate={() => saveRunningBlock(null, duplicateDraft(block), { onSuccess: backToList })}
          onDelete={() => deleteRunningBlock(block.id, { onSuccess: backToList })}
        />
      </PageHead>

      {/* Header — eyebrow, the builder status line and the auto-save state */}
      <div className="uvs-rbb-head">
        <span className="uv-eyebrow">Edzés · Futás</span>
        <p>
          <span className="uv-tint" style={SKY}>Builder · {statusEyebrow}</span>
          <span className={dirty || runningMutationPending ? 'uvs-save' : 'uvs-save is-saved'}>
            {runningMutationPending ? 'Mentés…' : dirty ? 'Nem mentve' : <><Icon3D name="t-tick" size={16} />Mentve</>}
          </span>
        </p>
      </div>

      {/* The one glass surface: name, goal, weeks, the week editor — flat inside */}
      <section className="uvs-bform glass" style={SKY}>
        <label className="uvs-field">
          <span className="uv-eyebrow">Terv neve</span>
          <input
            aria-label="Cím"
            className="uvs-inp is-title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Terv neve"
          />
        </label>
        <label className="uvs-field">
          <span className="uv-eyebrow">Cél (pl. sprint-állóképesség)</span>
          <input
            aria-label="Cél"
            className="uvs-inp"
            value={draft.goal ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
            placeholder="Cél (pl. sprint-állóképesség)"
          />
        </label>

        {/* Week add/remove row — 1–8 */}
        <div className="uvs-field">
          <span className="uv-eyebrow">Hetek · 1–8</span>
          <div className="uvs-weeks">
            {Array.from({ length: draft.weeks || 1 }, (_, i) => i + 1).map((w) => {
              const active = w === clampedWeek
              return (
                <button key={w} type="button" aria-pressed={active} onClick={() => setSelectedWeek(w)} className="uvs-wk">
                  {w}
                </button>
              )
            })}
            {(draft.weeks || 1) > 1 && (
              <button type="button" aria-label="Utolsó hét eltávolítása" onClick={removeWeek} className="uvs-wk is-minus">−</button>
            )}
            {(draft.weeks || 1) < 8 && (
              <button type="button" aria-label="Hét hozzáadása" onClick={addWeekToDraft} className="uvs-wk is-add">＋</button>
            )}
          </div>
        </div>

        {/* Week editor */}
        <RunWeekEditor
          structure={draft.structure}
          weekNumber={clampedWeek}
          onStructure={(s) => setDraft((d) => ({ ...d, structure: s }))}
        />
      </section>

      {/* Single status CTA — Aktiválás is the lit sky primary; Lezárás keeps its warning tone */}
      <div className="uvs-rbb-cta">
        {block.status === 'planned' && (
          <button type="button" className="uvs-primary" style={SKY} onClick={() => { activateRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            <Icon3D name="t-tick" size={22} /> Aktiválás · {block.startDate}
          </button>
        )}
        {block.status === 'active' && (
          <button type="button" className="uvs-primary is-warn"
            onClick={() => { closeRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            Lezárás
          </button>
        )}
      </div>
    </MozaikPage>
  )
}

function OverflowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="uvs-menu">
      <button type="button" aria-label="További műveletek" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="uvs-menubtn glass is-round">⋯</button>
      {open && (
        <div className="uvs-menucard glass" style={SKY}>
          <button type="button" onClick={() => { setOpen(false); onDuplicate() }}>
            <Icon3D name="t-repeat" size={28} /><strong>Duplikálás</strong>
          </button>
          <button type="button" className="is-warn" onClick={() => { setOpen(false); onDelete() }}>
            <Icon3D name="t-skip" size={28} /><strong>Törlés</strong>
          </button>
        </div>
      )}
    </div>
  )
}
