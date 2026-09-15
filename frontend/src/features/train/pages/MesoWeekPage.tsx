// ============================================================
// Mezo · MesoWeekPage — „Heti vizsgálat" / „Melyik izmod hol tart".
// Train Titanium T9 Task 5 (mezo-88iwa.10): the week review speaks the Terv
// language. Ported from the prototype's `planWeek`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:192-230):
//   `.pl-dhero`  — a FULL-BLEED hero carrying `BodyMap views="both"` (the whole
//                  week touches both sides of the body, so this is the one place
//                  the duo map is honest), the week's total as the single big
//                  numeral, and TWO sentences: how many muscles are still growing
//                  / already at their ceiling / merely held, and the delta line.
//   `.pl-list`   — one `.pl-item` row per muscle, RANKED BY ROOM TO THE CEILING
//                  (the ones with something still to give lead), each carrying a
//                  verdict SENTENCE, not a number cluster: „Még {n} szett fér
//                  bele." / „Ezt most szinten tartod." / „Elérte a felső értéket
//                  ebben a tervben." — prefixed by the tier word (tierLabel).
// The live-rollover banner stays — it is the one thing on this page that talks
// about the FUTURE (what Monday changes), and nothing else carries it.
// Was the `.mz-wtile` mosaic (mesocycle pages v2, mezo-d20.15) with per-tile
// `VolumeBand` + 6-bar sparks; the band/ceiling math is unchanged (`muscleTiles`,
// logic/mesoWeek.ts) — only the face is new.
// Language (T9 jargon ban): „felső érték", never „plafon"; „terv", never „blokk";
// the tier words are Hungarian-only (tierLabel.ts). Percent is never printed —
// the room is drawn as a bar and said in sets.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BodyMap, type BodyHeat } from '@/features/train/components/BodyMap'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { nextRolloverChips } from '@/features/train/logic/mesoBands'
import { muscleTiles, weekSummary, type MuscleWeekTile } from '@/features/train/logic/mesoWeek'
import { regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { tierLabel } from '@/features/train/logic/tierLabel'

/** The rollover forecast reads as a sentence, so it stops at FIVE muscles and says how many
 *  it left out — a 10-muscle block turned the banner into an unreadable wall of chips. */
function rolloverLine(chips: { text: string }[]): string {
  const head = chips.slice(0, 5).map((c) => c.text)
  return chips.length > 5 ? [...head, `+${chips.length - 5}`].join(' · ') : head.join(' · ')
}

/** How many sets this muscle may still add inside THIS plan — the one quantity the page
 *  ranks and speaks by. A maintain muscle's ceiling IS its current number, so its room is
 *  0 and it never competes with a muscle that still has somewhere to go. */
const roomOf = (t: MuscleWeekTile) => t.ceiling - t.current

/** The verdict, in words. The page says what the number MEANS first (the owner's rule);
 *  the set count next to it is only the backing evidence. */
function verdict(t: MuscleWeekTile): string {
  if (t.tier === 'maintain') return 'Ezt most szinten tartod.'
  const left = roomOf(t)
  return left > 0 ? `Még ${left} szett fér bele.` : 'Elérte a felső értéket ebben a tervben.'
}

/** Heat for the hero's duo body map, straight off each tile's own status tone: a muscle
 *  that is still climbing burns brighter than one merely held. NOT a fatigue read and NOT
 *  a warning — 'over' here is only the top of the opacity scale (BodyMap draws no red). */
const HEAT_BY_TONE: Record<MuscleWeekTile['statusTone'], BodyHeat['level']> = {
  sage: 'in', // ramping, room left
  gold: 'over', // at the ceiling (or held after a grind week)
  mut: 'below', // maintain — present, not pushed
}

/** The hero's one sentence: how many muscles are in each of the three states. Clauses are
 *  dropped when their count is 0, so a plan where everything grows says exactly that. */
function weekSentence(tiles: MuscleWeekTile[]): string {
  const growing = tiles.filter((t) => t.tier !== 'maintain' && roomOf(t) > 0).length
  const maxed = tiles.filter((t) => t.tier !== 'maintain' && roomOf(t) <= 0).length
  const held = tiles.filter((t) => t.tier === 'maintain').length
  const parts: string[] = []
  if (growing > 0) parts.push(`${growing} izomban van még hova nőni`)
  if (maxed > 0) parts.push(`${maxed} elérte a felső értéket`)
  if (held > 0) parts.push(`${held} izmot csak szinten tartasz`)
  const head = `${tiles.length} izomcsoportot edzel ezen a héten.`
  return parts.length > 0 ? `${head} ${parts.join(', ')}.` : head
}

/** The delta line. „a múlt héthez képest" is the phrase the whole app uses for a
 *  week-over-week comparison — kept verbatim in every branch so the sentence never has to
 *  be parsed twice by a reader who only glances at it. */
function deltaSentence(delta: number): string {
  if (delta > 0) return `${delta} szettel több a múlt héthez képest.`
  if (delta < 0) return `${-delta} szettel kevesebb a múlt héthez képest.`
  return 'Pont annyi, mint a múlt héthez képest.'
}

/** Mirrors the hero + list anatomy below, so the real-mode loading window doesn't jump
 *  when the arc lands (the sibling day page's rule). */
function WeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton width={90} height={12} style={{ margin: '12px 0 0 24px' }} />
      <Skeleton height={230} style={{ margin: '10px 0 14px' }} />
      <div className="col gap-sm" style={{ padding: '0 24px 24px' }}>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="card" height={74} />)}
      </div>
    </div>
  )
}

