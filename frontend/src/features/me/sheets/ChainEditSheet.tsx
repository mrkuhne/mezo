import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { useHabitCatalogActions } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

// Üveg (mezo-me75u.7): the daypart emoji became Titanium sprite icons (bible §4, no emoji).
const DAYPART_OPTIONS: { id: HabitDaypart; label: string; art: Icon3DName }[] = [
  { id: 'MORNING', label: 'Reggel', art: 't-dawn' },
  { id: 'DAY', label: 'Napközben', art: 't-sun' },
  { id: 'EVENING', label: 'Este', art: 't-moon' },
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
    <Sheet className="glass rt-sheet" onClose={onClose} labelledBy="chain-edit-title">
      {(close) => (
        <div className="col gap-sm">
          <div className="rt-shh">
            <Icon3D name="t-chain" size={46} />
            <span className="rt-shh-t">
              <span className="rt-shh-eb">Rutin</span>
              <h2 id="chain-edit-title">{chain ? 'Rutin szerkesztése' : 'Új rutin'}</h2>
            </span>
          </div>

          <label className="rt-field">
            <span className="rt-flabel">Név</span>
            <input
              className="rt-fin"
              aria-label="Rutin neve"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pl. Ebéd utáni szünet"
            />
          </label>

          <div className="rt-field">
            <span className="rt-flabel">Napszak</span>
            <div className="rt-chips is-gold">
              {DAYPART_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={cn(daypart === o.id && 'on')}
                  aria-pressed={daypart === o.id}
                  onClick={() => setDaypart(o.id)}
                >
                  <Icon3D name={o.art} size={18} />{o.label}
                </button>
              ))}
            </div>
          </div>

          {chain && (
            canDelete ? (
              <button
                type="button"
                className="rt-danger"
                disabled={pending}
                onClick={() => remove(close)}
              >
                <Icon3D name="t-trash" size={22} />Rutin törlése
              </button>
            ) : (
              <span className="rt-hint">
                {isSeed ? 'Az alap rutinok nem törölhetők.' : 'Csak üres rutin törölhető.'}
              </span>
            )
          )}

          <button
            type="button"
            className="cta-primary rt-litpill"
            disabled={pending || title.trim().length === 0}
            onClick={() => save(close)}
          >
            <Icon3D name="t-tick" size={20} />Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
