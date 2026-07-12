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
    completionMode: 'DERIVED',
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
    completionMode: 'DERIVED',
    completedAt: '2026-07-11T06:41:00Z',
  },
  {
    id: 'dq3g',
    questDate: '2026-07-11',
    slot: 'GROWTH',
    skillKey: 'learning',
    title: 'Olvass ma legalább 10 percet',
    why: 'Aki naponta olvas, az olvasó ember — napi 10 perc évi több mint 60 óra tanulás.',
    targetLabel: 'Tevékenységnapló-bejegyzés ma',
    xp: 20,
    status: 'offered',
    completionMode: 'ACTIVITY',
  },
]

/** Mock seed: 30-day quest history for the Growth journal (terminal statuses only). */
export const mockQuestHistory: DailyQuest[] = [
  { ...mockQuestDay[1], id: 'qh1' },
  {
    id: 'qh2', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
    title: 'A mai tervezett edzés a naptárban van — csináld végig',
    why: 'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',
    targetLabel: 'Mai tervezett edzés teljesítve', xp: 25, status: 'completed',
    completedAt: '2026-07-11T18:05:00Z', completionMode: 'DERIVED',
  },
  {
    id: 'qh3', questDate: '2026-07-11', slot: 'GROWTH', skillKey: 'mindfulness',
    title: '10 perc meditáció vagy légzőgyakorlat',
    why: 'A figyelmed izom: napi 10 perc edzéssel nyugodtabb az alvás és élesebb a fókusz.',
    targetLabel: 'Tevékenységnapló-bejegyzés ma', xp: 20, status: 'expired', completionMode: 'ACTIVITY',
  },
  {
    id: 'qh4', questDate: '2026-07-10', slot: 'FUELBIO', skillKey: 'recovery',
    title: 'Igyál meg legalább 2,5 litert ma',
    why: 'A hidratáltság a legolcsóbb teljesítményfokozó — edzés, fókusz, étvágy mind rajta múlik.',
    targetLabel: '≥ 2500 ml víz', xp: 15, status: 'completed',
    completedAt: '2026-07-10T20:00:00Z', completionMode: 'DERIVED',
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
  completionMode: 'DERIVED',
}
