// ============================================================
// Mezo · TrainWeekJelekPage („Minden izomjel") — Terhelés subpage, Folyadék face
// (mezo-n4wf5.3, slice F3). Prototype: docs/design_2.0/prototypes/vilagos/edzes.js `jelek()`
// (route `#w-edzes-jelek`, args `ures` / `tolt`). The doorway is the map page's „Mélyebben" row.
//
// The screen is the TAXONOMY, drawn: the hero holds one tube per region (how many of its
// muscles were worked this week), then the six regions in their display order with all 21
// live catalog tokens under them (REGION_MUSCLES — the single source the picker/filter
// surfaces already read, so a token added there appears here for free). Each cell is the
// muscle's own silhouette through the SAME drawing path every other Train surface uses
// (MuscleChip, on white through `Mchp`) — there is no second geometry path in the app.
//
// HONESTY — what a full sign means: the muscle was actually WORKED this week, read off the
// same logged source the map page reads (useWeekMuscleLog().details →
// workedMusclesThisWeek). NOT the plan, not tonight's unlogged session. A token the week's
// log cannot speak for stays pale, never guessed full; mock mode has no persisted instances
// at all (weekMuscleLogHooks header note), so every sign there is honestly pale and the
// hero says so in one line.
// ============================================================
import { useWeekMuscleLog } from '@/data/hooks'
import { Card, FrameBack, Hero, Note, Page, Section, Tubes, useFrameTitle } from '@/shared/ui/folyadek'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { LIVE_MUSCLES, REGION_LABELS, REGION_MUSCLES } from '@/features/train/logic/muscleColors'
import { workedMusclesThisWeek } from '@/features/train/logic/loadWeek'
import { MUSCLE_LABELS } from '@/data/train/train'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'

export function TrainWeekJelekPage() {
  const weekLog = useWeekMuscleLog()
  useFrameTitle({ title: 'Minden izomjel', eyebrow: 'Izomtérkép' })

  if (weekLog.pending) return <TrainWeekSkeleton blocks={[260, 150, 150, 150]} />

  const worked = workedMusclesThisWeek(weekLog.details)
  const workedCount = LIVE_MUSCLES.filter((m) => worked.has(m)).length

  return (
    <Page className="et-page">
      <FrameBack history fallback="/train/week/terkep" label="Vissza: Izomtérkép" className="fo-backpill">‹ Izomtérkép</FrameBack>
      <Hero
        label="Izomtérkép · minden izomcsoport, saját jellel"
        verdict={workedCount > 0
          ? `${workedCount} izmon dolgoztál már ezen a héten a ${LIVE_MUSCLES.length}-ből.`
          : 'Ezen a héten még egy izmod sincs naplózva.'}
        sub="Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó."
      >
        <Tubes
          className="et-regions"
          size="sm"
          height={92}
          gap={6}
          aria-label="Régiónként: hány izmon dolgoztál már a héten"
          items={REGION_MUSCLES.map((group) => {
            const on = group.muscles.filter((m) => worked.has(m)).length
            const first = group.muscles[0]
            return {
              label: REGION_LABELS[group.region],
              value: `${on}/${group.muscles.length}`,
              pct: (on / group.muscles.length) * 94,
              node: <Mchp muscle={first} size={28} />,
              color: deepMuscle(first),
            }
          })}
        />
        <Note>
          {workedCount > 0
            ? 'A teli jelek azok az izmok, amiken ezen a héten már dolgoztál.'
            : 'Amint egy edzés lezárul, a jele megtelik.'}
        </Note>
      </Hero>

      {REGION_MUSCLES.map((group, gi) => (
        <div key={group.region} className="et-region" data-region={group.region}>
          <Section n={gi + 1} title={`${REGION_LABELS[group.region]} · ${group.muscles.length} izom`} />
          <Card>
            <div className="et-mm">
              {group.muscles.map((token) => (
                <div key={token} className={worked.has(token) ? 'et-sign is-live' : 'et-sign'} data-muscle={token}>
                  <Mchp muscle={token} />
                  <span>{MUSCLE_LABELS[token] ?? token}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}
    </Page>
  )
}
