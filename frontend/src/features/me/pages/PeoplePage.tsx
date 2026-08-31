// ============================================================
// Mezo · PeoplePage — Emberek re-face (mezo-d20.6.7, Mozaik scaffold mezo-d20.11)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-emberek
// (values ×1.18). ADR 0032: the dissolved Me shell means this page owns its
// OWN header — the prototype's `‹ Én` back chip + the `🎤 Log` page action —
// and the prototype's page-hero (icon + the active-circle count + the
// „aktív kör · tap → részletek" sub-line) replaces the old .pghead-np band,
// which left the page with no way back.
// Body: 2-col washed rose person tiles with an affect-ring avatar (ring fill =
// the person's own latest affectTrend reading, never a fabricated percentage),
// the .fchip filter row, and washed mention tiles carrying the FIGYELEM badge
// + the `kapcsolódik` pattern-tie chip verbatim. Data hooks, mutations and the
// Mind/Hét/Jelölt filter contract: unchanged.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { usePeople } from '@/data/hooks'
import { PersonCard } from '@/features/me/components/PersonCard'
import { MentionRow } from '@/features/me/components/MentionRow'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonDetailSheet } from '@/features/me/sheets/PersonDetailSheet'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'
import type { PersonEntry } from '@/data/types'

type Filter = 'all' | 'week' | 'flagged'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'week', label: 'Hét' },
  { id: 'flagged', label: 'Jelölt' },
]

export function PeoplePage() {
  const navigate = useNavigate()
  const { people, mentions, logMention, undoMention } = usePeople()
  const [filter, setFilter] = useState<Filter>('all')
  const [logOpen, setLogOpen] = useState(false)
  const [prechosen, setPrechosen] = useState<string | undefined>(undefined)
  const [detailPerson, setDetailPerson] = useState<PersonEntry | null>(null)
  const [editPerson, setEditPerson] = useState<PersonEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)

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
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate(-1)} label="‹ Én">
        <button
          type="button"
          className="pgact"
          onClick={() => { setEditPerson(null); setEditOpen(true) }}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          ＋ Új személy
        </button>
        <button
          type="button"
          className="pgact"
          onClick={() => { setPrechosen(undefined); setLogOpen(true) }}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          <Icon name="mic" size={12} /> Log
        </button>
      </PageHead>

      <PageHero icon="i-emberek" name="Kapcsolatok" big={people.length} sub="aktív kör · tap → részletek" />

      <PageBody>
        <EntranceGroup>
          <div className="ppl-grid">
            {people.map((p, i) => (
              <PersonCard key={p.id} person={p} delayMs={i * 50} onTap={() => setDetailPerson(p)} />
            ))}
          </div>

          <div className="tud-lsec rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>Mit naplóztam · friss</span>
          </div>

          <div className="ppl-chiprow rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                className={filter === f.id ? 'ppl-fchip on' : 'ppl-fchip'}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div>
            {visible.slice(0, 8).map((m, i) => (
              <MentionRow key={m.id} mention={m} delayMs={110 + i * 30} onUndo={undoMention} />
            ))}
            {visible.length === 0 && (
              <div className="ppl-mrowt rise" style={{ '--d': '110ms', textAlign: 'center' } as React.CSSProperties}>
                <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ebben a szűrésben.</span>
              </div>
            )}
          </div>
        </EntranceGroup>
      </PageBody>

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
          onEdit={() => {
            setEditPerson(detailPerson)
            setDetailPerson(null)
            setEditOpen(true)
          }}
        />
      )}

      {editOpen && (
        <PersonEditSheet
          person={editPerson}
          onClose={() => { setEditOpen(false); setEditPerson(null) }}
        />
      )}
    </MozaikPage>
  )
}
