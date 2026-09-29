import { useEffect, useState } from 'react'
import { MemoryChip } from '@/features/insights/components/memory/MemoryChip'
import { ForgetAllSheet } from '@/features/insights/sheets/ForgetAllSheet'
import { useForgetAllPreview, useTurnMemory, useTurnMemoryActions } from '@/data/insights/turnMemoryHooks'
import type { TurnAnchor } from '@/data/insights/turnMemoryApi'
import { useToast } from '@/shared/ui/ToastProvider'

/**
 * S8 (mezo-d6ivw.12): one chat turn's memory under its answer — learned person facts
 * (Megjegyeztem), owner proposals (Megjegyezném → kept), and a forget turn's list (Elfelejtettem
 * + the widen offer). `forgottenRefs` is the page-wide set of forgotten item ids, so an EARLIER
 * turn's chip turns into "Elfelejtve · …" when a later turn forgets it. While the extractors are
 * still running and nothing is back, the S3 "még figyelek…" status shows; nothing at all → nothing.
 *
 * Owner ruling 2026-09-28: a forget request forgets only the preceding message; when that learned
 * nothing the forgotten list comes back EMPTY; the backend flags the turn (`forgetRequest`, from
 * its ForgetIntent), so a loaded, empty forget turn renders the forgotten chip's empty state (with
 * the widen offer), never nothing.
 *
 * mezo-d6ivw.13: a learned person fact carries „Rólam is" — the owner can claim it as their own
 * too (a copy in the Tudástár Rólad section); the sub-line says where it shows.
 *
 * Final review: an action's done state lives in the turn's cache too (`undone` / `rejected`, see
 * useTurnMemoryActions), so a confirmation survives a remount or a late refetch.
 */
export function TurnMemoryChips({ conversationId, anchor, forgottenRefs, onForgotten }: {
  conversationId: string | null
  anchor: TurnAnchor
  forgottenRefs: ReadonlySet<string>
  onForgotten: (refIds: string[]) => void
}) {
  const { memory, pending, loaded } = useTurnMemory(conversationId, anchor)
  const actions = useTurnMemoryActions(conversationId, anchor)
  const toast = useToast()
  const [widened, setWidened] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const emptyForget = loaded && memory.forgetRequest && memory.forgotten.length === 0
  const showForgotten = memory.forgotten.length > 0 || emptyForget
  const preview = useForgetAllPreview(conversationId, showForgotten && !widened)
  const forgottenIds = memory.forgotten.map((f) => f.refId).join(',')
  useEffect(() => {
    if (forgottenIds) onForgotten(forgottenIds.split(','))
  }, [forgottenIds, onForgotten])

  if (memory.learned.length + memory.proposed.length === 0 && !showForgotten) {
    return pending ? (
      <div className="mzc-rempend row gap-xs" role="status" aria-label="Mezo még figyel">
        <span className="mzc-rempend-dot" aria-hidden="true" />
        <span className="mzc-rempend-tx">még figyelek…</span>
      </div>
    ) : null
  }
  const rest = preview.data ?? []
  let delay = 0.3
  const next = () => { const d = delay; delay += 0.12; return d }
  return (
    <div className="mzc-memturn">
      {memory.learned.map((f) => (
        <MemoryChip key={f.id} variant="remembered" item={{ who: f.who, text: f.text }} sensitive={f.kind === 'sensitivity'}
          sub={f.aboutMeFactId ? `${f.who} lapján és a Tudástár Rólad részében is látod` : `${f.who} lapján látod`}
          forgotten={forgottenRefs.has(f.id)} done={f.undone} delay={next()} onUndo={() => actions.undoLearned(f.personId, f.id)}
          aboutMe={{
            on: f.aboutMeFactId != null,
            onToggle: async () => {
              const on = f.aboutMeFactId == null
              await actions.toggleAboutMe(f.id, on)
              toast.show({ kind: 'success', text: on ? 'Rólad is megjegyeztem.' : `Csak ${f.who} lapján marad.` })
            },
          }} />
      ))}
      {memory.proposed.map((c) => (c.state === 'kept' ? (
        <MemoryChip key={`${c.id}-kept`} variant="remembered" item={{ text: c.text }} sub="a Tudástár Rólad részében látod"
          forgotten={forgottenRefs.has(c.id) || (c.promotedFactId != null && forgottenRefs.has(c.promotedFactId))}
          done={c.undone} delay={next()}
          onUndo={() => (c.promotedFactId
            ? actions.forgetKept(c.promotedFactId)
            : Promise.reject(new Error('kept proposal without a promoted fact')))} />
      ) : (
        <MemoryChip key={c.id} variant="proposed" item={{ text: c.text }} forgotten={forgottenRefs.has(c.id)}
          rejected={c.rejected} delay={next()}
          onAccept={async () => {
            await actions.accept(c.id)
            toast.show({ kind: 'success', text: 'Elmentve — a Tudástárban bármikor elhallgattathatod.' })
          }}
          onReject={() => actions.reject(c.id)} />
      )))}
      {showForgotten && (
        <MemoryChip variant="forgotten" items={memory.forgotten} delay={next()}
          canWiden={!widened && rest.length > 0} onWiden={() => setSheetOpen(true)} />
      )}
      {sheetOpen && (
        <ForgetAllSheet items={rest} onClose={() => setSheetOpen(false)} onConfirm={async () => {
          const items = await actions.forgetAll()
          onForgotten(items.map((i) => i.refId))
          setWidened(true)
          toast.show({ kind: 'success', text: 'Elfelejtve — ebből a beszélgetésből semmit nem tartok meg.' })
        }} />
      )}
    </div>
  )
}
