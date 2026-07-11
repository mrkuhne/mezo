import type { DailyQuest } from '@/data/types'

/** Mock seed: a representative quest day (one offered BODY, one completed FUELBIO). */
export const mockQuestDay: DailyQuest[] = [
  {
    id: 'dq1',
    questDate: '2026-07-11',
    slot: 'BODY',
    skillKey: 'strength_endurance',
    title: 'A mai tervezett edzés a naptárban van — csináld végig',
    why: 'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',
    targetLabel: 'Mai tervezett edzés teljesítve',
    xp: 25,
    status: 'offered',
  },
  {
    id: 'dq2',
    questDate: '2026-07-11',
    slot: 'FUELBIO',
    skillKey: 'recovery',
    title: 'Reggeli súlymérés — logold be',
    why: 'Egy pont zaj, a sorozat trend: a reggeli rutinod adja a görbét, amiből a cél él.',
    targetLabel: 'Reggeli súly beloggolva',
    xp: 15,
    status: 'completed',
    completedAt: '2026-07-11T06:41:00Z',
  },
]

/** Mock reroll pool — swapped in client-side (the seed carries no reroll backend). */
export const mockRerollSpare: DailyQuest = {
  id: 'dq3',
  questDate: '2026-07-11',
  slot: 'BODY',
  skillKey: 'recovery',
  title: 'Pihenőnap: aludj legalább 7,5 órát',
  why: 'A pihenőnap edzés — az alvás alatt épül az izom és áll helyre az idegrendszer.',
  targetLabel: '≥ 7,5 óra alvás',
  xp: 20,
  status: 'offered',
}
