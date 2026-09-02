// ============================================================
// Mezo · MesocyclePlannerPage — placeholder (wizard v2, mezo-d20.14).
// The old 5-step AI-guided planner (Cél/Hossz+fázisok/Split+napok/Fókusz/
// Program) is retired along with GOAL_PRESETS/SPLITS/planner.ts/programFit.ts
// (Task 4) — this route keeps rendering something honest at
// /train/mesocycles/new until the new 3-step wizard replaces it in Task 5.
// ============================================================
import { useBackNav } from '@/shared/hooks/useBackNav'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'

export function MesocyclePlannerPage() {
  const goBack = useBackNav('/train/mesocycles')

  return (
    <MozaikPage tone="gold">
      <PageHead label="‹ Mezociklus" onBack={goBack} />
      <PageBody>
        <p>A varázsló új verziója készül.</p>
      </PageBody>
    </MozaikPage>
  )
}
