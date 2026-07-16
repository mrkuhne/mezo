import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import type { BuiltProtocol, ProtocolSlotData, ProtocolSlotItem, Reasoning, SupplementStashItem } from '@/data/types'

/** The user's real day anchors that drive slot times when provided. */
export interface ProtocolAnchors {
  wake: string
  preWorkout?: string
  bedtime: string
}

// ============================================================
// Protocol builder · the "AI logic"
// Deterministic mock based on selected items + meso phase + Reta phase.
// Ported from fuel-stack.jsx:397-515. The prototype's `meso`/`Reta`
// context is hardcoded into the reasoning strings, so the only live
// input is the set of selected stash ids.
//
// Optional `anchors` make the slot TIMES derive from the user's real day
// (wake / pre-workout / bedtime) instead of the hardcoded mock times. Only
// the `time` fields shift; window/reasoning prose stays as-is (P8 cleans it).
// Without anchors every hardcoded time is preserved.
// ============================================================
export function buildProtocol(
  selectedIds: string[],
  stash: SupplementStashItem[],
  anchors?: ProtocolAnchors,
): BuiltProtocol {
  const items = stash.filter(i => selectedIds.includes(i.id))

  // Anchor-derived slot times (fall back to the mock times when unanchored).
  const wakeTime = anchors?.wake ?? '05:50'
  // Rest-day (anchors but no preWorkout) keeps the pre-workout slot relative to wake.
  const preWorkoutTime = anchors ? (anchors.preWorkout ?? toHHmm(toMin(anchors.wake) + 60)) : '06:50'
  const preFuelTime = anchors ? toHHmm(toMin(preWorkoutTime) - 30) : '06:20'
  const middayTime = '12:30'
  const eveningTime = anchors ? toHHmm(toMin(anchors.bedtime) - 120) : '21:00'
  // Match stash items by name/id substring (lowercased) instead of mock slug ids:
  // in real mode ids are backend UUIDs and names come from the real catalog, so
  // slug lookups (byId('kreatin')) silently miss. Needles are lowercase; pick
  // ones that avoid accent pitfalls (e.g. 'magn' matches 'Magnézium…').
  const norm = (s: string) => s.toLowerCase()
  const find = (...needles: string[]) =>
    items.find(i => needles.some(n => norm(i.name).includes(n) || norm(i.id).includes(n)))

  const slots: ProtocolSlotData[] = []
  const reasoning: Reasoning[] = []

  // Wake / morning caffeine + kreatin.
  // Prefer coffee/espresso over the caffeine tablet (mirrors the original
  // byId('kohi') || byId('caffeine200') preference) so the item label stays right.
  const coffee = find('kávé', 'kohi', 'espresso')
  const caffTab = find('koffein', 'caffeine')
  const morningCaff = coffee || caffTab
  const kreatin = find('kreatin')
  if (morningCaff || kreatin) {
    const wakeItems: ProtocolSlotItem[] = []
    if (morningCaff)
      wakeItems.push({
        refId: morningCaff.id,
        name: morningCaff === coffee ? 'Espresso · 1 shot' : 'Koffein 200mg',
        dose: morningCaff.dose,
        color: 'var(--warning)',
      })
    if (kreatin) wakeItems.push({ refId: kreatin.id, name: 'Kreatin', dose: '5g vízben', color: 'var(--coral)' })
    slots.push({
      time: wakeTime,
      window: 'wake',
      kind: 'morning',
      kindColor: 'var(--text-secondary)',
      relatedTo: 'T-100min gym előtt',
      items: wakeItems,
      reasoning:
        'Ébredés után közvetlenül · a kreatin gyors-felszívású vízben, kávé az alvás-ébresztés átmenetre. Mindkettő független az ételtől.',
      primary: false,
    })
  }

  // Pre-workout snack window
  // NOTE (adaptation vs prototype): the prototype pushes this slot
  // unconditionally; here it is gated on whey being in the selection so the
  // emitted item carries a real stash refId (and an empty selection still
  // yields zero slots — the Task 18 empty-selection contract holds).
  const whey = find('whey', 'protein')
  if (whey) {
    slots.push({
      time: preFuelTime,
      window: 'pre-snack',
      kind: 'pre-fuel',
      kindColor: 'var(--info)',
      relatedTo: 'T-70min gym',
      items: [{ refId: whey.id, name: 'Whey 20g + banán', dose: '180kcal · 21P', color: 'var(--coral)' }],
      reasoning:
        'Gyors-szénhidrát + komplett protein · Reta D3 reggel még magas étvágy mellett ez könnyen lemegy. Glikogén pre-loading a Pull Day-re.',
      primary: false,
    })
  }

  // Pre-workout stack
  const aakg = find('aakg')
  const beta = find('beta-alanin', 'betaalanin', 'béta-alanin')
  if (aakg || beta) {
    const preItems: ProtocolSlotItem[] = []
    if (aakg) preItems.push({ refId: aakg.id, name: 'AAKG · L-Arginine', dose: aakg.dose, color: 'var(--warning)' })
    if (beta) preItems.push({ refId: beta.id, name: 'Beta-Alanin', dose: beta.dose, color: 'var(--warning)' })
    slots.push({
      time: preWorkoutTime,
      window: 'T-40min',
      kind: 'pre-workout',
      kindColor: 'var(--warning)',
      relatedTo: 'Pull Day pump-stack',
      items: preItems,
      reasoning:
        'Non-caf pump-stack 30-40 perccel a gym előtt · Pull Day-en a Chest Row PR-attempt-en az AAKG vasoldilation-je észrevehető. Béta-alanin a rep-out volumenre.',
      primary: true,
    })
    reasoning.push({
      kind: 'physiology',
      text: 'AAKG plazma-csúcs 30-45 perc · ezért 06:50-kor a 07:30 gymre.',
      evidence: 'Pharmacokinetics · arginine peak window',
    })
  }

  // Midday: D3 + K2 with lunch
  const d3 = find('d3')
  if (d3) {
    slots.push({
      time: middayTime,
      window: 'ebéd',
      kind: 'fat-bound',
      kindColor: 'var(--info)',
      relatedTo: 'ebéd zsírral',
      items: [{ refId: d3.id, name: 'D3 + K2', dose: d3.dose, color: 'var(--info)' }],
      reasoning:
        'Zsírban oldódó vitaminok · ebéddel (olívaolaj + csirke fat) a felszívódás akár 3-4× jobb mint éhgyomorra. K2 megakadályozza hogy a Ca rossz helyre menjen.',
      primary: false,
    })
    reasoning.push({
      kind: 'interaction',
      text: 'D3 + K2 + Mg trió együtt hatékonyabb mint külön · Mg viszont esti slot-ba szorul, mert szedáló hatású.',
      evidence: 'Klinikai · vitamin-mineral co-absorption',
    })
  }

  // Coffee cutoff reminder
  reasoning.push({
    kind: 'timing',
    text: 'Koffein cutoff 14:00 · ezután már semmilyen koffein, mert P3 pattern alapján az alvás-onset +24 percet csúszik.',
    evidence: 'Pattern P3 · késő-koffein × alvás · conf 0.69',
  })

  // Evening: Mg + Omega-3
  const mg = find('magn')
  const omega = find('omega')
  if (mg || omega) {
    const eveningItems: ProtocolSlotItem[] = []
    if (mg) eveningItems.push({ refId: mg.id, name: 'Magnézium-glicinát', dose: mg.dose, color: 'var(--cat-preference)' })
    if (omega) eveningItems.push({ refId: omega.id, name: 'Omega-3 (vacsorához)', dose: omega.dose, color: 'var(--cat-physiology)' })
    slots.push({
      time: eveningTime,
      window: 'T-2h sleep',
      kind: 'evening',
      kindColor: 'var(--cat-preference)',
      relatedTo: 'esti recovery',
      items: eveningItems,
      reasoning:
        'Pattern P2 megerősítve · 21:00 magnézium → első deep sleep ciklus tisztább. Omega-3 vacsorához a felszívódás miatt. T-2h előtt kell hogy meglegyen.',
      primary: true,
    })
    reasoning.push({
      kind: 'sleep',
      text: 'Mg-glicinát forma kifejezetten lefekvés előtt · oxide-tól eltérően nem laxatív, hanem GABA-érzékenység modulátor.',
      evidence: 'Pattern P2 · Mg-stack × alvás · conf 0.84',
    })
  }

  // Reta-aware reasoning
  reasoning.push({
    kind: 'physiology',
    text: 'Reta D3-D5 a stable ablak · étvágy enyhén lefelé, ezért a protein-target 220g/nap eléréséhez whey-snack-eket időzítünk (06:20 + post-workout 09:15).',
    evidence: 'Reta kinetic D3 · stable phase',
  })

  // Match meal recipes by macros + slot
  const mealMatches = [
    { recipeId: 'rec-1', slot: '09:15 post-workout', reason: 'Slow-release C + casein · ideális post-gym reggeli' },
    { recipeId: 'rec-2', slot: '13:00 ebéd', reason: 'Zsír + zöld levél → D3+K2 felszívódás · whole-foods micro-density' },
    { recipeId: 'rec-3', slot: '19:00 vacsora', reason: 'Omega-3 a kapszula mellé · slow-release C · post-load glikogén' },
  ]

  return { slots, reasoning, mealMatches }
}
