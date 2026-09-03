// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — searchable exercise explorer + records.
// Default state: "Top gyakorlatok" ranked by sessionCount (backend order).
// Active search/filter switches to full-catalog results: record rows first,
// then dashed ghost rows for catalog items without history (STIM meter).
//
// DS-migrated (mezo-setx.6.7): the mezo-kaui three-zone card survives as a
// concept but speaks DS vocabulary now — `.excat*` (h3 title, Tag stamps,
// eyebrow stat labels, sp-4 padding, muscle rail on the leading edge). The
// ▶/⋯ roundels moved OUT of the absolute header overlay into a trailing
// action column, which is what lets them carry real 48dp targets without
// stealing the title's line. Filter chips are the DS chip; the search box is
// the DS SearchInput (16px input in field chrome with a coral focus ring).
//
// Tapping a record row opens ExerciseRecordSheet; ⋯ opens CatalogExerciseSheet
// (edit + delete live there); ▶ opens VideoUrlSheet. Mock mode has no set
// history -> records are empty, the catalog search still works.
// ============================================================
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import {
  TOP_FILTERS, TOP_FILTER_LABELS, subMuscles, matchesMuscleFilter, type TopFilter,
} from '@/features/train/logic/muscleFilters'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'
import { ExerciseRecordSheet } from '@/features/train/sheets/ExerciseRecordSheet'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import { VideoUrlSheet } from '@/features/train/sheets/VideoUrlSheet'
import ExercisesSkeleton from '@/features/train/pages/ExercisesSkeleton'
import { ExerciseImage } from '@/features/train/components/ExerciseImage'

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

// The card's secondary-info unit (muscle/type/sessions/Saját) on the DS Tag
// spec — a descriptive stamp, not a selectable chip, so it stays non-tappable.
function Tag({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return <span className="excat-tag" style={{ background: bg, color }}>{children}</span>
}

// One cell of the hairline-topped stat strip: eyebrow label over an h3-weight
// value. The dividers come from `.excat-stats` so cell order carries no styling.
function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="excat-statv" style={color ? { color } : undefined}>{value}</div>
    </div>
  )
}

// Round icon button (▶ video / ⋯ edit): a 48dp target around a 32px visual
// (MOBILE_UX §3 Rule 4 — pad the small visual, don't shrink the target). Lives
// in the card's trailing column, a SIBLING of the open-button, so we never nest
// <button> in <button>.
function Roundel({ label, onClick, bg, color, children }: {
  label: string; onClick: () => void; bg: string; color: string; children: ReactNode
}) {
  return (
    <button className="excat-act" aria-label={label} onClick={onClick}>
      <span style={{ background: bg, color }}>{children}</span>
    </button>
  )
}

