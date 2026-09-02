// ============================================================
// Mezo · RoutineEditorPage — "/me/routines/edit" full-screen editor for the habit catalog
// (mezo-n5e9.2): every chain as a card (daypart + title + active toggle + edit), its defs as a
// SortableList (drag or ▲▼ to reorder — MesoEditor.tsx:195-207 idiom), a per-chain "+ Új habit"
// row, and a bottom "+ Új rutin" CTA. Sibling of `me/goals/weight/new` (full-screen, no Me
// sub-nav chrome) — entered from RoutinesTab's "Szerkesztés" button (today view only).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/hooks'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { HabitEditSheet } from '@/features/me/sheets/HabitEditSheet'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { SortableList } from '@/shared/ui/SortableList'
import { Toggle } from '@/shared/ui/Toggle'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { HabitChainInfo, HabitDaypart, HabitDefInfo } from '@/data/types'

// F7.4: the daypart emojis hand over to EXISTING clay symbols — no new art needed.
const DAYPART_CLAY: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }

export function RoutineEditorPage() {
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { updateChain, updateDef, reorderChain, pending } = useHabitCatalogActions()
  // undefined chain/def inside the wrapper object → create mode; a real one → edit. The
  // wrapper (not the value itself) is what gates the conditional mount, so `{ chain: undefined }`
  // (create) is still truthy and distinct from `null` (closed).
  const [chainSheet, setChainSheet] = useState<{ chain?: HabitChainInfo } | null>(null)
  const [habitSheet, setHabitSheet] = useState<{ chainKey: string; def?: HabitDefInfo } | null>(null)
  // v1: a single page-level entry, always opened with no chainKey preselect (mezo-n5e9.3) — a
  // per-chain preselect can ride the same sheet/state shape later without changing this shape.
  const [suggestSheet, setSuggestSheet] = useState<{ chainKey?: string } | null>(null)

  const navigate = useNavigate()
  const chains = [...catalog.chains].sort((a, b) => a.position - b.position)

  return (
    // F7.4 Mozaik re-face (mezo-d20.8.4.1, en-mely.html): gold shell + eyebrow/title block.
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth" />
      <PageBody>
      <div style={{ padding: '2px 2px 12px' }}>
        <span className="mz-eyebrow">Growth · Rutin</span>
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, lineHeight: 1.15, margin: '4px 0 0', color: 'var(--text-primary)' }}>
          Rutinok szerkesztése
        </h1>
      </div>

      {isPending && chains.length === 0 ? (
        <GhostState message="Rutinok betöltése…" />
      ) : isError && chains.length === 0 ? (
        // A genuinely failed fetch and an honest "not resolved yet" both read as an empty
        // catalog off `catalog.chains` alone — without `isError` this rendered the same
        // inviting "+ Új rutin" create view a real empty catalog gets, hiding the failure.
        // Stale-but-present chains (a refetch failing after a successful first load) fall
        // through to the normal view below instead — only a genuinely EMPTY result on error
        // gets the retry ghost.
        <GhostState message="Nem sikerült betölteni a rutinokat." ctaLabel="Újra" onCta={refetch} />
      ) : (
        // Entrance choreography (mezo-d20.11 audit group A: this page had none at all — the
        // chain cards popped in). One `EntranceGroup` arms the whole list; each chain card and
        // the trailing CTA row carry `.rise` + their own `--d` stagger.
        <EntranceGroup className="col gap-md">
          {chains.map((chain, i) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              delayMs={i * 50}
              disabled={pending}
              onToggle={() => updateChain(chain.id, { isActive: !chain.isActive })}
              onEdit={() => setChainSheet({ chain })}
              onReorder={(ids) => reorderChain(chain.id, ids)}
              onToggleDef={(def) => updateDef(def.id, { isActive: !def.isActive })}
              onEditDef={(def) => setHabitSheet({ chainKey: chain.chainKey, def })}
              onAddHabit={() => setHabitSheet({ chainKey: chain.chainKey })}
            />
          ))}
          <div className="row gap-sm rise" style={{ '--d': `${chains.length * 50 + 40}ms` } as React.CSSProperties}>
            <button type="button" className="cta-primary" style={{ flex: 1.8 }} onClick={() => setChainSheet({})}>
              <Icon name="plus" size={14} /> Új rutin
            </button>
            <button type="button" className="cta-ghost" style={{ flex: 1 }} onClick={() => setSuggestSheet({})}>
              <span aria-hidden="true">✨</span> AI javaslat
            </button>
          </div>
        </EntranceGroup>
      )}

      {chainSheet && <ChainEditSheet chain={chainSheet.chain} onClose={() => setChainSheet(null)} />}
      {habitSheet && (
        <HabitEditSheet chainKey={habitSheet.chainKey} def={habitSheet.def} onClose={() => setHabitSheet(null)} />
      )}
      {suggestSheet && (
        <AiSuggestSheet chainKey={suggestSheet.chainKey} onClose={() => setSuggestSheet(null)} />
      )}
      </PageBody>
    </MozaikPage>
  )
}

