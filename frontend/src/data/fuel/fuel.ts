import type {
  FuelDay, SupplementStashItem, Protocol, FuelMeal, FuelSlot, MealItemLine, MealDimension,
  ProtocolOccurrence, StackZoneKey, StackPlacementSource,
} from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

const TODAY = localDateString()

// Each meal's top-level `score` is Σ(weight × dimension.score) off its OWN breakdown dimensions,
// rounded to 2 decimals — never a fabricated flat number (fix wave item 10). Dimensions are declared
// once below and referenced from BOTH `score` and `breakdown.dimensions`, so the seed can never
// drift out of sync with the score sheet it renders.
function weightedScore(dims: MealDimension[]): number {
  return Math.round(dims.reduce((sum, d) => sum + d.weight * d.score, 0) * 100) / 100
}

// m1 (Túrós zabkása · áfonyával, breakfast) dimensions — weights: Macro .22 · Rost .10 · WHO .14 ·
// Zsírminőség .10 · NOVA .18 · Növényi diverzitás .08 · Energia-sűrűség .06 · Context .12 (matches
// the real MealScoringService rubric, §1). Σ weight×score = .9196 → round(2) = 0.92.
const m1Dimensions: MealDimension[] = [
  {
    id: 'macro',
    label: 'Kcal & makró arány',
    weight: 0.22,
    score: 0.94,
    color: 'var(--coral)',
    detail:
      'P/C/F arány 29/54/19% — pre-Pull Day ablakra textbook. Kcal a napi 18.7%-a, ez egy 4-étkezéses napon ideális reggeli-súly.',
    macroRatio: { p: 29, c: 54, f: 19 },
    macroTargets: { p: '25–30%', c: '50–60%', f: '15–25%' },
    kcalShareOfDay: 18.7,
  },
  {
    id: 'micro',
    label: 'Rost & mikro',
    weight: 0.1,
    score: 0.84,
    color: 'var(--cat-physiology)',
    detail:
      'Rost 9.5g egy adagban — zab + túró kombó, a napi rostcél 78%-a. A Ca/Mg/B12 a WHO-dimenzió alá esik; a heti 64% Mg-status miatt fél evőkanál tökmag itt sokat dobna.',
    micros: [
      { name: 'Rost', value: '9.5g', pct: 78, status: 'good' },
    ],
  },
  {
    id: 'who',
    label: 'Ajánlások · WHO',
    weight: 0.14,
    score: 0.88,
    color: 'var(--sky)',
    detail: 'Cukor az energia 8%-a (WHO ≤10%) — a méz adja · só elhanyagolható.',
    context: [
      { label: 'Cukor', value: '8 E% / 10 E% limit' },
      { label: 'Só', value: '0.3 g / 1.5 g keret' },
    ],
  },
  {
    id: 'fat_quality',
    label: 'Zsírminőség',
    weight: 0.1,
    score: 0.86,
    color: 'var(--amber-deep)',
    detail: 'Telített zsír az energia 4%-a · az összzsír 28%-a — a mandula és a túró egyensúlyt tart.',
    context: [
      { label: 'Telített E%', value: '4% / 10% limit' },
      { label: 'Telített/összzsír', value: '28% (ref. 33%)' },
    ],
  },
  {
    id: 'nova',
    label: 'Feldolgozottság · NOVA',
    weight: 0.18,
    score: 0.92,
    color: 'var(--cat-tendency)',
    detail:
      "5/5 összetevő NOVA 1–3. Túró az egyetlen NOVA 3 (kulturált tejtermék) — élelmiszerként ez nem 'ultra-processed'. Zéró additívum, zéró ipari rekonstrukció.",
    nova: {
      dominant: 1,
      stack: [
        { nova: 1, pct: 78, label: 'Zab · áfonya · mandula' },
        { nova: 2, pct: 6, label: 'Méz' },
        { nova: 3, pct: 16, label: 'Túró' },
        { nova: 4, pct: 0, label: '—' },
      ],
      items: [
        { name: 'Zabpehely 70g', nova: 1 },
        { name: 'Túró 200g', nova: 3 },
        { name: 'Áfonya 80g', nova: 1 },
        { name: 'Méz 12g', nova: 2 },
        { name: 'Mandula 15g', nova: 1 },
      ],
    },
  },
  {
    id: 'plant_diversity',
    label: 'Növényi diverzitás',
    weight: 0.08,
    score: 1.0,
    color: 'var(--sage-deep)',
    detail: '3 különböző növényi kategória a 3-s célhoz — zab, áfonya, mandula.',
    context: [
      { label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' },
      { label: 'Összesen', value: '3 / 3 cél' },
    ],
  },
  {
    id: 'energy_density',
    label: 'Energia-sűrűség',
    weight: 0.06,
    score: 0.98,
    color: 'var(--lav)',
    detail: '154 kcal/100g (150 alatt teljes pont, 400 felett nulla) — a túró és az áfonya víztartalma húzza le.',
    context: [
      { label: 'Sűrűség', value: '154 kcal/100g' },
      { label: 'Lefedettség', value: '100% gramm-alapú' },
    ],
  },
  {
    id: 'context',
    label: 'Időzítés & kontextus',
    weight: 0.12,
    score: 0.96,
    color: 'var(--cat-preference)',
    detail:
      '07:15 reggeli · Pull Day T-10h · reggel az étvágy még magas. Lassú szénhidrát + komplett protein együtt délig stabilan tart — a 11:00-s pacing-alert így csendben marad.',
    context: [
      { label: 'Időzítés', value: 'Pre-Pull Day · T-10h' },
      { label: 'Étvágy', value: 'Reggel magas' },
      { label: 'Sport', value: 'Csü volleyball T-12h' },
      { label: 'Glikémia', value: 'Slow-release' },
    ],
  },
]

// m2 (Csirke + édesburgonya + spenót, lunch) dimensions — same weight rubric as m1.
// Σ weight×score = .9112 → round(2) = 0.91.
const m2Dimensions: MealDimension[] = [
  {
    id: 'macro',
    label: 'Kcal & makró arány',
    weight: 0.22,
    score: 0.86,
    color: 'var(--coral)',
    detail:
      'P/C/F 32/41/23%. Pre-workout ablakra a C kicsit alacsony — 80g körüli szénhidrát ideálisabb lenne PR-attempt-re. De a kombó biztonságos.',
    macroRatio: { p: 32, c: 41, f: 23 },
    macroTargets: { p: '25–30%', c: '50–60%', f: '15–25%' },
    kcalShareOfDay: 23.2,
    notes: 'C kicsit alacsony pre-workout ablakra.',
  },
  {
    id: 'micro',
    label: 'Rost & mikro',
    weight: 0.1,
    score: 0.92,
    color: 'var(--cat-physiology)',
    detail:
      'Rost 9.6g — édesburgonya + spenót, a napi rostcél 80%-a. A K/Fe/Vit A/folát/B6 a WHO-dimenzió alá esik — a hét egyik legjobb mikro-profilja.',
    micros: [
      { name: 'Rost', value: '9.6g', pct: 80, status: 'good' },
    ],
  },
  {
    id: 'who',
    label: 'Ajánlások · WHO',
    weight: 0.14,
    score: 0.94,
    color: 'var(--sky)',
    detail: 'Cukor az energia 3%-a (WHO ≤10%) · só a keret negyedén — tiszta whole-foods profil.',
    context: [
      { label: 'Cukor', value: '3 E% / 10 E% limit' },
      { label: 'Só', value: '0.4 g / 1.5 g keret' },
    ],
  },
  {
    id: 'fat_quality',
    label: 'Zsírminőség',
    weight: 0.1,
    score: 0.92,
    color: 'var(--amber-deep)',
    detail: 'Telített zsír az energia 4%-a · az összzsír 18%-a — olívaolaj-dominált, kedvező profil.',
    context: [
      { label: 'Telített E%', value: '4% / 10% limit' },
      { label: 'Telített/összzsír', value: '18% (ref. 33%)' },
    ],
  },
  {
    id: 'nova',
    label: 'Feldolgozottság · NOVA',
    weight: 0.18,
    score: 0.96,
    color: 'var(--cat-tendency)',
    detail:
      '100% whole foods. Olívaolaj az egyetlen NOVA 2 (kulináris feldolgozott alapanyag) — ez kívánatos, nem aggályos.',
    nova: {
      dominant: 1,
      stack: [
        { nova: 1, pct: 94, label: 'Csirke · burgonya · spenót' },
        { nova: 2, pct: 6, label: 'Olívaolaj' },
        { nova: 3, pct: 0, label: '—' },
        { nova: 4, pct: 0, label: '—' },
      ],
      items: [
        { name: 'Csirkemell 200g', nova: 1 },
        { name: 'Édesburgonya 250g', nova: 1 },
        { name: 'Spenót 100g', nova: 1 },
        { name: 'Olívaolaj 8g', nova: 2 },
      ],
    },
  },
  {
    id: 'plant_diversity',
    label: 'Növényi diverzitás',
    weight: 0.08,
    score: 1.0,
    color: 'var(--sage-deep)',
    detail: '3 különböző növényi kategória a 3-s célhoz — édesburgonya, spenót, olíva.',
    context: [
      { label: 'Növényi kategóriák', value: 'roots_tubers · leafy_greens · fruits' },
      { label: 'Összesen', value: '3 / 3 cél' },
    ],
  },
  {
    id: 'energy_density',
    label: 'Energia-sűrűség',
    weight: 0.06,
    score: 1.0,
    color: 'var(--lav)',
    detail: '129 kcal/100g (150 alatt teljes pont) — magas víztartalmú, tápanyag-sűrű whole-foods tál.',
    context: [
      { label: 'Sűrűség', value: '129 kcal/100g' },
      { label: 'Lefedettség', value: '100% gramm-alapú' },
    ],
  },
  {
    id: 'context',
    label: 'Időzítés & kontextus',
    weight: 0.12,
    score: 0.78,
    color: 'var(--cat-preference)',
    detail:
      '13:30 · pre-workout T-3.5h — ablakon belül van, de a határán. Sweet spot 2–3h, és a Pull Day PR-attempt-en egy gyorsabb-emésztésű C-snack 16:00 körül így kötelező (whey+banán már be van időzítve).',
    context: [
      { label: 'Szerep', value: 'Pre-workout üzemanyag-ablak' },
      { label: 'Időzítés', value: 'Pre-workout · T-3.5h' },
      { label: 'Étvágy', value: 'Nappal magas' },
      { label: 'PR-attempt', value: 'Chest Row · 107.5kg' },
      { label: 'Glikémia', value: 'Mixed-release' },
    ],
  },
]

export const fuelDay: FuelDay = {
  targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
  // Partial day at MOCK_NOW_HHMM 13:30 (mezo-1oy5): only the two morning meals are logged
  // (breakfast 09:15 + lunch 13:00), so consumed = their sum. The midday/evening windows are
  // still open → the fixed-plan state pass marks the next one `now`, the later ones `pending`.
  // (The pacing.msg "59%" narrative below is now stale vs this 42% — that consumed↔narrative
  //  drift is the pre-existing mezo-bgk8; deliberately not chased here.)
  consumed: { kcal: 1300, p: 100, c: 152, f: 30, water: 1850 },
  meals: [
    {
      id: 'm1',
      slot: 'Reggeli · 09:15 · post-workout',
      title: 'Túrós zabkása · áfonyával',
      score: weightedScore(m1Dimensions),
      kcal: 580,
      p: 42,
      c: 78,
      f: 12,
      fiberG: 8,
      loggedAt: `${TODAY}T09:15:00`,
      mealDate: TODAY,
      mealItems: [
        { source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag', name: 'Túrós zabkása · áfonyával',
          contribution: { kcal: 580, p: 42, c: 78, f: 12 }, nova: 3 } satisfies MealItemLine,
      ],
      items: ['Zabpehely 70g', 'Túró 200g', 'Áfonya 80g', 'Méz 12g', 'Mandula 15g'],
      tags: ['pre-volleyball', 'kifli.hu'],
      breakdown: {
        confidence: 0.86,
        tagline: null,
        summary:
          'Reggeli-as-engineering. Zab + túró slow-release glikémia délig, áfonya antocianin a Pull Day előtti gyulladás-modulációra. Csak a Mg jött ki rövidre — fél evőkanál tökmag megoldaná.',
        dimensions: m1Dimensions,
        improve: [
          { text: '+½ ek tökmag (~85mg Mg) — heti Mg-status 32% → 48%.', impact: '+0.04 score' },
          { text: '1g fahéj — postprandialis glükóz-válasz simább.', impact: '+0.01 score' },
        ],
        tools: [
          { type: 'read', name: 'lookupNutrients(items=5)' },
          { type: 'compute', name: 'classifyNOVA(items=5)' },
          { type: 'compute', name: 'evaluateMacroFit(meal, day_targets)' },
          { type: 'read', name: 'get_weekly_micro_status(Mg, B12)' },
          { type: 'compute', name: 'checkMezoContext(time=07:15, training=pull_day)' },
        ],
      },
    },
    {
      id: 'm2',
      slot: 'Ebéd · 13:00',
      title: 'Csirke + édesburgonya + spenót',
      score: weightedScore(m2Dimensions),
      kcal: 720,
      p: 58,
      c: 74,
      f: 18,
      fiberG: 6,
      loggedAt: `${TODAY}T13:00:00`,
      mealDate: TODAY,
      mealItems: [
        { source: 'recipe', refId: 'rec-2', amount: 1, unit: 'adag', name: 'Csirke + édesburgonya + spenót',
          contribution: { kcal: 720, p: 58, c: 74, f: 18 }, nova: 1 } satisfies MealItemLine,
      ],
      items: ['Csirkemell 200g', 'Édesburgonya 250g', 'Spenót 100g', 'Olívaolaj 8g'],
      tags: ['pre-workout'],
      breakdown: {
        confidence: 0.81,
        tagline: null,
        summary:
          'Whole-foods ebéd, T-3.5h-val a Pull Day előtt. A makró-arány protein-felé húz — védő, mert biztosítjuk a 220g/nap protein-target tartását, ha a PM étvágy leesik.',
        dimensions: m2Dimensions,
        improve: [
          { text: '+30–40g rizs vagy +1 banán → C 41% → 50% pre-workout ablakra.', impact: '+0.04 score' },
          { text: '+1 ek hummus vagy avokádó — F arány stabil + extra K.', impact: '+0.01 score' },
        ],
        tools: [
          { type: 'read', name: 'lookupNutrients(items=4)' },
          { type: 'compute', name: 'classifyNOVA(items=4)' },
          { type: 'compute', name: 'evaluatePreWorkoutFit(meal, workout=17:00)' },
          { type: 'read', name: 'get_workout_plan(today)' },
          { type: 'compute', name: 'predictGlycemicCurve()' },
        ],
      },
    },
  ],
  pacing: {
    msg: '59%-on vagyunk a napi kcal célból, és a tegnapi átlag ebben az időben 53% volt. Az étvágy ma még felül van — érdemes a vacsorát egy órával előrébb hozni.',
  },
  micronutrients: [
    { name: 'Mg', pct: 64, target: '400mg' },
    { name: 'Zn', pct: 78, target: '11mg' },
    { name: 'B6', pct: 92, target: '1.7mg' },
    { name: 'D', pct: 110, target: '2000IU' },
    { name: 'Ω3', pct: 71, target: '2.5g' },
  ],
  supplements: [
    { name: 'Kreatin', when: '07:30', state: 'done', dose: '5g' },
    { name: 'D3 + K2', when: '12:00', state: 'done', dose: '4000IU' },
    { name: 'Magnézium', when: '21:00', state: 'pending', dose: '300mg' },
    { name: 'Omega-3', when: 'vacsorához', state: 'pending', dose: '2g' },
  ],
}

export const supplementsStash: SupplementStashItem[] = [
  {
    id: 'kreatin',
    name: 'Kreatin monohidrát',
    brand: 'MyProtein',
    type: 'supplement',
    category: 'muscle',
    dose: '5g',
    form: 'por · 1 mérőkanál',
    stock: 86,
    stockUnit: 'adag',
    protocol: 'Naponta egy adag · időponttól független',
    timing: 'morning',
    taken: true,
  },
  {
    id: 'd3k2',
    name: 'D3 + K2',
    brand: 'MyProtein',
    type: 'supplement',
    category: 'vitamin',
    dose: '4000IU + 100µg',
    form: 'kapszula · 1db',
    stock: 42,
    stockUnit: 'db',
    protocol: 'Naponta zsírral · délben legjobban',
    timing: 'midday',
    taken: true,
  },
  {
    id: 'magnez',
    name: 'Magnézium-glicinát',
    brand: 'Pure Encapsulations',
    type: 'supplement',
    category: 'sleep',
    dose: '300mg',
    form: 'kapszula · 2db',
    stock: 58,
    stockUnit: 'db',
    protocol: '21:00-kor lefekvés előtt 2h-val · pattern P2 megerősítve',
    timing: 'evening',
    taken: false,
  },
  {
    id: 'omega3',
    name: 'Omega-3',
    brand: 'Carlson',
    type: 'supplement',
    category: 'anti-inflammatory',
    dose: '2g EPA+DHA',
    form: 'softgel · 2db',
    stock: 64,
    stockUnit: 'db',
    protocol: 'Vacsorához · zsír felszívódáshoz',
    timing: 'dinner',
    taken: false,
  },
  {
    id: 'whey',
    name: 'Impact Whey Protein',
    brand: 'MyProtein',
    type: 'supplement',
    category: 'protein',
    dose: '30-40g',
    form: 'por · 1 scoop · csoki',
    stock: 24,
    stockUnit: 'adag',
    protocol: 'Pre/post workout · pre-volleyball T-2h',
    timing: 'flexible',
    taken: true,
  },
  {
    id: 'origin-pwo',
    name: 'Origin PWO',
    brand: 'Origin',
    type: 'stimulant',
    category: 'caffeine',
    dose: '20g',
    form: 'por · 1 napi adag · kékmálna',
    stock: 25,
    stockUnit: 'adag',
    protocol: 'Pre-workout T-30min · 300mg koffein · 14:00 előtt',
    timing: 'pre-workout',
    taken: false,
    caffeine: true,
  },
  {
    id: 'tastydose',
    name: 'Tasty Dose gombakávé',
    brand: 'Tasty Dose',
    type: 'stimulant',
    category: 'caffeine',
    dose: '8g',
    form: 'por · 1 púpozott mérőkanál · 200ml forró víz',
    stock: 30,
    stockUnit: 'adag',
    protocol: 'Reggel, súlymérés után · 100mg koffein · 14:00 cutoff',
    timing: 'morning',
    taken: true,
    caffeine: true,
  },
  {
    id: 'kohi',
    name: 'Kávé · espresso',
    brand: 'Hario',
    type: 'stimulant',
    category: 'caffeine',
    dose: '80-100mg',
    form: '1 espresso shot',
    stock: null,
    stockUnit: null,
    protocol: 'Reggel 1 · ebéd után 1 · 14:00 hard cutoff',
    timing: 'morning',
    taken: true,
    caffeine: true,
  },
  {
    id: 'cink',
    name: 'Cink-biszglicinát',
    brand: 'Now Foods',
    type: 'supplement',
    category: 'mineral',
    dose: '15mg',
    form: 'kapszula',
    stock: 90,
    stockUnit: 'db',
    protocol: 'Este · vacsora után',
    timing: 'evening',
    taken: false,
  },
]

// --- Fuel · Stack occurrences (living protocol, mezo-vx9v) ---
// One occurrence per placed stash item (cink excluded — not placed in the protocol yet). Mirrors
// PlacementRules.RULES (backend/.../feature/fuel/service/
// PlacementRules.java) — the FULL rule-table + timing-hint pass the backend ran once to seed
// these placements; `mockPlaceOccurrence` below only mirrors the timing-hint stage (the mock's
// runtime placement path for newly-added items has no name-rule table or LLM).
function occ(
  refId: string,
  slotKey: StackZoneKey,
  source: StackPlacementSource,
  reason: string,
  hint: string | null = null,
  restDay: StackZoneKey | 'skip' | null = null,
): ProtocolOccurrence {
  return {
    id: `occ-${refId}`,
    pantryItemId: refId,
    slotKey,
    dose: null,
    pinned: false,
    placementSource: source,
    placementReason: reason,
    restDayFallback: restDay,
    dailyTotalHint: hint,
  }
}

export const protocolOccurrences: ProtocolOccurrence[] = [
  occ('kreatin', 'wake', 'rule', 'Kreatin ébredés után vízben — a napi konzisztencia számít.',
      'ajánlott napi összmennyiség 15–20g — érdemes 3-4 bevételre osztani'),
  occ('kohi', 'wake', 'rule', 'Koffein a nap elején — bőven a 14:00-s cutoff előtt.'),
  occ('tastydose', 'wake', 'rule', 'Koffein a nap elején — bőven a 14:00-s cutoff előtt.'),
  occ('origin-pwo', 'pre_workout', 'rule',
      'Pump-stack ~40 perccel edzés előtt — plazmacsúcs edzéskezdésre; pihenőnapon kimarad.', null, 'skip'),
  occ('whey', 'post_workout', 'rule', 'Fehérje az edzés utáni ablakban — pihenőnapon reggelihez.', null, 'breakfast'),
  occ('d3k2', 'lunch', 'rule', 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.'),
  occ('omega3', 'lunch', 'rule', 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.'),
  occ('magnez', 'evening', 'rule', 'Magnézium este — GABA-moduláció, mélyalvás-támogatás.'),
]

/** Mirrors PlacementRules.zoneForTiming's timing-hint pass (backend/.../PlacementRules.java) —
 *  the mock's runtime placement path for `useProtocolActions().addItem`/`unpinItem` when no
 *  explicit slotKey is given. Deliberately skips the name-substring rule table + LLM stages
 *  (the mock has neither) — falls straight to the honest breakfast/fallback zone. */
export function mockPlaceOccurrence(
  item: SupplementStashItem,
): Pick<ProtocolOccurrence, 'slotKey' | 'placementSource' | 'placementReason'> {
  const zone = zoneForTiming(item.timing)
  if (zone) {
    return { slotKey: zone, placementSource: 'rule', placementReason: 'A Kamra-item ajánlott időzítése alapján.' }
  }
  return { slotKey: 'breakfast', placementSource: 'fallback', placementReason: 'Bizonytalan besorolás — helyezd át, ha máskor szeded.' }
}

function zoneForTiming(timing: string): StackZoneKey | null {
  switch (timing) {
    case 'morning': return 'wake'
    case 'midday': return 'lunch'
    case 'evening': return 'evening'
    case 'dinner': return 'dinner'
    case 'pre-workout': return 'pre_workout'
    default: return timing.startsWith('weekly') ? 'wake' : null
  }
}

export const protocol: Protocol = {
  version: 3,
  builtAt: 'ma 06:00',
  source: 'Stack builder',
  status: 'active',
  itemCount: 8,
  confidence: 0.86,
  lastReplanReason: null,
  history: [
    { v: 3, when: 'ma 06:00', reason: 'Reggeli újraszámolás · stack-poll' },
    { v: 2, when: 'tegnap 19:30', reason: 'Vb-load alapján vacsora-idő tolva 21:15 → 21:00' },
    { v: 1, when: 'Máj 19 · 09:00', reason: 'Hét eleji baseline' },
  ],
}

export function getScoredMeal(slot: FuelSlot, meals: FuelMeal[]): FuelMeal | null {
  return slot.mealId ? meals.find(m => m.id === slot.mealId && m.breakdown) ?? null : null
}
