// ============================================================
// Mezo · MesoKonyvtarPage — „Edzéstervek", the plan library landing at
// /train/mesocycles/konyvtar.
//
// Train Titanium T10 Task 2 (mezo-88iwa.11): THE REFACE. Was the DS-era
// MozaikPage/Mosaic/Tile face the T9 move parked here verbatim; this is the
// Titanium landing, ported from the prototype's `planLibrary`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:335-390):
//   `.pl-lhero`   — a full-bleed poster hero with the back pill DOCKED INSIDE it
//                   (option A, the `.ld-hero .ld-back` idiom TrainWeekMapPage
//                   already carries), an eyebrow, the spinning stack spot, one
//                   plain sentence, and the facts row: „1 fut · N következik ·
//                   N sablon · N lezárva". Every count is REAL — 0 renders as 0,
//                   because 0 is the truth about this library.
//   „Most fut"    — one `.pl-lib-card.is-now` for the ACTIVE run (name, week X of
//                   Y, split) → the Terv landing. With no active run the section
//                   says so in one quiet line; it never draws an empty card.
//   „Következnek" — one `.pl-lib-card.is-queued` per planned run (weeks, nap/hét,
//                   split name — the start date is said once, in the card head).
//                   The card carries NO activation affordance: activating a plan
//                   silently archives the running one with no close ceremony/report
//                   (`activateMesocycle` → `TrainService.archiveActiveMesos`), so the
//                   card BODY opens the plan's own page (the builder), whose DATED
//                   „Aktiválás · <date>" CTA is the deliberate path. A reassurance
//                   line says when it starts (an active run is queued behind) or
//                   hints at the builder (no active run to wait behind).
//   `.pl-lib-new` — the one loud CTA: „Új terv összeállítása" → the planner.
//   `.pl-dests`   — the two doorways: „Sablonjaid" → /train/templates and „Lezárt
//                   futamaid" → /train/mesocycles/futamok.
//
// What LEFT this page: the Történet section (the closed-run list, its
// „Összevetés" pairing mode, „Újrafuttatás" + „Sablonná" and the `MesoStartSheet`
// those open) moved VERBATIM to `MesoFutamokPage` behind the „Lezárt futamaid"
// doorway — nothing became unreachable in the same commit (the T4 reachability
// lesson). Task 4 fleshes that page out; the markup there is this page's, moved.
//
// Language: one plain Hungarian sentence, no jargon — „terv", never „blokk".
// Clay icons only, never emoji.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'
import { huDate } from '@/features/train/logic/mesoDates'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** The split's head („Upper / Lower · 4×/hét" → „Upper / Lower") — the fact box has one
 *  line for it, and the „×/hét" half is already said by the weeks fact beside it. */
const splitHead = (split: string) => split.split(' · ')[0]

/** The split's „×/hét" tail („Upper / Lower · 4×/hét" → „4×/hét"), or null when the split
 *  carries no such tail (a legacy/direct run's split may be name-only) — the nap/hét fact
 *  box is dropped rather than drawing an empty one. */
function splitFrequency(split: string): string | null {
  const parts = split.split(' · ')
  return parts.length > 1 && /×\/hét$/.test(parts[1]) ? parts[1] : null
}

