// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — searchable exercise explorer + records.
// Default state: "Top gyakorlatok" ranked by sessionCount (backend order).
// Active search/filter switches to full-catalog results: record rows first,
// then dashed ghost rows for catalog items without history (STIM meter).
// Tapping a record row opens ExerciseRecordSheet (mockup variant A). Mock mode
// has no set history -> records are empty, the catalog search still works
// over the static library. Mockup-validated (visual companion, mezo-wua).
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { MUSCLE_FILTERS, FILTER_LABELS, matchesMuscleFilter } from '@/features/train/logic/muscleFilters'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { ExerciseRecordSheet } from '@/features/train/sheets/ExerciseRecordSheet'
import ExercisesSkeleton from '@/features/train/pages/ExercisesSkeleton'

const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')

function RecordRow({ record, rank, onOpen }: {
  record: ExerciseRecordResponse; rank: number | null; onOpen: () => void
}) {
  const r = record
  return (
    <button className="card notch-4 row" onClick={onOpen}
      style={{ padding: 12, alignItems: 'center', textAlign: 'left', width: '100%' }}>
      {rank != null && (
        <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)', width: 22, flexShrink: 0 }}>
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="col flex-1">
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.name}</span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
          {(MUSCLE_LABELS[r.muscle] ?? r.muscle).toUpperCase()} · {r.sessionCount} ALKALOM
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span className="label-mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
          {r.bestSet ? `${num(r.bestSet.weightKg!)}×${r.bestSet.reps}` : `${r.totalReps} rep`}
        </span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 8 }}>
          {r.bestSet ? 'LEGJOBB SZETT' : 'ÖSSZES REP'}
        </span>
      </div>
      <span className={cn('chip', 'notch-4', r.bestE1rm && 'brand')} style={{ fontSize: 9, marginLeft: 12, flexShrink: 0 }}>
        {r.bestE1rm ? `e1RM ${num(r.bestE1rm.value)}` : r.type.toUpperCase()}
      </span>
    </button>
  )
}

function GhostRow({ item }: { item: ExerciseLibraryItem }) {
  return (
    <div className="row" style={{
      padding: 12, alignItems: 'center', background: 'var(--surface-1)',
      border: '1px dashed var(--border-strong)', opacity: 0.75,
    }}>
      <div className="col flex-1">
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
          {(MUSCLE_LABELS[item.muscle] ?? item.muscle).toUpperCase()} · MÉG NINCS REKORD
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span className="label-mono" style={{ fontSize: 8, color: 'var(--brand-glow)' }}>STIM</span>
        <div className="row gap-xs mt-xs">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{
              width: 4, height: 8,
              background: n / 5 <= item.stim ? 'var(--brand-glow)' : 'var(--surface-2)',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ExercisesPage() {
  const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [openRecord, setOpenRecord] = useState<ExerciseRecordResponse | null>(null)

  // Real-mode loading: show the layout-aware skeleton until the catalog + records
  // queries resolve (exercisesPending), before the records ghost-state branch. After
  // all hooks. Mock mode seeds synchronously → never pending → no skeleton.
  if (exercisesPending) return <ExercisesSkeleton />

  const searching = search !== '' || filter !== 'all'
  const q = search.toLowerCase()

  const records = exerciseRecords.filter(
    (r) => matchesMuscleFilter(r.muscle, r.type, filter) && (q === '' || r.name.toLowerCase().includes(q)),
  )
  // catalog items with no record yet (identity match by catalogId, then by name)
  const recordKeys = new Set(
    exerciseRecords.flatMap((r) => [r.catalogId, r.name.toLowerCase()].filter(Boolean) as string[]),
  )
  const ghosts = searching
    ? exerciseLibrary.filter(
        (e) =>
          !recordKeys.has(e.catalogId ?? '') && !recordKeys.has(e.name.toLowerCase()) &&
          matchesMuscleFilter(e.muscle, e.type, filter) &&
          (q === '' || e.name.toLowerCase().includes(q)),
      )
    : []

  return (
    <>
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Gyakorlatok</Eyebrow>
          <PageTitle>Gyakorlatok</PageTitle>
        </div>
      </div>

      <div style={{ padding: '0 24px 8px' }}>
        {/* Search */}
        <div className="card notch-4" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="search" size={14} color="var(--text-tertiary)" />
          <input
            placeholder="Keresés · pl. bench, squat, row"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: '6px 0' }}
          />
        </div>
        {/* Muscle / plyo filter chips */}
        <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 4, paddingBottom: 4 }}>
          {MUSCLE_FILTERS.map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              aria-pressed={filter === m}
              className={cn('chip', 'notch-4', filter === m && 'brand')}
              style={{ fontSize: 9, padding: '6px 10px', flexShrink: 0 }}
            >
              {FILTER_LABELS[m] ?? MUSCLE_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
          <span className="eyebrow">{searching ? 'Találatok · teljes katalógus' : 'Top gyakorlatok · rekordjaid'}</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
            {searching ? `${records.length + ghosts.length} / ${exerciseLibrary.length}` : `${exerciseRecords.length} PR`}
          </span>
        </div>

        {!searching && records.length === 0 ? (
          <GhostState lines={3} message="Az első logolt edzés után itt nőnek a rekordjaid — keresni már most tudsz a katalógusban." />
        ) : (
          <div className="col gap-sm">
            {records.map((r, i) => (
              <RecordRow
                key={r.catalogId ?? r.name}
                record={r}
                rank={searching ? null : i + 1}
                onOpen={() => setOpenRecord(r)}
              />
            ))}
            {ghosts.map((g) => (
              <GhostRow key={g.id} item={g} />
            ))}
            {searching && records.length + ghosts.length === 0 && (
              <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>
                Nincs találat ezzel a szűrővel.
              </p>
            )}
          </div>
        )}
      </div>

      {openRecord && (
        <ExerciseRecordSheet
          record={openRecord}
          videoUrl={
            openRecord.catalogId
              ? exerciseLibrary.find((e) => e.catalogId === openRecord.catalogId)?.videoUrl ?? null
              : null
          }
          onClose={() => setOpenRecord(null)}
        />
      )}
    </>
  )
}
