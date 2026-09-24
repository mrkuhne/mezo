import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
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

  // Üveg (mezo-me75u.7, prototype sheet `pedit`): ONE floating rose glass sheet (bible U2 rule 15);
  // inputs, alias chips and the relationship chips are flat (the chosen one lit rose), Mégse is
  // flat, the save is the lit rose pill; Törlés keeps its warning tone as a flat coral outline
  // (bible U4 rule 29).
  return (
    <Sheet onClose={onClose} labelledBy="person-edit-title" className="glass ppl-sheet">
      {(close) => (
        <div className="ppl-sh">
          <div className="ppl-shh">
            <Icon3D name="t-person" size={48} />
            <div className="ppl-shh-tx">
              <span className="ppl-sh-eye">Emberek</span>
              <div id="person-edit-title" className="ppl-sh-title">
                {person ? 'Személy szerkesztése' : 'Új személy'}
              </div>
            </div>
            <button type="button" className="ppl-sh-x" aria-label="Bezárás" onClick={close}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <label className="ppl-sh-field">
            <span className="ppl-sh-lbl">Név</span>
            <input
              className="ppl-sh-inp"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="pl. Marci"
            />
          </label>

          <div className="ppl-sh-field">
            <span className="ppl-sh-lbl">Becenevek · a névfigyeléshez</span>
            <div className="ppl-sh-chips">
              {aliases.map(a => (
                <span key={a} className="ppl-sh-chip ppl-sh-alias">
                  {a}
                  <button
                    type="button"
                    className="ppl-sh-aliasx"
                    aria-label="Becenév törlése"
                    onClick={() => setAliases(aliases.filter(x => x !== a))}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </span>
              ))}
              <input
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                placeholder="pl. Marcika"
                className="ppl-sh-chip ppl-sh-aliasinp"
              />
              <button type="button" className="ppl-sh-chip ppl-sh-add" onClick={addAlias}>＋</button>
            </div>
          </div>

          <div className="ppl-sh-field">
            <span className="ppl-sh-lbl">Kapcsolat</span>
            <div className="ppl-sh-chips">
              {RELS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={rel === r.value}
                  onClick={() => setRel(r.value)}
                  className={`ppl-sh-chip${rel === r.value ? ' on' : ''}`}
                >
                  {r.hu}
                </button>
              ))}
            </div>
          </div>

          <label className="ppl-sh-field">
            <span className="ppl-sh-lbl">Jegyzet</span>
            <textarea
              className="ppl-sh-ta"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="honnan ismered, mi fontos…"
            />
          </label>

          <div className="ppl-sh-pair">
            <button type="button" className="ppl-sh-ghost" onClick={close}>Mégse</button>
            <button type="button" className="ppl-sh-cta" disabled={!name.trim()} onClick={submit}>
              <Icon3D name="t-tick" size={18} /> {person ? 'Mentés' : 'Felveszem'}
            </button>
          </div>

          {person && (
            <div className="ppl-sh-del">
              <button type="button" className="ppl-sh-delbtn" onClick={handleDelete}>
                <Icon3D name="t-trash" size={18} /> Törlés
              </button>
              {armDelete && (
                <span className="ppl-sh-delwarn">
                  Biztos? Az említések megmaradnak, a személy eltűnik.
                </span>
              )}
            </div>
          )}

          <span className="ppl-sh-foot">
            mentés után a napló · reflexió · chat szövegében minden név- és becenév-találat magától említés lesz
          </span>
        </div>
      )}
    </Sheet>
  )
}
