import type { HabitItem, HabitSummary } from '@/data/types'

/** Static seed mirroring content/habit-catalog.json; demo state: 3 morning items done. */
export const mockHabitDay: HabitItem[] = [
  { key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben',
    why: 'A napfelkeltéhez igazított ébredés indítja az esti melatonint — a mély alvás reggel kezdődik.',
    anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:20:00Z', xp: 10, strengthPct: 82 },
  { key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény',
    why: '10 perc reggeli fény a szemednek — este pontosabban érkezik az álmosság.',
    anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', doneAt: '2026-07-19T04:40:00Z', xp: 5, strengthPct: 64 },
  { key: 'morning_weigh_in', chain: 'MORNING', position: 3, title: 'Reggeli súlymérés',
    why: 'Ugyanakkor mérve a reggeli súly a valódi alapvonal — azonnali visszajelzés a hétre.',
    anchorCopy: 'fogmosás után', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:45:00Z', xp: 10, strengthPct: 93 },
  { key: 'morning_coffee', chain: 'MORNING', position: 4, title: 'Gombakávé',
    why: 'A korai koffein a mélymunkát fűti — és estére már nyoma sincs.',
    anchorCopy: 'súlymérés után', mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 71 },
  { key: 'morning_workout', chain: 'MORNING', position: 5, title: 'Reggeli edzés',
    why: 'A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el.',
    anchorCopy: 'kávé után', mode: 'DERIVED', status: 'pending', xp: 15, strengthPct: 57 },
  { key: 'protein_breakfast', chain: 'MORNING', position: 6, title: 'Fehérjés reggeli',
    why: 'Legalább 25 g fehérje reggel — az éjszakai lebontás után építésbe fordulsz.',
    anchorCopy: 'edzés után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 79 },
  { key: 'caffeine_cutoff', chain: 'EVENING', position: 1, title: 'Koffein-cutoff',
    why: 'A koffein felezési ideje ~6 óra — a délutáni kávé az éjszakádból vesz el.',
    anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 86 },
  { key: 'kitchen_close', chain: 'EVENING', position: 2, title: 'Konyha zárva',
    why: 'Az utolsó falat és a lefekvés közti 90 perc a mély alvásod védőzónája.',
    anchorCopy: 'vacsora után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 68 },
  { key: 'wind_down', chain: 'EVENING', position: 3, title: 'Wind-down, képernyő le',
    why: 'A tompuló fény jelzi az agyadnak: jöhet a melatonin.',
    anchorCopy: 'konyhazárás után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 43 },
  { key: 'bed_on_time', chain: 'EVENING', position: 4, title: 'Lefekvés időben',
    why: 'A fix lefekvés a teljes lánc záróköve — ettől lesz holnap is reggeled.',
    anchorCopy: 'wind-down után', mode: 'DERIVED', status: 'pending', xp: 15, strengthPct: 61 },
]

export const mockHabitSummary: HabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: mockHabitDay.map((h) => ({
    key: h.key, strengthPct: h.strengthPct ?? null, done28: 18, missed28: 6,
  })),
}
