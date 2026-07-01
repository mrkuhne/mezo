import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { usePeople } from '@/data/hooks'
import { PersonCard } from '@/features/me/components/PersonCard'
import { MentionRow } from '@/features/me/components/MentionRow'
import { PersonLogSheet } from '@/features/me/PersonLogSheet'
import { PersonDetailSheet } from '@/features/me/PersonDetailSheet'
import type { PersonEntry } from '@/data/types'

type Filter = 'all' | 'week' | 'flagged'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'week', label: 'Hét' },
  { id: 'flagged', label: 'Jelölt' },
]

export function PeopleView() {
  const { people, mentions, logMention } = usePeople()
  const [filter, setFilter] = useState<Filter>('all')
  const [logOpen, setLogOpen] = useState(false)
  const [prechosen, setPrechosen] = useState<string | undefined>(undefined)
  const [detailPerson, setDetailPerson] = useState<PersonEntry | null>(null)

  const visible =
    filter === 'all'
      ? mentions
      : filter === 'week'
        ? mentions.filter(m => m.ts >= '2026-05-18')
        : mentions.filter(m => m.flagged)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Emberek</Eyebrow>
          <PageTitle className="mt-sm">Kapcsolatok</PageTitle>
        </div>
        <button
          className="chip"
          style={{ padding: '8px 10px' }}
          onClick={() => { setPrechosen(undefined); setLogOpen(true) }}
        >
          <Icon name="mic" size={12} /> Log
        </button>
      </div>

      {/* People grid */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Aktív kör · {people.length}</Eyebrow>
          <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {people.map(p => (
            <PersonCard key={p.id} person={p} onTap={() => setDetailPerson(p)} />
          ))}
        </div>
      </div>

      {/* Mentions feed */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, alignItems: 'baseline' }}>
          <Eyebrow>Mit naplóztam · friss</Eyebrow>
          <div className="row gap-xs">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={'chip' + (filter === f.id ? ' brand' : '')}
                style={{ fontSize: 9, padding: '3px 8px' }}
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
            <div className="card notch-4" style={{ padding: 18, textAlign: 'center' }}>
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
