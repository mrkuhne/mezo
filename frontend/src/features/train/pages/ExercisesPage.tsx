// ============================================================
// Mezo · ExercisesPage (Gyakorlatok) — THE CATALOGUE at /train/exercises.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `exercises()`): the hero is a kettlebell
// filled to the share of exercises that already hold a record, with the medal door and
// „＋ Új gyakorlat" on its liquid row; then 1 · Keresés és szűrés (the search field + the region
// pills) and 2 · Lista (one row per exercise: the muscle chip, the name, the best estimated 1RM
// as a level against the catalogue's strongest, the medal count in words).
//
// Behaviour unchanged since Train parity P2 Task 4 (mezo-lf3cv): the search matches the
// exercise NAME or its MUSCLE label, accent-blind (`foldAccents`); the pills are `Mind` + one per
// region the catalogue actually has rows in; a row opens the exercise's own page at
// `/train/exercises/:key`; „＋ Új gyakorlat" opens `CatalogExerciseSheet` in create mode.
//
// Every join is pure and lives in `logic/exerciseLibrary.ts` (identity via the shared
// `recordFor` rule). No numbers are invented here: an absent estimate is an em dash.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedals, useTrain } from '@/data/hooks'
import { hu1 } from '@/shared/lib/huNum'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import {
  buildLibraryRows, filterLibraryRows, libraryCounts, libraryRegions,
} from '@/features/train/logic/exerciseLibrary'
import type { RegionKey } from '@/features/train/logic/muscleColors'
import ExercisesSkeleton from '@/features/train/pages/ExercisesSkeleton'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import {
  Acts, Btn, Card, Fill, Hero, Input, Level, Lk, Note, Page, Pill, Pills, Row, Section, useFrameTitle,
} from '@/shared/ui/folyadek'

/** The kettlebell silhouette of the hero (prototype `SH_KETTLE`, 0 0 100 100) and its handle hole. */
const SH_KETTLE = 'M33 36 C22 12 78 12 67 36 C84 44 91 60 86 74 C81 89 66 95 50 95 C34 95 19 89 14 74 C9 60 16 44 33 36Z'
const SH_KETTLE_HOLE = 'M40 30 C40 21 60 21 60 30Z'

export function ExercisesPage() {
  const navigate = useNavigate()
  const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()
  const { data: medals, isPending: medalsPending } = useMedals()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<RegionKey | null>(null)
  const [creating, setCreating] = useState(false)
  useFrameTitle({ title: 'Gyakorlatok', eyebrow: 'A mozdulataid' })

  // Real-mode loading: the catalogue, the records AND the medals all feed the hero's
  // facts, so wait them ALL out behind the layout-matched skeleton — `useMedals()` returns
  // `[]` while its own real-mode fetch is in flight, and gating on `exercisesPending` alone
  // let that empty array paint as an honest-looking „0 medál" that was really not loaded
  // yet (mezo-lf3cv fix round 1). Mock seeds every query synchronously → never shows.
  if (exercisesPending || medalsPending) return <ExercisesSkeleton />

  const rows = buildLibraryRows(exerciseLibrary, exerciseRecords, medals)
  const counts = libraryCounts(rows)
  const regions = libraryRegions(rows)
  const shown = filterLibraryRows(rows, query, region)
  // The row levels are read against the catalogue's strongest estimate (not the filtered list's),
  // so a bar does not grow when a filter hides a stronger lift.
  const topE1rm = Math.max(0, ...rows.map((r) => r.bestE1rm ?? 0))
  const add = <Lk onClick={() => setCreating(true)}>＋ Új gyakorlat</Lk>

  return (
    <Page className="er-page er-cards">
      <Hero
        label="A mozdulataid"
        verdict={`${counts.total} gyakorlat, ${counts.logged} rekorddal.`}
        sub="Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt."
        left={(
          <Fill d={SH_KETTLE} pct={counts.total > 0 ? (counts.logged / counts.total) * 100 : 0} size={84}>
            <path d={SH_KETTLE_HOLE} fill="#fff" stroke="rgba(10,42,60,.10)" strokeWidth={1.6} />
          </Fill>
        )}
        actions={(
          <>
            {/* The vitrine's only doorway (mezo-lf3cv fix round 1): `navModel.ts` claims
                `/train/medals` as this tab's owned route, and this button is its one link. */}
            <Btn aria-label={`${counts.medals} medál · a medálvitrinbe`} onClick={() => navigate('/train/medals')}>
              {counts.medals} medál
            </Btn>
            {add}
          </>
        )}
      />

      <Section n={1} title="Keresés és szűrés" />
      <Card>
        <Input
          type="search"
          data-kalauz-anchor="exercises-kereso"
          aria-label="Keresés a gyakorlatok között"
          placeholder="Keresés névre vagy izomra…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Pills className="er-filter" role="group" aria-label="Izomcsoport-szűrő">
          <Pill on={region === null} onClick={() => setRegion(null)}>Mind</Pill>
          {regions.map((r) => (
            <Pill key={r.key} on={region === r.key} onClick={() => setRegion(region === r.key ? null : r.key)}>
              {r.label}
            </Pill>
          ))}
        </Pills>
      </Card>

      <Section n={2} title="Lista" />
      <Card>
        <div className="er-list">
          {shown.length === 0 && <Note className="er-none">Nincs ilyen gyakorlat a tárban.</Note>}
          {shown.map((row) => (
            // No `aria-label` (mezo-lf3cv fix round 1): an explicit label REPLACES the row's
            // own text for a screen reader, so it never heard the e1RM, the medal count or
            // „még nincs naplózva" — the visible text is already a good accessible name.
            <Row
              key={row.key}
              left={<Mchp muscle={row.muscle} sm />}
              title={row.name}
              sub={(
                <>
                  {row.muscleLabel}
                  {row.record ? ' · becsült 1RM' : ' · még nincs naplózva'}
                  {/* A zero medal count means "none" — absent, never printed as `0`. */}
                  {row.record && row.medalCount > 0 && ` · ${row.medalCount} medál`}
                </>
              )}
              more={row.bestE1rm != null && topE1rm > 0 && (
                <span className="er-rowbar"><Level pct={(row.bestE1rm / topE1rm) * 100} color={deepMuscle(row.muscle)} height={10} /></span>
              )}
              // Logged, but the estimate can still be unknowable (bodyweight-only history,
              // every set above the rep cap) → an em dash, never a 0.
              value={row.record ? (row.bestE1rm != null ? `${hu1(row.bestE1rm)} kg` : '—') : undefined}
              onClick={() => navigate(`/train/exercises/${row.key}`)}
            />
          ))}
        </div>
        {/* The catalogue's own creation door (mezo-lf3cv fix round 1) — it opens
            `CatalogExerciseSheet` in CREATE mode only; per-exercise edit/delete and the
            demo-video sheet belong to the exercise's own page. */}
        <Acts>{add}</Acts>
      </Card>

      {creating && <CatalogExerciseSheet onClose={() => setCreating(false)} />}
    </Page>
  )
}
