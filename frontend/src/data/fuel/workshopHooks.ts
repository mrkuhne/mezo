import { useCallback } from 'react'
import { isMockMode } from '@/data/_client/mode'
import { workshopApi } from '@/data/fuel/workshopApi'
import { mockWorkshopTurn } from '@/data/fuel/workshopMock'
import type { WorkshopGoal, WorkshopDraft, WorkshopTurn } from '@/data/types'

/** Receptműhely turn (mezo-92pb) — an ephemeral call (no cache), the draftMealFromAi pattern:
 *  mock serves the scripted rounds after a demo delay, real POSTs /api/recipe/workshop/turn. */
export function useWorkshop() {
  const mock = isMockMode()
  const workshopTurn = useCallback(
    (req: { message: string; goal: WorkshopGoal | null; history: { role: 'user' | 'assistant'; text: string }[]; draft: WorkshopDraft | null }): Promise<WorkshopTurn> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(mockWorkshopTurn(req)), 600))
        : workshopApi.turn(req),
    [mock],
  )
  return { workshopTurn }
}