export function MesoKonyvtarPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { templates, pending: templatesPending } = useMesoTemplates()
  const navigate = useNavigate()

  // Real-mode loading: show the layout-aware skeleton until the meso + template lists
  // resolve. `mesocycles` comes from the meso query that drives workoutPending, so branch
  // on it before rendering. Mock seeds synchronously → no skeleton.
  if (workoutPending || templatesPending) return <MesocycleSkeleton />

  const active = mesocycles.find((m) => m.status === 'active') ?? null
  const planned = mesocycles.filter((m) => m.status === 'planned')
  const archived = mesocycles.filter((m) => m.status === 'archived')

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        {/* The poster hero. Full-bleed via `.pl-dhero`'s own negative margin-inline; the
            back pill is its DIRECT child, which is what the docking rule keys on. */}
        <header
          className="pl-dhero pl-lhero rise"
          data-kalauz-anchor="konyvtar-hero"
          style={{ '--mus-color': 'var(--tag-gym)', ...delay(40) } as CSSProperties}
        >
          <span className="pl-dhero-wash" aria-hidden="true" />
          <button
            type="button"
            className="mz-backbtn"
            aria-label="Vissza"
            onClick={() => navigate('/train/mesocycles')}
          >
            ‹ A terved
          </button>
          <span className="pl-lhero-art" aria-hidden="true">
            <ClayIcon name="i-polc" size={60} className="icon" />
            <i />
            <i />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">Edzéstervek</span>
          <h2>A terveid</h2>
          <p className="pl-say">Itt élnek a terveid — ami fut, ami jön, és ami már mögötted van.</p>
          <div className="pl-poster-foot">
            <span>{active ? 1 : 0} fut</span>
            <span>{planned.length} következik</span>
            <span>{templates.length} sablon</span>
            <span>{archived.length} lezárva</span>
          </div>
        </header>

        <PageBody>
          <h3 className="pl-h3">Most fut</h3>
          {active ? (
            <button
              type="button"
              className="pl-lib-card is-now rise"
              style={delay(90)}
              aria-label={`Most fut · ${active.title}`}
              onClick={() => navigate('/train/mesocycles')}
            >
              <span className="pl-lib-head">
                <strong>{active.title}</strong>
                <em>{active.currentWeek}. hét a {active.weeks}-ból</em>
                <b aria-hidden="true">›</b>
              </span>
              <small className="pl-lib-note">{active.split}</small>
            </button>
          ) : (
            // No running plan is a real state, not an empty card: say it once, quietly.
            <p className="pl-lib-note rise" style={{ margin: '0 0 8px', ...delay(90) }}>
              Most nem fut terv — indíts egyet alább.
            </p>
          )}

          {planned.length > 0 && <h3 className="pl-h3">Következnek</h3>}
          {planned.map((m, i) => {
            const freq = splitFrequency(m.split)
            return (
              <button
                key={m.id}
                type="button"
                className="pl-lib-card is-queued rise"
                style={delay(120 + i * 30)}
                aria-label={`Tervezett · ${m.title}`}
                onClick={() => navigate(`/train/mesocycles/${m.id}`)}
              >
                <span className="pl-lib-head">
                  <strong>{m.title}</strong>
                  <em>{huDate(m.startDate)}-tól</em>
                  <b aria-hidden="true">›</b>
                </span>
                <span className="pl-day-facts">
                  <i><ClayIcon name="i-idozito" size={22} className="icon" /><b>{m.weeks}</b><small>hét</small></i>
                  {freq && <i><ClayIcon name="i-heti" size={22} className="icon" /><b className="is-word">{freq}</b></i>}
                  <i><ClayIcon name="i-stack" size={22} className="icon" /><b className="is-word">{splitHead(m.split)}</b></i>
                </span>
                {/* No one-tap activation here — that silently archives the running plan
                    with no close ceremony/report. The card body opens the plan's own page
                    (the builder), whose dated „Aktiválás · <date>" CTA is the deliberate
                    path. The reassurance/hint line below tells the reader what „opens" means. */}
                <small className="pl-lib-note">
                  {active ? 'Akkor indul, amikor a mostani terved lezárul.' : 'Nyisd meg, és onnan indíthatod.'}
                </small>
              </button>
            )
          })}

          <button
            type="button"
            className="pl-lib-new rise"
            style={delay(180)}
            aria-label="Új terv összeállítása"
            onClick={() => navigate('/train/mesocycles/new')}
          >
            <span className="pl-lib-new-art"><ClayIcon name="i-stack" size={30} className="icon" /></span>
            <span>
              <strong>Új terv összeállítása</strong>
              <small>Sablonból indulsz, vagy nulláról építed</small>
            </span>
            <b aria-hidden="true">＋</b>
          </button>
        </PageBody>

        {/* The two doorways. Rendered OUTSIDE PageBody: `.pl-dests` brings its own
            `var(--screen-gutter)` padding, the way the Terv landing renders its own. */}
        <div className="pl-dests pl-lib-dests">
          <button
            type="button"
            className="pl-dest is-plans rise"
            style={delay(210)}
            aria-label="Sablonjaid"
            onClick={() => navigate('/train/templates')}
          >
            <span className="pl-dest-art"><ClayIcon name="i-polc" size={40} className="icon" /></span>
            <strong>Sablonjaid</strong>
            <small>{templates.length} sablon, amiből indíthatsz</small>
            <b aria-hidden="true">↗</b>
          </button>
          <button
            type="button"
            className="pl-dest is-done rise"
            style={delay(240)}
            aria-label="Lezárt futamaid"
            onClick={() => navigate('/train/mesocycles/futamok')}
          >
            <span className="pl-dest-art"><ClayIcon name="i-erme" size={40} className="icon" /></span>
            <strong>Lezárt futamaid</strong>
            <small>{archived.length} lezárt terv története</small>
            <b aria-hidden="true">↗</b>
          </button>
        </div>
      </EntranceGroup>
    </MozaikPage>
  )
}