function RecordRow({ record, rank, lib, delayMs, onOpen, onVideo, onEdit }: {
  record: ExerciseRecordResponse
  rank: number | null
  lib?: ExerciseLibraryItem
  delayMs?: number
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
  return (
    <div
      className="excat rise"
      style={{ '--ex-wash': mc.wash, '--d': `${delayMs ?? 0}ms` } as CSSProperties}
    >
      <div className="excat-rail" style={{ background: mc.rail }} aria-hidden="true" />
      <button className="excat-open" onClick={onOpen}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <ExerciseImage
            start={lib?.imageStartUrl}
            end={lib?.imageEndUrl}
            name={r.name}
            muscle={r.muscle}
            variant="thumb"
          />
          <span className="excat-name" style={{ flex: 1, minWidth: 0 }}>
            {rank != null && (
              <span className="label-mono" style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>#{rank}</span>
            )}
            {r.name}
          </span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Tag bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</Tag>
          {r.type === 'plyo' ? (
            // --amber is bright in BOTH themes; --ink flips → deliberate literal warm ink.
            <Tag bg="var(--amber)" color="#2B2118">⚡ Plyo</Tag>
          ) : (
            <Tag bg="var(--surface-2)" color="var(--text-secondary)">{r.type}</Tag>
          )}
          <Tag bg="var(--surface-2)" color="var(--text-secondary)">{r.sessionCount} alkalom</Tag>
          {lib?.editable && <Tag bg="var(--primary-bg)" color="var(--primary-deep)">Saját</Tag>}
        </div>
        <div className="excat-stats">
          {weighted ? (
            <>
              <StatCell label="Legjobb szett" value={`${num(r.bestSet!.weightKg!)}×${r.bestSet!.reps}`} />
              <StatCell
                label="e1RM"
                value={r.bestE1rm ? `${num(r.bestE1rm.value)} kg` : '—'}
                color={r.bestE1rm ? 'var(--primary-deep)' : undefined}
              />
              <StatCell label="Összvolumen" value={fmtVolume(r.totalVolume)} />
            </>
          ) : (
            <>
              <StatCell label="Max rep" value={best != null ? String(best) : '—'} />
              <StatCell label="Összes rep" value={String(r.totalReps)} />
              <StatCell label="Szettek" value={String(r.totalSets)} />
            </>
          )}
        </div>
      </button>
      {(onEdit || onVideo) && (
        <div className="excat-acts">
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)">
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
      )}
    </div>
  )
}

function GhostRow({ item, delayMs, onVideo, onEdit }: {
  item: ExerciseLibraryItem
  delayMs?: number
  onVideo?: () => void
  onEdit?: () => void
}) {
  const mc = muscleColor(item.muscle)
  return (
    <div className="excat ghost rise" style={{ '--d': `${delayMs ?? 0}ms` } as CSSProperties}>
      <div className="excat-rail" style={{ background: mc.rail }} aria-hidden="true" />
      {/* No record yet ⇒ nothing to open: the body is a plain div, not a dead button. */}
      <div className="excat-open">
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <ExerciseImage
            start={item.imageStartUrl}
            end={item.imageEndUrl}
            name={item.name}
            muscle={item.muscle}
            variant="thumb"
          />
          <span className="excat-name" style={{ flex: 1, minWidth: 0 }}>{item.name}</span>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow" style={{ color: mc.deep }}>Stim</div>
            <div className="excat-stim" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} style={n / 5 <= item.stim ? { background: mc.rail } : undefined} />
              ))}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Tag bg={mc.wash} color={mc.deep}>{MUSCLE_LABELS[item.muscle] ?? item.muscle}</Tag>
          <Tag bg="var(--surface-2)" color="var(--text-tertiary)">Még nincs rekord</Tag>
        </div>
      </div>
      {(onEdit || onVideo) && (
        <div className="excat-acts">
          {onEdit && (
            <Roundel label="Gyakorlat szerkesztése" onClick={onEdit} bg="var(--surface-2)" color="var(--text-secondary)">
              ⋯
            </Roundel>
          )}
          {onVideo && (
            <Roundel
              label={item.videoUrl ? 'Videó szerkesztése' : 'Videó hozzáadása'}
              onClick={onVideo}
              bg={item.videoUrl ? mc.wash : 'var(--surface-2)'}
              color={item.videoUrl ? mc.deep : 'var(--text-quaternary)'}
            >
              ▶
            </Roundel>
          )}
        </div>
      )}
    </div>
  )
}

