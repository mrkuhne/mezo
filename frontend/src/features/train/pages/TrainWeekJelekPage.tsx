// ============================================================
// Mezo · TrainWeekJelekPage („Minden izomjel") — Terhelés subpage (Train parity
// P2 Task 1, mezo-lf3cv). Source of truth: the prototype's `muscleMapHtml`
// (docs/design_2.0/prototypes/companion-titanium/muscles.js:9) + its `.mm-*`
// family (train-pages.css:154), ported onto the `.mm-` house section
// (styles/prototype.css). The doorway is the map page's own quiet `.pl-row`.
//
// The screen is the TAXONOMY, drawn: the six regions in their display order with
// all 21 live catalog tokens under them (REGION_MUSCLES — the single source the
// picker/filter surfaces already read, so a token added there appears here for
// free). Each cell is the muscle's own clay silhouette, the SAME drawing path
// every other Train surface uses (MuscleChip, slice T3) — there is no second
// geometry path in the app and this page does not open one.
//
// HONESTY — what „is-live" means: the muscle was actually WORKED this week, read
// off the same logged source the map page reads (useWeekMuscleLog().details →
// workedMusclesThisWeek). NOT the plan, not tonight's unlogged session. A token
// the week's log cannot speak for renders UNLIT, never guessed lit; mock mode
// has no persisted instances at all (weekMuscleLogHooks header note), so every
// cell there is honestly unlit and the head says so in one line.
// ============================================================
import type { CSSProperties } from 'react'
import { useWeekMuscleLog } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Skeleton } from '@/shared/ui/Skeleton'
import { REGION_LABELS, REGION_MUSCLES, regionColor } from '@/features/train/logic/muscleColors'
import { workedMusclesThisWeek } from '@/features/train/logic/loadWeek'
import { MUSCLE_LABELS } from '@/data/train/train'

function JelekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div style={{ position: 'relative', padding: '58px 24px 20px' }}>
        <Skeleton width={90} height={11} />
        <div style={{ marginTop: 10 }}><Skeleton width={220} height={24} /></div>
      </div>
      <div className="col gap-sm" style={{ padding: '0 24px 19px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} width="100%" height={120} radius={20} />
        ))}
      </div>
    </div>
  )
}

export function TrainWeekJelekPage() {
  const weekLog = useWeekMuscleLog()
  const goBack = useBackNav('/train/week/terkep')

  if (weekLog.pending) return <JelekSkeleton />

  const worked = workedMusclesThisWeek(weekLog.details)

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header className="ld-hero is-slim rise" style={{ '--d': '40ms' } as CSSProperties}>
          <span className="ld-hero-wash" />
          <button type="button" className="mz-backbtn ld-back" onClick={goBack}>‹ Izomtérkép</button>
          <div className="mm-head">
            <span className="ld-eyebrow">Izomtérkép</span>
            <strong>Minden izomcsoport, saját jellel</strong>
            <small>Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.</small>
          </div>
        </header>

        <PageBody className="tw-signals">
          <section className="mm">
            {REGION_MUSCLES.map((group, gi) => (
              <div
                key={group.region}
                className="mm-region rise"
                style={{ '--mm-color': regionColor(group.region).rail, '--d': `${70 + gi * 25}ms` } as CSSProperties}
              >
                <div className="mm-region-head">
                  <strong>{REGION_LABELS[group.region]}</strong>
                  <span>{group.muscles.length} izom</span>
                </div>
                <div className="mm-grid">
                  {group.muscles.map((token) => (
                    <span
                      key={token}
                      className={worked.has(token) ? 'mm-cell is-live' : 'mm-cell'}
                      data-muscle={token}
                    >
                      <MuscleChip token={token} size={40} />
                      <small>{MUSCLE_LABELS[token] ?? token}</small>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <p className="ld-wait-done">
            {worked.size > 0
              ? 'A kigyulladt jelek azok az izmok, amiken ezen a héten már dolgoztál.'
              : 'Ezen a héten még egy izmod sincs naplózva — amint egy edzés lezárul, a jele kigyullad.'}
          </p>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
