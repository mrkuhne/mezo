// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — searchable exercise explorer + records.
// Default state: "Top gyakorlatok" ranked by sessionCount (backend order).
// Active search/filter switches to full-catalog results: record rows first,
// then dashed ghost rows for catalog items without history (STIM meter).
// Cards are variant-A three-zone cards (mezo-kaui): muscle-color rail +
// rank plaque + name + integrated ▶/⋯ roundels · colored pill row (filled
// amber plyo pill) · 3-cell stat strip (weighted vs bodyweight branch).
// Tapping a record row opens ExerciseRecordSheet; ⋯ opens CatalogExerciseSheet
// (edit + delete live there); ▶ opens VideoUrlSheet. Mock mode has no set
// history -> records are empty, the catalog search still works.
// ============================================================
import { useState, type ReactNode } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MUSCLE_FILTERS, FILTER_LABELS, matchesMuscleFilter } from '@/features/train/logic/muscleFilters'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { ExerciseRecordSheet } from '@/features/train/sheets/ExerciseRecordSheet'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import { VideoUrlSheet } from '@/features/train/sheets/VideoUrlSheet'
import ExercisesSkeleton from '@/features/train/pages/ExercisesSkeleton'

const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')
// Σ volume, whole kg from the API → "4.2 t" above a tonne, "860 kg" below.
// num() (Math.round-based) avoids toFixed's float-drift on values like 182.45.
const fmtVolume = (kg: number) => (kg >= 1000 ? `${num(kg / 1000)} t` : `${kg} kg`)
// Best single-set rep count for the bodyweight stat branch: repRecords first
// (all-time records), recentTopSets as fallback (bodyweight rows can ship
// empty repRecords — see the Box Jump fixture), else null → em dash.
const maxRep = (r: ExerciseRecordResponse): number | null => {
  const src = r.repRecords.length ? r.repRecords : r.recentTopSets
  return src.length ? Math.max(...src.map((s) => s.reps)) : null
}

// Mono uppercase pill — the card's secondary-info unit (muscle/type/sessions/Saját).
function Pill({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span
      className="label-mono"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999,
        padding: '4px 9px', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em',
        textTransform: 'uppercase', whiteSpace: 'nowrap', background: bg, color,
      }}
    >
      {children}
    </span>
  )
}

// One cell of the hairline-topped stat strip (label over value).
function StatCell({ label, value, color, first }: {
  label: string; value: string; color?: string; first?: boolean
}) {
  return (
    <div style={{ flex: 1, ...(first ? {} : { borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }) }}>
      <div className="label-mono text-tertiary" style={{ fontSize: 7.5 }}>{label}</div>
      <div className="label-mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

// Round icon button (▶ video / ⋯ edit) — sits over the card, outside the open-button
// so we never nest <button> in <button>.
function Roundel({ label, onClick, bg, color, size = 30, children }: {
  label: string; onClick: () => void; bg: string; color: string; size?: number; children: ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: 999, border: 'none', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: bg, color, fontSize: 10, fontWeight: 700,
      }}
    >
      {children}
    </button>
  )
}

function RecordRow({ record, rank, lib, onOpen, onVideo, onEdit }: {
  record: ExerciseRecordResponse
  rank: number | null
  lib?: ExerciseLibraryItem
  onOpen: () => void
  onVideo?: () => void
  onEdit?: () => void
}) {
  const r = record
  const mc = muscleColor(r.muscle)
  // Bodyweight sets arrive BOTH as absent weightKg (contract doc) AND as
  // weightKg: 0 (live backend logs bodyweight sets with weight 0) → the
  // weighted stat branch needs an actual load, not just a present field.
  const weighted = (r.bestSet?.weightKg ?? 0) > 0
  const best = maxRep(r)
  // reserve header space for the absolutely-positioned roundels
  const actionPad = onEdit && onVideo ? 66 : onVideo || onEdit ? 34 : 0
  return (
    <div className="card" style={{ display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 5, background: mc.rail, flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, position: 'relative', padding: '14px 14px 12px' }}>
        <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
          <div className="row" style={{ alignItems: 'center', gap: 10, paddingRight: actionPad }}>
            {rank != null && (
              <span
                className="label-mono"
                style={{
                  width: 26, height: 26, borderRadius: 8, background: mc.wash, color: mc.deep,
                  fontSize: 11, fontWeight: 800, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {rank}
              </span>
            )}
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {r.name}
            </span>
          </div>
          <div className="row" style={{ gap: 6, margin: '10px 0 12px', flexWrap: 'wrap' }}>
            <Pill bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</Pill>
            {r.type === 'plyo' ? (
              // --amber is bright in BOTH themes; --ink flips → deliberate literal warm ink.
              <Pill bg="var(--amber)" color="#2B2118">⚡ Plyo</Pill>
            ) : (
              <Pill bg="var(--surface-2)" color="var(--text-secondary)">{r.type}</Pill>
            )}
            <Pill bg="var(--surface-2)" color="var(--text-secondary)">{r.sessionCount} alkalom</Pill>
            {lib?.editable && <Pill bg="var(--wash-amber)" color="var(--coral-deep)">Saját</Pill>}
          </div>
          <div className="row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            {weighted ? (
              <>
                <StatCell first label="Legjobb szett" value={`${num(r.bestSet!.weightKg!)}×${r.bestSet!.reps}`} />
                <StatCell
                  label="e1RM"
                  value={r.bestE1rm ? `${num(r.bestE1rm.value)} kg` : '—'}
                  color={r.bestE1rm ? 'var(--coral-deep)' : undefined}
                />
                <StatCell label="Összvolumen" value={fmtVolume(r.totalVolume)} />
              </>
            ) : (
              <>
                <StatCell first label="Max rep" value={best != null ? String(best) : '—'} />
                <StatCell label="Összes rep" value={String(r.totalReps)} />
                <StatCell label="Szettek" value={String(r.totalSets)} />
              </>
            )}
          </div>
        </button>
        <div className="row gap-xs" style={{ position: 'absolute', top: 12, right: 12 }}>
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)" size={26}>
              ⋯
            </Roundel>
          )}
          {onVideo && (
            <Roundel
              label={lib?.videoUrl ? 'Videó szerkesztése' : 'Videó hozzáadása'}
              onClick={onVideo}
              bg={lib?.videoUrl ? mc.wash : 'var(--surface-2)'}
              color={lib?.videoUrl ? mc.deep : 'var(--text-quaternary)'}
            >
              ▶
            </Roundel>
          )}
        </div>
      </div>
    </div>
  )
}

