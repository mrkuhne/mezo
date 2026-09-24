// ============================================================
// Mezo · MesoTemplatesPage — „Sablonjaid" at /train/templates.
//
// Train Titanium T10 Task 3 (mezo-88iwa.11): THE REFACE. Was the DS-era page-header +
// template poster-card list (mezo-tlwa/mezo-3a9a, since removed); this is the Titanium list,
// ported from the prototype's `planLibraryTemplates` + `templateCard`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:393-434):
//   `.pl-lhero.is-slim` — a slim poster hero with the back pill DOCKED INSIDE it (the
//                   Task 2 idiom, `.pl-lhero > .mz-backbtn`) pointing back at the
//                   „Edzéstervek" landing, one plain sentence, and a REAL count fact
//                   („N sablon · N futam indult belőlük").
//   `.pl-lib-card`  — one card per template: name + split, the three fact boxes (hét,
//                   nap hetente, ~perc when the week actually carries sessions), the
//                   muscles as `MuscleChip` minis, and ONE plain line about where the
//                   template stands (`templateUseLine` over `templateStory`).
//   `.pl-lib-new`   — the create affordance the DS page carried twice (the head's „+ Új"
//                   chip and the dashed footer CTA), kept as the one loud button → the
//                   planner. Nothing else was lost: a card tap now opens the template's
//                   own READ-FIRST page (`/train/templates/:id`), from which the editor,
//                   the start sheet and the lifecycle pair (Duplikálás / Törlés) hang —
//                   the list itself carries no destructive action any more.
//
// Language: plain Hungarian, no jargon. Clay icons + anatomy chips, never emoji.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import {
  splitLabel,
  templateSessionMinutes,
  templateStory,
  templateUseLine,
  templateWeekSets,
  trainingDayCount,
} from '@/features/train/logic/libraryStory'
import { muscleColor } from '@/features/train/logic/muscleColors'
import MesoTemplatesSkeleton from '@/features/train/pages/MesoTemplatesSkeleton'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function MesoTemplatesPage() {
  const { templates, pending } = useMesoTemplates()
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()

  // Real-mode loading: both queries feed the cards (the story line is a read across the
  // runs), so wait them both out behind the layout-matched skeleton. Mock seeds
  // synchronously → never shows. After all hooks.
  if (pending || workoutPending) return <MesoTemplatesSkeleton />

  const runsOut = templates.reduce((n, t) => n + t.runCount, 0)

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header
          className="pl-dhero pl-lhero is-slim rise"
          style={{ '--mus-color': 'var(--tag-gym)', ...delay(40) } as CSSProperties}
        >
          <span className="pl-dhero-wash" aria-hidden="true" />
          <button
            type="button"
            className="mz-backbtn"
            aria-label="Vissza"
            onClick={() => navigate('/train/mesocycles/konyvtar')}
          >
            ‹ Edzéstervek
          </button>
          <span className="pl-lhero-art" aria-hidden="true">
            <ClayIcon name="i-polc" size={60} className="icon" />
            <i />
            <i />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">Sablonjaid</span>
          <h2>Amiből indíthatsz</h2>
          <p className="pl-say">Egy sablon a recept — futamot indítasz belőle, és az már a te terved.</p>
          <div className="pl-poster-foot">
            <span>{templates.length} sablon</span>
            <span>{runsOut} futam indult belőlük</span>
          </div>
        </header>

        <PageBody className="pl-lib pl-sub tv-tpls">
          {templates.length === 0 && (
            <p className="pl-foot-say rise" style={delay(90)}>
              Még nincs sablonod — az elsőt alább állíthatod össze.
            </p>
          )}

          {templates.map((t, i) => {
            const days = trainingDayCount(t)
            const minutes = templateSessionMinutes(t)
            const muscles = templateWeekSets(t)
            const split = splitLabel(t)
            const story = templateStory(t.id, t.title, mesocycles)
            return (
              <button
                key={t.id}
                type="button"
                className="pl-lib-card glass rise"
                style={delay(90 + i * 30)}
                aria-label={`Sablon · ${t.title}`}
                onClick={() => navigate(`/train/templates/${t.id}`)}
              >
                <span className="pl-lib-head">
                  <strong>{t.title}</strong>
                  {split && <em>{split}</em>}
                  <b aria-hidden="true">›</b>
                </span>
                <span className="pl-day-facts">
                  <i><ClayIcon name="i-idozito" size={22} className="icon" /><b>{t.weeks}</b><small>hét</small></i>
                  <i><ClayIcon name="i-edzes" size={22} className="icon" /><b>{days}</b><small>nap hetente</small></i>
                  {minutes > 0 && (
                    <i><ClayIcon name="i-heti" size={22} className="icon" /><b>~{minutes}</b><small>perc</small></i>
                  )}
                </span>
                {muscles.length > 0 && (
                  <span className="pl-lib-mus">
                    {muscles.map((m) => (
                      <i key={m.group} style={{ '--mus-color': muscleColor(m.colorMuscle).rail } as CSSProperties}>
                        <MuscleChip token={m.colorMuscle} size={21} />
                      </i>
                    ))}
                  </span>
                )}
                <small className="pl-lib-note">{templateUseLine(story, t.runCount)}</small>
              </button>
            )
          })}

          {/* The create affordance, kept from the DS page (its „+ Új" chip and dashed
              footer CTA were the same door) — one loud button now. */}
          <button
            type="button"
            className="pl-lib-new rise"
            style={delay(120 + templates.length * 30)}
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
      </EntranceGroup>
    </MozaikPage>
  )
}
