import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { Tool } from '@/components/ui/ToolChip'
import { usePeople } from '@/data/hooks'
import { PeopleCreditHero } from '../components/PeopleCreditHero'
import { RitualCard } from '../components/RitualCard'
import { AttentionRow } from '../components/AttentionRow'
import { PersonCard } from '../components/PersonCard'
import { MentionRow } from '../components/MentionRow'
import { RelationPatternCard } from '../components/RelationPatternCard'

type Filter = 'all' | 'week' | 'flagged'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'week', label: 'Hét' },
  { id: 'flagged', label: 'Jelölt' },
]

const PATTERN_TOOLS: Tool[] = [
  { type: 'read', name: 'get_person_mentions', args: '30d' },
  { type: 'read', name: 'get_checkin_history', args: '7d' },
  { type: 'read', name: 'get_sleep', args: '14d' },
  { type: 'compute', name: 'computePersonAffectCorrelation' },
]

export function PeopleView() {
  const { summary, people, mentions, patterns } = usePeople()
  const [filter, setFilter] = useState<Filter>('all')

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
        {/* Log chip is inert (PersonLogSheet is a deferred follow-up) */}
        <span className="chip" style={{ padding: '8px 10px' }}>
          <Icon name="mic" size={12} /> Log
        </span>
      </div>

      {/* Weekly relational credit */}
      <div style={{ padding: '0 24px 16px' }}>
        <PeopleCreditHero summary={summary} people={people} />
      </div>

      {/* Mizu Velünk ritual */}
      <div style={{ padding: '0 24px 16px' }}>
        <RitualCard ritual={summary.ritualUpcoming} people={people} />
      </div>

      {/* Attention strip */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 10 }}>
          <Eyebrow>Mire figyelünk · most</Eyebrow>
        </div>
        <div className="col gap-sm">
          {summary.attention.map((a, i) => (
            <AttentionRow key={i} item={a} />
          ))}
        </div>
      </div>

      {/* People grid */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Aktív kör · {people.length}</Eyebrow>
          <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {people.map(p => (
            // PersonCard tap is inert (PersonDetailSheet is a deferred follow-up)
            <PersonCard key={p.id} person={p} />
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

      {/* Mezo patterns */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Mezo mit lát · kapcsolatok</Eyebrow>
          <Eyebrow brand>{patterns.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {patterns.map(pat => (
            <RelationPatternCard key={pat.id} pattern={pat} people={people} />
          ))}
        </div>
        <div className="mt-md">
          <ToolChipRow tools={PATTERN_TOOLS} />
        </div>
      </div>

      {/* IDENT-5 privacy footer */}
      <div style={{ padding: '0 24px 32px' }}>
        <div
          className="card notch-4"
          style={{ padding: 14, background: 'rgba(244, 114, 182, 0.04)', borderColor: 'rgba(244, 114, 182, 0.22)' }}
        >
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="anchor" size={12} color="var(--cat-tendency)" />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
              <span style={{ color: 'var(--cat-tendency)', fontWeight: 500 }}>IDENT-5 · belső kör.</span>{' '}
              Ezek a nevek soha nem hagyják el a te eszközöd. Mezo nem ír nekik, nem hív fel senkit, és nem oszt meg semmit kifelé — csak emlékezünk együtt.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
