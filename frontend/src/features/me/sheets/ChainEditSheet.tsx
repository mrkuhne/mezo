import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useHabitCatalogActions } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

const DAYPART_OPTIONS: { id: HabitDaypart; label: string; emoji: string }[] = [
  { id: 'MORNING', label: 'Reggel', emoji: '🌅' },
  { id: 'DAY', label: 'Napközben', emoji: '☀️' },
  { id: 'EVENING', label: 'Este', emoji: '🌙' },
]

// Mirrors HabitAdminService.deleteChain's seed-chain guard (habitAdminHooks.ts's
// mockDeleteChain) — the two catalog-seed keys are never deletable, whatever their
// current defs. Kept as a literal pair here deliberately: this is the actual protected-key
// rule the backend enforces, not the hardcoded-daypart-map smell mezo-n5e9.4 removed
// elsewhere (todayItems.ts/TodayPage.tsx read every chain via the catalog; this is a write-side
// business rule about exactly those two keys).
const SEED_CHAIN_KEYS = new Set(['MORNING', 'EVENING'])

/** Chain create/edit sheet (routine editor, mezo-n5e9.2). Delete is offered only for an
 *  EDITABLE existing chain — a custom (non-seed) chain with no defs left; otherwise an
 *  explainer replaces the button so nothing dead-ends into a 409 the user can't see coming. */
export function ChainEditSheet({ chain, onClose }: { chain?: HabitChainInfo; onClose: () => void }) {
  const { createChain, updateChain, deleteChain, pending } = useHabitCatalogActions()
  const [title, setTitle] = useState(chain?.title ?? '')
  const [daypart, setDaypart] = useState<HabitDaypart>(chain?.daypart ?? 'MORNING')

  const isSeed = chain != null && SEED_CHAIN_KEYS.has(chain.chainKey)
  const isEmpty = chain != null && chain.defs.length === 0
  const canDelete = chain != null && !isSeed && isEmpty

  const save = (close: () => void) => {
    if (chain) updateChain(chain.id, { title, daypart }).then(close)
    else createChain({ title, daypart }).then(close)
  }
  const remove = (close: () => void) => {
    if (chain) deleteChain(chain.id).then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="chain-edit-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="chain-edit-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {chain ? 'Rutin szerkesztése' : 'Új rutin'}
          </h2>

          <input
            aria-label="Rutin neve"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="pl. Ebéd utáni szünet"
            style={{ background: 'var(--surface-2)', padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)' }}
          />

          <div className="row gap-sm">
            {DAYPART_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                aria-pressed={daypart === o.id}
                onClick={() => setDaypart(o.id)}
                style={daypart === o.id
                  ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                  : undefined}
              >
                {o.emoji} {o.label}
              </button>
            ))}
          </div>

          {chain && (
            canDelete ? (
              <button
                type="button"
                className="cta-ghost"
                disabled={pending}
                style={{ opacity: pending ? 0.5 : 1 }}
                onClick={() => remove(close)}
              >
                <Icon name="trash" size={13} /> Rutin törlése
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {isSeed ? 'Az alap rutinok nem törölhetők.' : 'Csak üres rutin törölhető.'}
              </span>
            )
          )}

          <button
            type="button"
            className="cta-primary"
            disabled={pending || title.trim().length === 0}
            style={{ opacity: pending || title.trim().length === 0 ? 0.5 : 1 }}
            onClick={() => save(close)}
          >
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
