import { useState } from 'react'
import { useProtocol, useProtocolActions, useStack } from '@/data/hooks'
import type { SupplementStashItem } from '@/data/types'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { Icon } from '@/shared/ui/Icon'
import { useToast } from '@/shared/ui/ToastProvider'

function rowTone(item: SupplementStashItem) {
  if (item.caffeine) return 'is-gold'
  if (item.type === 'medication') return 'is-rose'
  if (item.type === 'stimulant') return 'is-lav'
  return 'is-sage'
}

export function FuelStackAddPage() {
  const { stash, pending } = useStack()
  const { occurrences } = useProtocol()
  const { addItem } = useProtocolActions()
  const { show } = useToast()
  const [query, setQuery] = useState('')
  const occupied = new Set(occurrences.map(occurrence => occurrence.pantryItemId))
  const filtered = stash.filter(item => `${item.name} ${item.brand ?? ''}`.toLocaleLowerCase('hu')
    .includes(query.toLocaleLowerCase('hu')))

  async function handleAdd(item: SupplementStashItem) {
    try {
      await addItem(item.id)
      show({ kind: 'success', text: `${item.name} hozzáadva` })
    } catch {
      // The global MutationCache owns error feedback.
    }
  }

  return (
    <StackPageScaffold tone="gold" backTo="/fuel/stack/manage" backLabel="‹ Kezelés"
      icon="i-kamra" name="Új tétel a Kamrából" big={pending ? '—' : `${stash.length}`} sub="elérhető kamratétel">
      <label className="stk-add-search rise">
        <Icon name="search" size={15} />
        <span className="sr-only">Keresés a Kamrában</span>
        <input type="search" aria-label="Keresés a Kamrában" value={query}
          onChange={event => setQuery(event.target.value)} placeholder="Név vagy márka…" />
      </label>
      <div className="stk-add-list">
        {filtered.map(item => (
          <button type="button" className={`stk-add-row ${rowTone(item)} rise`} key={item.id}
            onClick={() => { void handleAdd(item) }}>
            <span className="stk-add-symbol" aria-hidden="true"><Icon name="plus" size={14} /></span>
            <span className="stk-add-copy">
              <strong>{item.name}</strong>
              <small>{item.brand && `${item.brand} · `}{item.dose}</small>
            </span>
            {occupied.has(item.id) && <span className="stk-add-occupied">a stackben</span>}
            <span aria-hidden="true">＋</span>
          </button>
        ))}
        {!pending && filtered.length === 0 && <div className="stk-detail-state">Nincs ilyen tétel a Kamrában.</div>}
      </div>
    </StackPageScaffold>
  )
}
