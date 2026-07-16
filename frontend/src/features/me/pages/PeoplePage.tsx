import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { usePeople } from '@/data/hooks'
import { PersonCard } from '@/features/me/components/PersonCard'
import { MentionRow } from '@/features/me/components/MentionRow'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonDetailSheet } from '@/features/me/sheets/PersonDetailSheet'
import type { PersonEntry } from '@/data/types'

type Filter = 'all' | 'week' | 'flagged'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'week', label: 'Hét' },
  { id: 'flagged', label: 'Jelölt' },
]

export function PeoplePage() {
  const { people, mentions, logMention } = usePeople()
  const [filter, setFilter] = useState<Filter>('all')
  const [logOpen, setLogOpen] = useState(false)
  const [prechosen, setPrechosen] = useState<string | undefined>(undefined)
  const [detailPerson, setDetailPerson] = useState<PersonEntry | null>(null)

  // "Hét" = rolling 7 days anchored to the newest mention (works for live data AND the mock seed;
  // the old hardcoded '2026-05-18' threshold only made sense for the seed's May dates).
  const newestMs = mentions.reduce((a, m) => Math.max(a, new Date(m.ts).getTime()), 0)
  const weekFloorMs = newestMs - 7 * 86_400_000
  const visible =
    filter === 'all'
      ? mentions
      : filter === 'week'
        ? mentions.filter(m => new Date(m.ts).getTime() >= weekFloorMs)
        : mentions.filter(m => m.flagged)

  return (
    <>
      {/* Header */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Emberek</div>
          <h1>Kapcsolatok</h1>
        </div>
        <button
          type="button"
          className="pgact-np np-press"
          onClick={() => { setPrechosen(undefined); setLogOpen(true) }}
          style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
        >
          <Icon name="mic" size={12} /> Log
        </button>
      </div>

      {/* People grid */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="secthead-np">
          <h3>Aktív kör · {people.length}</h3>
          <span>tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {people.map(p => (
            <PersonCard key={p.id} person={p} onTap={() => setDetailPerson(p)} />
          ))}
        </div>
      </div>

      {/* Mentions feed */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="secthead-np">
          <h3>Mit naplóztam · friss</h3>
          <div className="row gap-xs">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="chip"
                style={filter === f.id
                  ? { fontSize: 9, padding: '3px 8px', background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                  : { fontSize: 9, padding: '3px 8px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="col gap-sm">
          {visible.slice(0, 8).map(m => (
            <MentionRow key={m.id} mention={m} person={people.find(p => p.id === m.person_id)} />
          ))}
          {visible.length === 0 && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ebben a szűrésben.</span>
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <PersonLogSheet
          onClose={() => setLogOpen(false)}
          onSave={logMention}
          people={people}
          initialPersonId={prechosen}
        />
      )}

      {detailPerson && (
        <PersonDetailSheet
          person={detailPerson}
          mentions={mentions.filter(m => m.person_id === detailPerson.id)}
          onClose={() => setDetailPerson(null)}
          onLog={() => {
            setPrechosen(detailPerson.id)
            setDetailPerson(null)
            setLogOpen(true)
          }}
        />
      )}
    </>
  )
}