export function ExercisesPage() {
  const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()
  const [search, setSearch] = useState('')
  // Two-level filter: top = 'all'|'plyo'|region, sub = a muscle token within a region (or null).
  const [top, setTop] = useState<TopFilter>('all')
  const [sub, setSub] = useState<string | null>(null)
  const [openRecord, setOpenRecord] = useState<ExerciseRecordResponse | null>(null)
  // null = closed · {} = author a new exercise · { edit } = edit an owned row.
  const [catalog, setCatalog] = useState<{ edit?: ExerciseLibraryItem } | null>(null)
  // The catalog row whose demo video is being attached/edited (null = sheet closed).
  const [videoFor, setVideoFor] = useState<{ id: string; name: string; videoUrl: string | null } | null>(null)

  // Real-mode loading: show the layout-aware skeleton until the catalog + records
  // queries resolve (exercisesPending), before the records ghost-state branch. After
  // all hooks. Mock mode seeds synchronously → never pending → no skeleton.
  if (exercisesPending) return <ExercisesSkeleton />

  const searching = search !== '' || top !== 'all'
  const q = search.toLowerCase()
  const subs = subMuscles(top)

  // Resolve a record's catalog row by id, falling back to name: the live
  // backend returns NO catalogId on name-grouped records (logged exercise row
  // without a catalog link, mezo-u5gk/mezo-7ndk) — the same identity fallback
  // the ghost dedup (recordKeys) uses. Feeds both the card (roundels, Saját
  // pill) and the record sheet's videoUrl prop.
  const resolveCatalogRow = (r: ExerciseRecordResponse) =>
    (r.catalogId ? exerciseLibrary.find((e) => e.catalogId === r.catalogId) : undefined) ??
    exerciseLibrary.find((e) => e.name.toLowerCase() === r.name.toLowerCase())

  const records = exerciseRecords.filter(
    (r) => matchesMuscleFilter(r.muscle, r.type, top, sub) && (q === '' || r.name.toLowerCase().includes(q)),
  )
  // catalog items with no record yet (identity match by catalogId, then by name)
  const recordKeys = new Set(
    exerciseRecords.flatMap((r) => [r.catalogId, r.name.toLowerCase()].filter(Boolean) as string[]),
  )
  const ghosts = searching
    ? exerciseLibrary.filter(
        (e) =>
          !recordKeys.has(e.catalogId ?? '') && !recordKeys.has(e.name.toLowerCase()) &&
          matchesMuscleFilter(e.muscle, e.type, top, sub) &&
          (q === '' || e.name.toLowerCase().includes(q)),
      )
    : []

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Gyakorlatok</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Gyakorlatok</PageTitle>
        </div>
        {/* Top-right is reserved for low-frequency actions (anti-pattern 19) — authoring
            a catalog exercise qualifies; the frequent action here is search. */}
        <button type="button" onClick={() => setCatalog({})} className="pgact">
          <Icon name="plus" size={14} /> Új gyakorlat
        </button>
      </div>

      {/* Compact hero (icon + catalog count) + an honest stat strip — prototype
          edzes-body #page-gyak ×1.18. The prototype's 4th "PR e héten" cell is
          dropped: no dated week-boundary contract exists to derive it truthfully.
          The page chrome gets its OWN one-shot entrance (prototype stagger:
          strip 30ms, search field 60ms, chip row 90ms, list head 120ms); the
          result list below keeps its own group, which re-arms on every filter
          change (mezo-d20.11 — the chrome must not re-animate with it). */}
      <EntranceGroup>
      <div style={{ padding: '0 24px 4px' }}>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 14, margin: '2px 0 12px' }}>
          <ClayIcon name="i-polc" size={57} />
          <span className="mz-bignum">{exerciseLibrary.length}</span>
        </div>
        <div className="mz-statstrip rise" style={{ '--d': '30ms' } as CSSProperties} aria-label="Katalógus áttekintés">
          <div className="mz-statcell"><b>{exerciseRecords.length}</b><small>rekord</small></div>
          <div className="mz-statcell"><b>{exerciseLibrary.filter((e) => e.editable).length}</b><small>saját</small></div>
          <div className="mz-statcell"><b>{exerciseLibrary.filter((e) => e.videoUrl).length}</b><small>videóval</small></div>
        </div>
      </div>

      <div style={{ padding: '0 24px 8px' }}>
        {/* Search — the DS SearchInput: leading glyph + a borderless 16px field. */}
        <div className="searchfield rise" style={{ marginBottom: 10, '--d': '60ms' } as CSSProperties}>
          <Icon name="search" size={16} color="var(--text-tertiary)" />
          <input
            aria-label="Keresés a gyakorlatok között"
            placeholder="Keresés · pl. bench, squat, row"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Muscle filter — level 1: régiók */}
        <div className="row gap-xs rise" style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: subs.length ? 6 : 4, paddingBottom: 4, '--d': '90ms' } as CSSProperties}>
          {TOP_FILTERS.map((m) => (
            <button
              key={m}
              onClick={() => { setTop(m); setSub(null) }}
              aria-pressed={top === m}
              className={cn('chip tapchip', top === m && 'brand')}
              style={{ flexShrink: 0 }}
            >
              {TOP_FILTER_LABELS[m] ?? m}
            </button>
          ))}
        </div>
        {/* Muscle filter — level 2: fej-specifikus al-szűrők (csak régió kiválasztásakor) */}
        {subs.length > 0 && (
          <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 4, paddingBottom: 4 }}>
            {subs.map((m) => (
              <button
                key={m}
                onClick={() => setSub(sub === m ? null : m)}
                aria-pressed={sub === m}
                className={cn('chip tapchip', sub === m && 'brand')}
                style={{ flexShrink: 0 }}
              >
                {MUSCLE_LABELS[m] ?? m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 32px' }}>
        <div className="row rise" style={{ justifyContent: 'space-between', margin: '10px 0', '--d': '120ms' } as CSSProperties}>
          <span className="eyebrow">{searching ? 'Találatok · teljes katalógus' : 'Top gyakorlatok · rekordjaid'}</span>
          <span className="label-mono text-tertiary">
            {searching ? `${records.length + ghosts.length} / ${exerciseLibrary.length}` : `${exerciseRecords.length} PR`}
          </span>
        </div>

        {!searching && records.length === 0 ? (
          <GhostState lines={3} message="Az első logolt edzés után itt nőnek a rekordjaid — keresni már most tudsz a katalógusban." />
        ) : (
          <EntranceGroup className="col gap-sm" replayKey={searching ? `${top}:${sub}:${q}` : 'default'}>
            {records.map((r, i) => {
              const lib = resolveCatalogRow(r)
              return (
                <RecordRow
                  key={r.catalogId ?? r.name}
                  record={r}
                  rank={searching ? null : i + 1}
                  lib={lib}
                  delayMs={Math.min(i, 8) * 50}
                  onOpen={() => setOpenRecord(r)}
                  onVideo={lib?.catalogId ? () => setVideoFor({ id: lib.catalogId!, name: lib.name, videoUrl: lib.videoUrl ?? null }) : undefined}
                  onEdit={lib?.editable ? () => setCatalog({ edit: lib }) : undefined}
                />
              )
            })}
            {ghosts.map((g, i) => (
              <GhostRow
                key={g.id}
                item={g}
                delayMs={Math.min(records.length + i, 8) * 50}
                onVideo={g.catalogId ? () => setVideoFor({ id: g.catalogId ?? g.id, name: g.name, videoUrl: g.videoUrl ?? null }) : undefined}
                onEdit={g.editable ? () => setCatalog({ edit: g }) : undefined}
              />
            ))}
            {searching && records.length + ghosts.length === 0 && (
              <p className="text-tertiary" style={{ fontSize: 14, textAlign: 'center', padding: 24 }}>
                Nincs találat ezzel a szűrővel.
              </p>
            )}
          </EntranceGroup>
        )}
      </div>
      </EntranceGroup>

      {openRecord && (
        <ExerciseRecordSheet
          record={openRecord}
          videoUrl={resolveCatalogRow(openRecord)?.videoUrl ?? null}
          imageStartUrl={resolveCatalogRow(openRecord)?.imageStartUrl ?? null}
          imageEndUrl={resolveCatalogRow(openRecord)?.imageEndUrl ?? null}
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
