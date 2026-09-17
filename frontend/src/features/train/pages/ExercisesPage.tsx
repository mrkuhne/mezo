// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — THE CATALOGUE at /train/exercises.
//
// Train parity P2 Task 4 (mezo-lf3cv): the wholesale replacement of the pre-Titanium
// page (DS page-header + „Top gyakorlatok · rekordjaid" top-5 + dashed ghost rows +
// the ⋯/▶ roundel sheets). Ported 1:1 from the prototype's `gyHome`
// (docs/design_2.0/prototypes/companion-titanium/gyak-pages.js:35-50):
//   `.pl-dhero.pl-lhero` — the poster: GYAKORLATOK eyebrow, „A mozdulataid", the lead
//                   sentence, and three REAL foot facts (N gyakorlat · N rekorddal ·
//                   N medál — the catalogue, its record rows and the medals joined onto
//                   them; all three honest at zero).
//   `.gy-search`    — the search field, matching the exercise NAME or its MUSCLE label,
//                   accent-blind (`foldAccents`), so „bicepsz"/„hosszu" find their rows.
//   chips           — `Mind` + one per region the catalogue actually has rows in.
//   `.gy-card`      — one card per catalogue exercise: the anatomy art (`MuscleChip`), the
//                   name, the muscle label, and either the best estimated 1RM („becsült
//                   1RM") with its medal count, or „még nincs naplózva". Tap → the
//                   exercise's own story at `/train/exercises/:key` (P2 Task 5).
//
// Every join is pure and lives in `logic/exerciseLibrary.ts` (identity via the shared
// `recordFor` rule). No numbers are invented here: an absent estimate is an em dash.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedals, useTrain } from '@/data/hooks'
import { hu1 } from '@/shared/lib/huNum'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import {
  buildLibraryRows, filterLibraryRows, libraryCounts, libraryRegions,
} from '@/features/train/logic/exerciseLibrary'
import { muscleColor, type RegionKey } from '@/features/train/logic/muscleColors'
import ExercisesSkeleton from '@/features/train/pages/ExercisesSkeleton'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function ExercisesPage() {
  const navigate = useNavigate()
  const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()
  const { data: medals } = useMedals()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<RegionKey | null>(null)

  // Real-mode loading: the catalogue AND the records both feed the poster's facts, so
  // wait them out behind the layout-matched skeleton rather than showing honest-looking
  // zeros that are really "not loaded yet". Mock seeds synchronously → never shows.
  if (exercisesPending) return <ExercisesSkeleton />

  const rows = buildLibraryRows(exerciseLibrary, exerciseRecords, medals)
  const counts = libraryCounts(rows)
  const regions = libraryRegions(rows)
  const shown = filterLibraryRows(rows, query, region)

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header
          className="pl-dhero pl-lhero rise"
          style={{ '--mus-color': 'var(--amber)', ...delay(40) } as CSSProperties}
        >
          <span className="pl-dhero-wash" aria-hidden="true" />
          <span className="pl-lhero-art" aria-hidden="true">
            <ClayIcon name="i-polc" size={60} className="icon" />
            <i />
            <i />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">Gyakorlatok</span>
          <h2>A mozdulataid</h2>
          <p className="pl-say">Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.</p>
          <div className="pl-poster-foot">
            <span>{counts.total} gyakorlat</span>
            <span>{counts.logged} rekorddal</span>
            <span>{counts.medals} medál</span>
          </div>
        </header>

        <PageBody className="pl-sub">
          {/* The prototype's `.wz-pick-search` chrome was not ported (it belongs to the
              wizard's CSS); the house search field wears the `.gy-search` row. */}
          <label className="gy-search rise" data-kalauz-anchor="exercises-kereso" style={delay(70)}>
            <span className="searchfield">
              <Icon name="search" size={16} color="var(--text-tertiary)" />
              <input
                type="search"
                aria-label="Keresés a gyakorlatok között"
                placeholder="Keresés névre vagy izomra…"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>

          <div
            className="row gap-xs rise"
            role="group"
            aria-label="Izomcsoport-szűrő"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '0 0 10px', paddingBottom: 4, ...delay(90) }}
          >
            <button
              type="button"
              className={cn('chip tapchip', region === null && 'brand')}
              aria-pressed={region === null}
              style={{ flexShrink: 0 }}
              onClick={() => setRegion(null)}
            >
              Mind
            </button>
            {regions.map((r) => (
              <button
                key={r.key}
                type="button"
                className={cn('chip tapchip', region === r.key && 'brand')}
                aria-pressed={region === r.key}
                style={{ flexShrink: 0 }}
                onClick={() => setRegion(region === r.key ? null : r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <EntranceGroup className="gy-list" replayKey={`${region ?? 'mind'}:${query}`}>
            {shown.length === 0 && (
              <p className="pl-foot-say">Nincs ilyen gyakorlat a tárban.</p>
            )}
            {shown.map((row, i) => (
              <button
                key={row.key}
                type="button"
                className="gy-card rise"
                style={{ '--mus-color': muscleColor(row.muscle).rail, ...delay(Math.min(i, 8) * 30) } as CSSProperties}
                aria-label={`${row.name} · ${row.muscleLabel}`}
                onClick={() => navigate(`/train/exercises/${row.key}`)}
              >
                <MuscleChip token={row.muscle} size={34} className="icon" />
                <span className="gy-card-name">
                  <strong>{row.name}</strong>
                  <small>{row.muscleLabel}</small>
                </span>
                {row.record ? (
                  <span className="gy-card-best">
                    {/* Logged, but the estimate can still be unknowable (bodyweight-only
                        history, every set above the rep cap) → an em dash, never a 0. */}
                    <b>{row.bestE1rm != null ? `${hu1(row.bestE1rm)} kg` : '—'}</b>
                    <small>becsült 1RM</small>
                    <span className="gy-medals">
                      <ClayIcon name="i-erme" size={15} className="icon" />
                      {row.medalCount}
                    </span>
                  </span>
                ) : (
                  <span className="gy-card-empty">még nincs naplózva</span>
                )}
                <b className="gy-card-go" aria-hidden="true">›</b>
              </button>
            ))}
          </EntranceGroup>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