function GhostRow({ item, onVideo, onEdit }: {
  item: ExerciseLibraryItem
  onVideo?: () => void
  onEdit?: () => void
}) {
  const mc = muscleColor(item.muscle)
  return (
    <div
      style={{
        display: 'flex', overflow: 'hidden', borderRadius: 20,
        border: '1px dashed var(--border-strong)', opacity: 0.85,
      }}
    >
      <div style={{ width: 5, background: mc.rail, opacity: 0.45, flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, padding: '13px 14px' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>
            {item.name}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div className="label-mono" style={{ fontSize: 7.5, color: mc.deep }}>Stim</div>
            <div className="row gap-xs" style={{ marginTop: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ width: 5, height: 9, background: n / 5 <= item.stim ? mc.rail : 'var(--surface-3)' }} />
              ))}
            </div>
          </div>
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)" size={26}>
              ⋯
            </Roundel>
          )}
          {onVideo && (
            <Roundel
              label={item.videoUrl ? 'Videó szerkesztése' : 'Videó hozzáadása'}
              onClick={onVideo}
              bg={item.videoUrl ? mc.wash : 'var(--surface-2)'}
              color={item.videoUrl ? mc.deep : 'var(--text-quaternary)'}
              size={26}
            >
              ▶
            </Roundel>
          )}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <Pill bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[item.muscle] ?? item.muscle}</Pill>
          <Pill bg="var(--surface-2)" color="var(--text-tertiary)">Még nincs rekord</Pill>
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
  // null = closed · {} = author a new exercise · { edit } = edit an owned row.
  const [catalog, setCatalog] = useState<{ edit?: ExerciseLibraryItem } | null>(null)
  // The catalog row whose demo video is being attached/edited (null = sheet closed).
  const [videoFor, setVideoFor] = useState<{ id: string; name: string; videoUrl: string | null } | null>(null)

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
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Gyakorlatok</div>
          <h1>Gyakorlatok</h1>
        </div>
        <button
          type="button"
          onClick={() => setCatalog({})}
          className="pgact-np np-press"
          style={{ background: 'var(--wash-gym)', color: 'var(--tag-gym)' }}
        >
          <Icon name="plus" size={12} /> Új gyakorlat
        </button>
      </div>

      <div style={{ padding: '0 24px 8px' }}>
        {/* Search */}
        <div className="card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
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
              className={cn('chip', filter === m && 'brand')}
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
            {records.map((r, i) => {
              // Resolve the record's catalog row by id, falling back to name:
              // the live backend returns NO catalogId on name-grouped records
              // (logged exercise row without a catalog link, mezo-u5gk), the
              // same identity fallback the ghost dedup (recordKeys) uses. The
              // video affordance stays gated on a backend catalogId (mock
              // statics never set it).
              const lib =
                (r.catalogId ? exerciseLibrary.find((e) => e.catalogId === r.catalogId) : undefined) ??
                exerciseLibrary.find((e) => e.name.toLowerCase() === r.name.toLowerCase())
              return (
                <RecordRow
                  key={r.catalogId ?? r.name}
                  record={r}
                  rank={searching ? null : i + 1}
                  lib={lib}
                  onOpen={() => setOpenRecord(r)}
                  onVideo={lib?.catalogId ? () => setVideoFor({ id: lib.catalogId!, name: lib.name, videoUrl: lib.videoUrl ?? null }) : undefined}
                  onEdit={lib?.editable ? () => setCatalog({ edit: lib }) : undefined}
                />
              )
            })}
            {ghosts.map((g) => (
              <GhostRow
                key={g.id}
                item={g}
                onVideo={g.catalogId ? () => setVideoFor({ id: g.catalogId ?? g.id, name: g.name, videoUrl: g.videoUrl ?? null }) : undefined}
                onEdit={g.editable ? () => setCatalog({ edit: g }) : undefined}
              />
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

      {catalog && (
        <CatalogExerciseSheet edit={catalog.edit} onClose={() => setCatalog(null)} />
      )}

      {videoFor && (
        <VideoUrlSheet exercise={videoFor} onClose={() => setVideoFor(null)} />
      )}
    </>
  )
}
