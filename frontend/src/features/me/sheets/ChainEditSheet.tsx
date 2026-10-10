import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import type { Icon3DName } from '@/shared/ui/clay'
import { Btn, FoSheetHead, Lab, Note, Pill, Pills, TwoBtn } from '@/shared/ui/folyadek'
import { useHabitCatalogActions } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart } from '@/data/types'

// The daypart wears its glyph (no emoji).
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
 *  explainer replaces the button so nothing dead-ends into a 409 the user can't see coming.
 *  FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `SHEETS.chain`): a light sheet — head with
 *  the icon chip, name, daypart pills, Mégse / Mentés. */
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
    <Sheet className="fo-sheet" onClose={onClose} labelledBy="chain-edit-title">
      {(close) => (
        <>
          <FoSheetHead
            titleId="chain-edit-title" icon="t-chain"
            title={chain ? 'Rutin szerkesztése' : 'Új rutin'} sub="Rutin · lánc" onClose={close}
          />

          <Lab htmlFor="rb-chain-title">Név</Lab>
          <input
            id="rb-chain-title"
            className="fo-in"
            aria-label="Rutin neve"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="pl. Ebéd utáni szünet"
          />

          <Lab>Napszak</Lab>
          <Pills>
            {DAYPART_OPTIONS.map((o) => (
              <Pill key={o.id} on={daypart === o.id} icon={o.art} onClick={() => setDaypart(o.id)}>{o.label}</Pill>
            ))}
          </Pills>

          {chain && (
            canDelete ? (
              <Btn ghost wide icon="t-trash" className="rb-save" disabled={pending} onClick={() => remove(close)}>
                Rutin törlése
              </Btn>
            ) : (
              <Note>{isSeed ? 'Az alap rutinok nem törölhetők.' : 'Csak üres rutin törölhető.'}</Note>
            )
          )}

          <TwoBtn className="rb-save">
            <Btn ghost onClick={close}>Mégse</Btn>
            <Btn disabled={pending || title.trim().length === 0} onClick={() => save(close)}>Mentés</Btn>
          </TwoBtn>
        </>
      )}
    </Sheet>
  )
}
