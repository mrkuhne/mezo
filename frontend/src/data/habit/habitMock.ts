import type { HabitCatalog, HabitDefInfo, HabitItem, HabitSuggestion, HabitSummary } from '@/data/types'

/**
 * Static seed mirroring content/habit-catalog.json; demo state: 3 morning items done.
 * Deliberate mock deviations (there is no evaluator / nightly close / "tomorrow" in the
 * static mock day, so honest server-side derivation has no mock equivalent):
 * - caffeine_cutoff + kitchen_close are MANUAL here (real catalog: DERIVED END_OF_DAY) so
 *   the evening chain stays playable;
 * - bed_on_time (E4 — decided by TOMORROW's sleep log) is omitted entirely: it could never
 *   complete and would sit as a permanently dead row (mezo-o5hx).
 */
export const mockHabitDay: HabitItem[] = [
  { key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben',
    why: 'A napfelkeltéhez igazított ébredés indítja az esti melatonint — a mély alvás reggel kezdődik.',
    anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:20:00Z', xp: 10, strengthPct: 82 },
  { key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény',
    why: '10 perc reggeli fény a szemednek — este pontosabban érkezik az álmosság.',
    anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', doneAt: '2026-07-19T04:40:00Z', xp: 5, strengthPct: 64 },
  { key: 'morning_pushups', chain: 'MORNING', position: 3, title: '50 fekvőtámasz',
    why: 'Egy rövid, kemény pumpa reggel — beindítja a vért és bebizonyítja, hogy te irányítasz.',
    anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 48 },
  { key: 'morning_video', chain: 'MORNING', position: 4, title: 'Reggeli videó',
    why: 'A napi videó egy kattintással — nézd meg és indítsd vele fókuszáltan a reggelt.',
    anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 39,
    linkUrl: 'https://www.facebook.com/share/r/1ERXP5zNFs/?mibextid=wwXIfr' },
  { key: 'morning_weigh_in', chain: 'MORNING', position: 5, title: 'Reggeli súlymérés',
    why: 'Ugyanakkor mérve a reggeli súly a valódi alapvonal — azonnali visszajelzés a hétre.',
    anchorCopy: 'fogmosás után', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:45:00Z', xp: 10, strengthPct: 93 },
  { key: 'morning_coffee', chain: 'MORNING', position: 6, title: 'Gombakávé',
    why: 'A korai koffein a mélymunkát fűti — és estére már nyoma sincs.',
    anchorCopy: 'súlymérés után', mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 71 },
  { key: 'morning_workout', chain: 'MORNING', position: 7, title: 'Reggeli edzés',
    why: 'A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el.',
    anchorCopy: 'kávé után', mode: 'DERIVED', status: 'pending', xp: 15, strengthPct: 57 },
  { key: 'protein_breakfast', chain: 'MORNING', position: 8, title: 'Fehérjés reggeli',
    why: 'Legalább 25 g fehérje reggel — az éjszakai lebontás után építésbe fordulsz.',
    anchorCopy: 'edzés után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 79 },
  { key: 'caffeine_cutoff', chain: 'EVENING', position: 1, title: 'Koffein-cutoff',
    why: 'A koffein felezési ideje ~6 óra — a délutáni kávé az éjszakádból vesz el.',
    anchorCopy: 'a lánc kezdete', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 86 },
  { key: 'kitchen_close', chain: 'EVENING', position: 2, title: 'Konyha zárva',
    why: 'Az utolsó falat és a lefekvés közti 90 perc a mély alvásod védőzónája.',
    anchorCopy: 'vacsora után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 68 },
  { key: 'intention_reflect', chain: 'EVENING', position: 3, title: 'Szándékkal éltem?',
    why: 'A napzáró őszinte pillantás tanít a legtöbbet — tartás vagy sodródás volt?',
    anchorCopy: 'konyhazárás után', mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 55 },
  { key: 'evening_ritual', chain: 'EVENING', position: 4, title: 'Napzárás',
    why: 'A lezárt nap nem forog tovább a fejedben — a rituálé elengedni tanít.',
    anchorCopy: 'esti reflexió után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: null },
  { key: 'wind_down', chain: 'EVENING', position: 5, title: 'Wind-down, képernyő le',
    why: 'A tompuló fény jelzi az agyadnak: jöhet a melatonin.',
    anchorCopy: 'napzárás után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 43 },
]

export const mockHabitSummary: HabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: mockHabitDay.map((h) => ({
    key: h.key, strengthPct: h.strengthPct ?? null, done28: 18, missed28: 6,
  })),
}

/**
 * Full habit-def catalog for the routine editor (mezo-n5e9.2). Mirrors the real backend seed
 * (`backend/src/main/resources/content/habit-catalog.json` — 9 MORNING + 6 EVENING = 15 defs)
 * rather than mockHabitDay's 13-row DAY VIEW: the catalog describes what defs EXIST (config),
 * so it also carries `bed_on_time` and `daily_intention` — the two keys mockHabitDay's own doc
 * comment explains are deliberately absent from a single day's evaluation. metric/skillKey/xp
 * values below mirror habit-catalog.json 1:1 for every key, so the editor and the real backend
 * agree on what each DERIVED habit's metric means.
 */
const CATALOG_META: Record<string, { metric: string; skillKey: string }> = {
  wake_on_time: { metric: 'sleep_wake_window', skillKey: 'recovery' },
  morning_sunlight: { metric: 'manual', skillKey: 'recovery' },
  morning_pushups: { metric: 'manual', skillKey: 'mindset' },
  morning_video: { metric: 'manual', skillKey: 'learning' },
  morning_weigh_in: { metric: 'weight_logged_today', skillKey: 'mindset' },
  morning_coffee: { metric: 'stim_intake_today', skillKey: 'productivity' },
  morning_workout: { metric: 'training_done_today', skillKey: 'mindset' },
  protein_breakfast: { metric: 'breakfast_protein', skillKey: 'cooking' },
  caffeine_cutoff: { metric: 'no_stim_after', skillKey: 'recovery' },
  kitchen_close: { metric: 'last_meal_before', skillKey: 'recovery' },
  intention_reflect: { metric: 'intention_reflected', skillKey: 'mindset' },
  evening_ritual: { metric: 'ritual_closed', skillKey: 'mindset' },
  wind_down: { metric: 'manual', skillKey: 'mindfulness' },
}

function toDefInfo(h: HabitItem): HabitDefInfo {
  const meta = CATALOG_META[h.key] ?? { metric: 'manual', skillKey: 'mindset' }
  return {
    id: `def-${h.key}`,
    habitKey: h.key,
    chainKey: h.chain,
    position: h.position,
    title: h.title,
    why: h.why,
    anchorCopy: h.anchorCopy,
    mode: h.mode,
    // caffeine_cutoff/kitchen_close are MANUAL here per mockHabitDay's own deliberate
    // playability deviation (see its doc comment above) even though CATALOG_META's metric for
    // them mirrors the real seed's DERIVED value (no_stim_after/last_meal_before). The backend
    // can never produce MANUAL+a-real-metric (MANUAL always forces metric to "manual"), so
    // mock-internal consistency wins here: force "manual" whenever the mock day says MANUAL.
    metric: h.mode === 'MANUAL' ? 'manual' : meta.metric,
    skillKey: meta.skillKey,
    xp: h.xp,
    linkUrl: h.linkUrl ?? null,
    isActive: true,
    framework: null,
    anchorHabitKey: null,
    cue: null,
    craving: null,
    reward: null,
    celebration: null,
    identity: null,
  }
}

// The two habit-catalog.json defs mockHabitDay's day view omits (see its doc comment) — hand-
// written here from the same source so the catalog carries the full 9 MORNING + 6 EVENING seed.
const dailyIntention: HabitDefInfo = {
  id: 'def-daily_intention', habitKey: 'daily_intention', chainKey: 'MORNING', position: 9,
  title: 'Napi szándék', why: 'Egy szándékkal indított nap nem sodródik — te választod az irányt.',
  anchorCopy: 'reggeli rutin után', mode: 'DERIVED', metric: 'intention_focus_set', skillKey: 'mindset',
  xp: 10, linkUrl: null, isActive: true,
  framework: 'CLEAR',
  anchorHabitKey: null,
  cue: '7:10-kor a konyhaasztalnál, füzet a bögre mellett',
  craving: 'tisztább fejjel indul a nap',
  reward: 'a pipa maga',
  celebration: null,
  identity: 'figyel a saját gondolataira',
}
const bedOnTime: HabitDefInfo = {
  id: 'def-bed_on_time', habitKey: 'bed_on_time', chainKey: 'EVENING', position: 6,
  title: 'Lefekvés időben', why: 'A fix lefekvés a teljes lánc záróköve — ettől lesz holnap is reggeled.',
  anchorCopy: 'letettem a fogkefét', mode: 'DERIVED', metric: 'bedtime_next_day', skillKey: 'recovery',
  xp: 15, linkUrl: null, isActive: true,
  framework: 'FOGG',
  anchorHabitKey: null,
  cue: null,
  craving: null,
  reward: null,
  celebration: 'mély levegő + „ez az”',
  identity: null,
}

/** Canned "AI javaslat" fixture (mock mode, mezo-n5e9.3) — palette-consistent with the seed
 *  catalog above: seed chainKeys (MORNING/EVENING), LIFE skillKeys, xp in the 5-15 seed range. */
export const mockHabitSuggestions: HabitSuggestion[] = [
  {
    title: 'Esti telefon-lezárás', why: 'A képernyő 30 perccel lefekvés előtt lekapcsolva gyorsabb elalvást hoz.',
    anchorCopy: 'wind-down előtt', skillKey: 'recovery', xp: 10, chainKey: 'EVENING',
    framework: 'FOGG', cue: null, craving: null, reward: null, celebration: 'egy elégedett bólintás',
  },
  {
    title: 'Reggeli 5 perc nyújtás', why: 'Pár perc mobilizáció ébredés után élénkebbé teszi a testet a nap elejére.',
    anchorCopy: 'ébredés után', skillKey: 'mindset', xp: 5, chainKey: 'MORNING',
    framework: 'CLEAR', cue: 'ébredés után az ágy szélén ülve', craving: 'frissebben indul a test', reward: 'a nyújtás jó érzése', celebration: null,
  },
]

export const mockHabitCatalog: HabitCatalog = {
  chains: [
    {
      id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
      position: 1, isActive: true,
      defs: [...mockHabitDay.filter((h) => h.chain === 'MORNING').map(toDefInfo), dailyIntention],
    },
    {
      id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING',
      position: 2, isActive: true,
      defs: [...mockHabitDay.filter((h) => h.chain === 'EVENING').map(toDefInfo), bedOnTime],
    },
  ],
}