function ChainCard({
  chain, delayMs, disabled, onToggle, onEdit, onReorder, onToggleDef, onEditDef, onAddHabit,
}: {
  chain: HabitChainInfo
  delayMs: number
  disabled: boolean
  onToggle: () => void
  onEdit: () => void
  onReorder: (ids: string[]) => void
  onToggleDef: (def: HabitDefInfo) => void
  onEditDef: (def: HabitDefInfo) => void
  onAddHabit: () => void
}) {
  const defs = [...chain.defs].sort((a, b) => a.position - b.position).map((d) => ({ ...d, label: d.title }))
  return (
    // Inactive chains stay fully editable (`.is-inert` only dims — no control below is disabled
    // by it), so a chain can be paused and still tuned before re-activating it.
    <div className={cn('mz-qcard', 'rise', !chain.isActive && 'is-inert')} style={{ padding: '14px 16px', marginBottom: 0, '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="row" style={{ alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex' }}><ClayIcon name={DAYPART_CLAY[chain.daypart]} size={18} /></span>
          <span className="eyebrow">{chain.title}</span>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <Toggle on={chain.isActive} onToggle={onToggle} ariaLabel={`${chain.title} aktív`} disabled={disabled} />
          <button type="button" className="chip" aria-label={`${chain.title} szerkesztése`} onClick={onEdit}>
            <span aria-hidden="true">✏️</span>
          </button>
        </div>
      </div>

      <SortableList
        items={defs}
        onReorder={onReorder}
        renderItem={(def) => (
          <HabitDefRow def={def} disabled={disabled} onToggle={() => onToggleDef(def)} onEdit={() => onEditDef(def)} />
        )}
      />

      <button
        type="button"
        onClick={onAddHabit}
        className="rad-12"
        style={{
          width: '100%', padding: 10, marginTop: defs.length > 0 ? 10 : 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 11, fontWeight: 700, color: 'var(--coral)',
          background: 'color-mix(in srgb, var(--sage) 8%, transparent)', border: '1px dashed var(--line)',
        }}
      >
        <Icon name="plus" size={12} /> Új habit
      </button>
    </div>
  )
}

function HabitDefRow({
  def, disabled, onToggle, onEdit,
}: { def: HabitDefInfo; disabled: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    // The toggle is a SIBLING of the row's own button, never nested inside it (ItemRow's
    // doctrine — a button-in-button is invalid HTML and click-conflicting).
    <div className={cn('row', !def.isActive && 'is-inert')} style={{ alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={onEdit}
        className="row"
        style={{ flex: 1, alignItems: 'center', gap: 8, textAlign: 'left', minWidth: 0 }}
        aria-label={`${def.title} szerkesztése`}
      >
        <span style={{
          flex: 1, fontSize: 13, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        >
          {def.title}
        </span>
        <span className="chip" style={{ fontSize: 9 }}>{def.xp} XP</span>
        <span className="chip" style={{ fontSize: 9 }}>{def.mode}</span>
      </button>
      <Toggle on={def.isActive} onToggle={onToggle} ariaLabel={`${def.title} aktív`} disabled={disabled} />
    </div>
  )
}
