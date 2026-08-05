// ============================================================
// Mezo · RoutineEditorPage — "/me/routines/edit" full-screen editor for the habit catalog
// (mezo-n5e9.2): every chain as a card (daypart + title + active toggle + edit), its defs as a
// SortableList (drag or ▲▼ to reorder — MesoEditor.tsx:195-207 idiom), a per-chain "+ Új habit"
// row, and a bottom "+ Új rutin" CTA. Sibling of `me/goals/new` (full-screen, no Me sub-nav
// chrome) — entered from RoutinesTab's "Szerkesztés" button (today view only).
// ============================================================
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/hooks'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { HabitEditSheet } from '@/features/me/sheets/HabitEditSheet'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { PageTitle } from '@/shared/ui/PageTitle'
import { SortableList } from '@/shared/ui/SortableList'
import { Toggle } from '@/shared/ui/Toggle'
import type { HabitChainInfo, HabitDaypart, HabitDefInfo } from '@/data/types'

const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }

export function RoutineEditorPage() {
  const { catalog, isPending } = useHabitCatalog()
  const { updateChain, updateDef, reorderChain, pending } = useHabitCatalogActions()
  // undefined chain/def inside the wrapper object → create mode; a real one → edit. The
  // wrapper (not the value itself) is what gates the conditional mount, so `{ chain: undefined }`
  // (create) is still truthy and distinct from `null` (closed).
  const [chainSheet, setChainSheet] = useState<{ chain?: HabitChainInfo } | null>(null)
  const [habitSheet, setHabitSheet] = useState<{ chainKey: string; def?: HabitDefInfo } | null>(null)

  const chains = [...catalog.chains].sort((a, b) => a.position - b.position)

  return (
    <div style={{ padding: '0 16px 32px' }}>
      <div className="row" style={{ padding: '6px 0 0' }}>
        <Link
          to="/me/growth"
          aria-label="Vissza"
          className="rad-16"
          style={{
            width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1,
          }}
        >‹</Link>
      </div>
      <div className="page-header">
        <PageTitle>Rutinok szerkesztése</PageTitle>
      </div>

      {isPending && chains.length === 0 ? (
        <GhostState message="Rutinok betöltése…" />
      ) : (
        <div className="col gap-md">
          {chains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              disabled={pending}
              onToggle={() => updateChain(chain.id, { isActive: !chain.isActive })}
              onEdit={() => setChainSheet({ chain })}
              onReorder={(ids) => reorderChain(chain.id, ids)}
              onToggleDef={(def) => updateDef(def.id, { isActive: !def.isActive })}
              onEditDef={(def) => setHabitSheet({ chainKey: chain.chainKey, def })}
              onAddHabit={() => setHabitSheet({ chainKey: chain.chainKey })}
            />
          ))}
          <button type="button" className="cta-primary" onClick={() => setChainSheet({})}>
            <Icon name="plus" size={14} /> Új rutin
          </button>
        </div>
      )}

      {chainSheet && <ChainEditSheet chain={chainSheet.chain} onClose={() => setChainSheet(null)} />}
      {habitSheet && (
        <HabitEditSheet chainKey={habitSheet.chainKey} def={habitSheet.def} onClose={() => setHabitSheet(null)} />
      )}
    </div>
  )
}

function ChainCard({
  chain, disabled, onToggle, onEdit, onReorder, onToggleDef, onEditDef, onAddHabit,
}: {
  chain: HabitChainInfo
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
    <div className={cn('card', !chain.isActive && 'is-inert')} style={{ padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="row" style={{ alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true">{DAYPART_EMOJI[chain.daypart]}</span>
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
