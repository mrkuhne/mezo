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
//                   them; all three honest at zero). The medal fact is also the vitrine's
//                   only doorway — tap it → `/train/medals` (fix round 1, mezo-lf3cv).
//   `.gy-search`    — the search field, matching the exercise NAME or its MUSCLE label,
//                   accent-blind (`foldAccents`), so „bicepsz"/„hosszu" find their rows.
//   chips           — `Mind` + one per region the catalogue actually has rows in.
//   `.gy-card`      — one card per catalogue exercise: the anatomy art (`MuscleChip`), the
//                   name, the muscle label, and either the best estimated 1RM („becsült
//                   1RM") with its medal count, or „még nincs naplózva". Tap → the
//                   exercise's own story at `/train/exercises/:key` (P2 Task 5).
//   `.pl-add`       — the list's trailing „＋ Új gyakorlat" row (fix round 1): the only
//                   surviving door onto `CatalogExerciseSheet`'s CREATE mode. Per-exercise
//                   edit/delete and the video sheet stay unreached — Task 5's story page.
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
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function ExercisesPage() {
  const navigate = useNavigate()
  const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()
  const { data: medals, isPending: medalsPending } = useMedals()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<RegionKey | null>(null)
  const [creating, setCreating] = useState(false)

  // Real-mode loading: the catalogue, the records AND the medals all feed the poster's
  // facts, so wait them ALL out behind the layout-matched skeleton — `useMedals()` returns
  // `[]` while its own real-mode fetch is in flight, and gating on `exercisesPending` alone
  // let that empty array paint as an honest-looking „0 medál" that was really not loaded
  // yet (mezo-lf3cv fix round 1). Mock seeds every query synchronously → never shows.
  if (exercisesPending || medalsPending) return <ExercisesSkeleton />

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
            {/* The vitrine's only doorway (mezo-lf3cv fix round 1): `navModel.ts` has
                claimed `/train/medals` as this tab's owned route since the catalogue
                replaced the old page's „Medálok" row, but nothing linked it since —
                this segment is now the link, the other two foot facts stay plain text. */}
            <button
              type="button"
              className="pl-poster-foot-link"
              aria-label={`${counts.medals} medál · a medálvitrinbe`}
              onClick={() => navigate('/train/medals')}
            >
              {counts.medals} medál
            </button>
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
              // No `aria-label` (mezo-lf3cv fix round 1): an explicit label REPLACES the
              // card's own text for a screen reader, so it never heard the e1RM, the
              // medal count or „még nincs naplózva" — the visible text is already a good
              // accessible name, so let it speak for itself.
              <button
                key={row.key}
                type="button"
                className="gy-card rise"
                style={{ '--mus-color': muscleColor(row.muscle).rail, ...delay(Math.min(i, 8) * 30) } as CSSProperties}
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

          {/* The catalogue's own quiet creation door (mezo-lf3cv fix round 1): the retired
              page's „Új gyakorlat" CTA had nowhere left to open once the top-5 shell went,
              which left `createExercise` with no UI caller anywhere in the app. The house
              idiom for a list's trailing "add" affordance is the dashed `.pl-add` row
              (`MesoDayPage`'s „＋ Gyakorlat hozzáadása"); it opens `CatalogExerciseSheet` in
              CREATE mode only — per-exercise edit/delete and the demo-video sheet stay
              unreached, they belong to the story page (Task 5). */}
          <button type="button" className="pl-add rise" style={delay(120)} onClick={() => setCreating(true)}>
            ＋ Új gyakorlat
          </button>
        </PageBody>
      </EntranceGroup>

      {creating && <CatalogExerciseSheet onClose={() => setCreating(false)} />}
    </MozaikPage>
  )
}
