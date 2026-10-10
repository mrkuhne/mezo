// ============================================================
// Mezo · RunningBlockBuilderPage — the editor of a single running block (sibling route
// /train/futas/:id). Edits auto-save (debounced) and flush on back.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futasterv()`, args none · `tervezett` ·
// `archiv` · `uj` · `nincs` · `tolt`; sheet `blkmenu`): the hero says where the plan stands
// („Szerkesztő · Aktív · Hét 3/8", the saved state as a pill + a sentence) and carries the one
// status action (Lezárás | Aktiválás · dátum) with the „⋯ Több" link (Duplikálás / Törlés in a
// sheet); then 1 Alapadatok (name, goal), 2 Hetek · 1–8 (the week pills + add / remove), and
// one numbered card per session from RunWeekEditor.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLeaveAfterMutation } from '@/shared/hooks/useBackNav'
import { useRunning } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import {
  Btn, Bub, Card, FoSheetHead, FrameBack, Hero, Input, Lab, Lk, Note, Page, Pill, Pills, Row, Section, Skel, St, useFrameTitle,
} from '@/shared/ui/folyadek'
import { huMonthDay } from '@/shared/lib/dates'
import { RunWeekEditor } from '@/features/train/components/RunWeekEditor'
import { toUpsert, duplicateDraft, addWeek, removeLastWeek } from '@/data/train/runningDraft'
import type { RunningBlockUpsertRequest } from '@/data/train/runningApi'

export function RunningBlockBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const leave = useLeaveAfterMutation()
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
    // the builder is only ever opened from the running list: pop back onto it, so a deleted /
    // closed block (and the builder itself) never stays behind the user
    leave.back('/train/futas')
  }

  const addWeekToDraft = () => setDraft((d) => ({ ...d, weeks: Math.min(8, (d.weeks || 1) + 1), structure: addWeek(d.structure) }))
  const removeWeek = () => {
    setDraft((d) => ({ ...d, weeks: Math.max(1, (d.weeks || 1) - 1), structure: removeLastWeek(d.structure) }))
    setSelectedWeek((w) => Math.min(w, Math.max(1, (draft.weeks || 1) - 1)))
  }

  // The title bar shows the plan's own name (prototype `T0.title = b.t`).
  useFrameTitle({ title: block ? (draft.title || block.title) : 'Futóterv', eyebrow: 'Edzés · Futás' })
  const [menuOpen, setMenuOpen] = useState(false)

  const back = <FrameBack onBack={backToList} className="es-back">‹ Futás</FrameBack>

  if (!block) {
    return (
      <Page className="es-page es-rbb">
        {back}
        <Hero label="Futóterv" verdict="Ez a futóterv nem található." left={<Bub icon="t-run" size={60} />}
          actions={<Btn ghost onClick={backToList}>Vissza a tervekhez</Btn>} />
      </Page>
    )
  }

  if (!draft.structure) {
    return <Page className="es-page es-rbb">{back}<Skel blocks={[250, 200, 200, 300]} /></Page>
  }

  const statusEyebrow =
    block.status === 'active'
      ? `Aktív · Hét ${block.currentWeek}/${block.weeks}`
      : block.status === 'planned'
        ? 'Tervezett'
        : 'Archív'
  const verdict =
    block.status === 'active'
      ? `Aktív terv, a ${block.currentWeek}. hétnél tart.`
      : block.status === 'planned'
        ? 'Ez a terv még nem indult el.'
        : 'Lezárt terv, az archívumban van.'

  const clampedWeek = Math.min(Math.max(selectedWeek, 1), draft.weeks || 1)
  const weekCount = draft.weeks || 1

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper.
    <Page className="es-page es-rbb">
      {back}
      <Hero
        label={`Szerkesztő · ${statusEyebrow}`}
        verdict={verdict}
        // The auto-save state: a pill + what it means.
        sub={runningMutationPending
          ? <><St>Mentés…</St> A változásodat most mentjük.</>
          : dirty
            ? <><St>Nem mentve</St> A változás pár pillanat múlva magától mentődik.</>
            : <><St tone="ok">Mentve</St> Minden változás mentve.</>}
        left={<Bub icon="t-run" size={60} />}
        // Single status action + the overflow link
        actions={(
          <>
            {block.status === 'planned' && (
              <Btn onClick={() => { activateRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
                Aktiválás · {huMonthDay(block.startDate)}
              </Btn>
            )}
            {block.status === 'active' && (
              <Btn onClick={() => { closeRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
                Lezárás
              </Btn>
            )}
            <Lk aria-label="További műveletek" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>⋯ Több</Lk>
          </>
        )}
      >
        {block.status === 'archived' && block.summary && <Note>{block.summary}</Note>}
      </Hero>

      <Section n={1} title="Alapadatok" />
      <Card>
        <Lab htmlFor="rbb-title">Terv neve</Lab>
        <Input
          id="rbb-title"
          aria-label="Cím"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Terv neve"
        />
        <Lab htmlFor="rbb-goal">Cél (pl. sprint-állóképesség)</Lab>
        <Input
          id="rbb-goal"
          aria-label="Cél"
          value={draft.goal ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
          placeholder="Cél (pl. sprint-állóképesség)"
        />
      </Card>

      {/* Week add/remove row — 1–8 */}
      <Section n={2} title="Hetek · 1–8" />
      <Card>
        <Pills className="es-wks" role="group" aria-label="Hetek">
          {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
            <Pill key={w} on={w === clampedWeek} onClick={() => setSelectedWeek(w)}>{w}</Pill>
          ))}
          {weekCount > 1 && (
            <button type="button" className="fo-pill pm" aria-label="Utolsó hét eltávolítása" onClick={removeWeek}>−</button>
          )}
          {weekCount < 8 && (
            <button type="button" className="fo-pill pm" aria-label="Hét hozzáadása" onClick={addWeekToDraft}>＋</button>
          )}
        </Pills>
        <Note>A {clampedWeek}. hét terhelését szerkeszted. A nap és az időpont minden hétre szól.</Note>
      </Card>

      {/* Week editor — one numbered card per session */}
      <RunWeekEditor
        structure={draft.structure}
        weekNumber={clampedWeek}
        onStructure={(s) => setDraft((d) => ({ ...d, structure: s }))}
        firstN={3}
      />

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} labelledBy="rbb-menu-title" className="fo-sheet es-sheet">
          {(close) => (
            <>
              <FoSheetHead titleId="rbb-menu-title" icon="t-run" eyebrow="Futóterv" title="További műveletek" onClose={close} />
              <div className="es-vl">
                <Row icon="t-repeat" title="Duplikálás"
                  onClick={() => { close(); saveRunningBlock(null, duplicateDraft(block), { onSuccess: backToList }) }} />
                <Row icon="t-trash" className="es-danger" title="Törlés"
                  onClick={() => { close(); deleteRunningBlock(block.id, { onSuccess: backToList }) }} />
              </div>
            </>
          )}
        </Sheet>
      )}
    </Page>
  )
}