export function MesoWeekPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav(`/train/mesocycles/${id}`)
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending, error: arcError, refetch: refetchArc } = useMesocycleVolumeArc(id ?? null)

  const meso = mesocycles.find((m) => m.id === id)

  if (workoutPending || arcPending) return <WeekSkeleton />

  if (!meso) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A terved" />
        <PageBody>
          <GhostState message="Ez a mesociklus nem található." />
        </PageBody>
      </MozaikPage>
    )
  }

  if (!arc) {
    // A FAILED arc fetch is not „nincs még ív": the first is recoverable and says so, the
    // second is a promise about the first session. Rendering them identically would tell a
    // user with a dead network to go and train.
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A terved" />
        <PageBody>
          <GhostState
            message={
              arcError
                ? 'Nem sikerült betölteni a heti vizsgálatot — próbáld újra.'
                : 'A heti vizsgálat a blokk első edzése után jelenik meg.'
            }
            ctaLabel={arcError ? 'Újra' : undefined}
            onCta={arcError ? () => void refetchArc() : undefined}
          />
        </PageBody>
      </MozaikPage>
    )
  }

  // `muscleTiles` sorts by ceiling; the page RE-SORTS by room to the ceiling — the muscles
  // with something still to give are the ones worth looking at first (the prototype's own
  // rule). Ties fall back to the bigger ceiling, so the emphasized muscle still leads a
  // field where nothing has room left.
  const tiles = [...muscleTiles(arc, meso)].sort((a, b) => roomOf(b) - roomOf(a) || b.ceiling - a.ceiling)
  const summary = weekSummary(arc, tiles)
  const chips = nextRolloverChips(meso)
  const heat: BodyHeat[] = tiles.map((t) => ({ token: t.group, level: HEAT_BY_TONE[t.statusTone] }))

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={goBack} label="‹ A terved" />
      <EntranceGroup>
        {/* The week, as a poster: eyebrow, the duo body map, one dominant numeral, one
            sentence. Full-bleed via `.pl-dhero`'s own negative margin-inline — a bare
            <section> auto-fills its containing block, so (unlike the landing poster's
            <button>, T5 width-calc lesson) it needs no explicit width calc. */}
        <section className="pl-dhero rise" style={{ '--mus-color': 'var(--tag-gym)' } as CSSProperties}>
          <span className="pl-dhero-wash" aria-hidden="true" />
          {/* Not aria-hidden — BodyMap carries its own role="img"/aria-label and IS content
              here: it is the only place the week's load is shown per body region. */}
          <span className="pl-dhero-art is-wide">
            <BodyMap heat={heat} views="both" ariaLabel="A heted izomtérképe" />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">Heti vizsgálat · {arc.currentWeek}. hét</span>
          <h2>Melyik izmod hol tart</h2>
          <div className="pl-dhero-number">
            <strong>{summary.total}</strong>
            <small>szett ezen a héten</small>
          </div>
          <p className="pl-say">{weekSentence(tiles)}</p>
          <p className="pl-sub-say">
            {summary.delta === null ? 'Ez a terv első hete — még nincs mihez mérni.' : deltaSentence(summary.delta)}
          </p>
        </section>

        <PageBody principle="Koppints egy izomra: hol tartasz, mikor és miben dolgozik, honnan jön a szám, és mi volt az előző tervben. Piros itt sincs: a tartás is döntés, nem hiba.">
          {chips.length > 0 && (
            <div className="mz-livebanner rise" style={{ marginBottom: 10 }}>
              <span className="mz-livedot" aria-hidden="true" />
              <div className="mz-grow">
                <div className="mz-livebanner-title">Élő rendszer · a következő görgetés hétfő hajnal</div>
                <div className="mz-mut" style={{ fontSize: 9 }}>{rolloverLine(chips)}</div>
              </div>
            </div>
          )}

          <div className="pl-list">
            {tiles.map((t, i) => {
              const fam = regionColor(t.region as RegionKey)
              return (
                <button
                  key={t.group}
                  type="button"
                  className="pl-item rise"
                  style={{ '--mus-color': fam.rail, '--d': `${90 + i * 45}ms` } as CSSProperties}
                  onClick={() => navigate(`/train/mesocycles/${id}/week/${t.group}`)}
                  aria-label={`${t.label} részletek`}
                >
                  <span className="pl-item-art"><MuscleChip token={t.group} size={32} /></span>
                  <span className="pl-item-name">{t.label}</span>
                  <span className="pl-item-count">{t.current}<i>szett</i></span>
                  <span className="pl-item-bar">
                    <i style={{ '--w': `${t.ceiling > 0 ? Math.min(100, (t.current / t.ceiling) * 100) : 0}%` } as CSSProperties} />
                  </span>
                  <span className="pl-item-say">{tierLabel(t.tier)} · {verdict(t)}</span>
                  <b aria-hidden="true">›</b>
                </button>
              )
            })}
          </div>

          <p className="pl-foot-say">
            A sáv azt mutatja, hol tartasz ahhoz képest, ameddig ebben a tervben elmész.
            Koppints egy izomra, ha érdekel, miért pont ennyi.
          </p>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
