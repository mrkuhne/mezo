import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { usePeople } from '@/data/hooks'
import type { PersonEntry, PersonSaveInput, Relationship } from '@/data/types'

const RELS: Array<{ value: Relationship; hu: string }> = [
  { value: 'partner', hu: 'Társ' },
  { value: 'friend', hu: 'Barát' },
  { value: 'family', hu: 'Család' },
  { value: 'colleague', hu: 'Kolléga' },
  { value: 'teammate', hu: 'Csapattárs' },
  { value: 'mentee', hu: 'Mentee' },
]

// PersonEditSheet — kézi felvétel/szerkesztés (mezo-06o0, S1 Task 8). Anatómia a
// docs/design_2.0/prototypes/emberek.html #sh-new szerint; wrapper/chip-nyelv a
// PersonLogSheet-ből átvéve (overlay + card + chip). Nincs emoji a UI-ban.
export function PersonEditSheet({ person, onClose }: { person: PersonEntry | null; onClose: () => void }) {
  const { savePerson, deletePerson } = usePeople()
  const [name, setName] = useState(person?.name ?? '')
  const [aliasInput, setAliasInput] = useState('')
  const [aliases, setAliases] = useState<string[]>(person?.aliases ?? [])
  const [rel, setRel] = useState<Relationship>(person?.relationship ?? 'friend')
  const [notes, setNotes] = useState(person?.notes ?? '')
  const [armDelete, setArmDelete] = useState(false)

  const addAlias = () => {
    const v = aliasInput.trim()
    if (!v || aliases.includes(v)) return
    setAliases([...aliases, v])
    setAliasInput('')
  }

  const submit = () => {
    const input: PersonSaveInput = {
      id: person?.id,
      name: name.trim(),
      aliases,
      relationship: rel,
      relationshipHu: person && person.relationship === rel
        ? person.relationshipHu // kézzel pontosított HU címkét nem írunk felül
        : RELS.find(r => r.value === rel)!.hu,
      notes: notes.trim() || undefined,
      contactCadenceLabel: person?.contactCadenceLabel || undefined,
    }
    savePerson(input)
    onClose()
  }

  const handleDelete = () => {
    if (!person) return
    if (!armDelete) {
      setArmDelete(true)
      return
    }
    deletePerson(person.id)
    onClose()
  }

  return (
    <Sheet onClose={onClose} labelledBy="person-edit-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>People</span>
              <div id="person-edit-title" className="h-display size-md" style={{ marginTop: 4 }}>
                {person ? 'Személy szerkesztése' : 'Új személy'}
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          <div className="col gap-sm">
            <span style={SECTION_LABEL}>Név</span>
            <div className="card" style={{ padding: 10 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="pl. Marci"
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="col gap-sm mt-md">
            <span style={SECTION_LABEL}>Becenevek · a névfigyeléshez</span>
            <div className="row gap-xs flex-wrap" style={{ alignItems: 'center' }}>
              {aliases.map(a => (
                <span key={a} className="chip" style={{ padding: '6px 10px', fontSize: 11, gap: 6 }}>
                  {a}
                  <button
                    type="button"
                    aria-label="Becenév törlése"
                    onClick={() => setAliases(aliases.filter(x => x !== a))}
                    style={{ display: 'inline-flex' }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </span>
              ))}
              <input
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                placeholder="pl. Marcika"
                className="chip"
                style={{ padding: '6px 10px', fontSize: 11, width: 120 }}
              />
              <button type="button" className="chip" onClick={addAlias} style={{ padding: '6px 10px' }}>＋</button>
            </div>
          </div>

          <div className="col gap-sm mt-md">
            <span style={SECTION_LABEL}>Kapcsolat</span>
            <div className="row gap-xs flex-wrap">
              {RELS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={rel === r.value}
                  onClick={() => setRel(r.value)}
                  className="chip"
                  style={{
                    padding: '6px 10px', fontSize: 11,
                    background: rel === r.value ? 'var(--wash-lav)' : 'var(--surface-2)',
                    borderColor: rel === r.value ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    color: rel === r.value ? 'var(--lav-deep)' : 'var(--text-secondary)',
                  }}
                >
                  {r.hu}
                </button>
              ))}
            </div>
          </div>

          <div className="col gap-sm mt-md">
            <span style={SECTION_LABEL}>Jegyzet</span>
            <div className="card" style={{ padding: 10 }}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="honnan ismered, mi fontos…"
                style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 13, lineHeight: 1.45 }}
              />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary flex-1" disabled={!name.trim()} onClick={submit}>
              <Icon name="check" size={14} /> {person ? 'Mentés' : 'Felveszem'}
            </button>
          </div>

          {person && (
            <div className="col gap-sm mt-md">
              <button className="cta-ghost" onClick={handleDelete} style={{ color: 'var(--rose-deep, #C4694F)' }}>
                <Icon name="trash" size={14} /> Törlés
              </button>
              {armDelete && (
                <span className="text-secondary" style={{ fontSize: 11, textAlign: 'center' }}>
                  Biztos? Az említések megmaradnak, a személy eltűnik.
                </span>
              )}
            </div>
          )}

          <span className="text-secondary" style={{ fontSize: 10, lineHeight: 1.5, marginTop: 14, textAlign: 'center' }}>
            mentés után a napló · reflexió · chat szövegében minden név- és becenév-találat magától említés lesz
          </span>
        </div>
      )}
    </Sheet>
  )
}
