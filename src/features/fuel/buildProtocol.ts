import type { BuiltProtocol, ProtocolSlotData, ProtocolSlotItem, Reasoning, SupplementStashItem } from '@/data/types'

// ============================================================
// Protocol builder · the "AI logic"
// Deterministic mock based on selected items + meso phase + Reta phase.
// Ported from fuel-stack.jsx:397-515. The prototype's `meso`/`Reta`
// context is hardcoded into the reasoning strings, so the only live
// input is the set of selected stash ids.
// ============================================================
export function buildProtocol(selectedIds: string[], stash: SupplementStashItem[]): BuiltProtocol {
  const items = stash.filter(i => selectedIds.includes(i.id))
  const byId = (id: string) => items.find(i => i.id === id)

  const slots: ProtocolSlotData[] = []
  const reasoning: Reasoning[] = []

  // Wake / morning caffeine + kreatin
  const morningCaff = byId('kohi') || byId('caffeine200')
  const kreatin = byId('kreatin')
  if (morningCaff || kreatin) {
    const wakeItems: ProtocolSlotItem[] = []
    if (morningCaff)
      wakeItems.push({
        name: morningCaff.id === 'kohi' ? 'Espresso · 1 shot' : 'Koffein 200mg',
        dose: morningCaff.dose,
        color: 'var(--warning)',
      })
    if (kreatin) wakeItems.push({ name: 'Kreatin', dose: '5g vízben', color: 'var(--brand-glow)' })
    slots.push({
      time: '05:50',
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
  // unconditionally; here it is gated on a non-empty selection so that an
  // empty selection yields zero slots (per Task 18 empty-selection contract).
  if (items.length > 0) {
    slots.push({
      time: '06:20',
      window: 'pre-snack',
      kind: 'pre-fuel',
      kindColor: 'var(--info)',
      relatedTo: 'T-70min gym',
      items: [{ name: 'Whey 20g + banán', dose: '180kcal · 21P', color: 'var(--brand-glow)' }],
      reasoning:
        'Gyors-szénhidrát + komplett protein · Reta D3 reggel még magas étvágy mellett ez könnyen lemegy. Glikogén pre-loading a Pull Day-re.',
      primary: false,
    })
  }

  // Pre-workout stack
  const aakg = byId('aakg')
  const beta = byId('betaalanin')
  if (aakg || beta) {
    const preItems: ProtocolSlotItem[] = []
    if (aakg) preItems.push({ name: 'AAKG · L-Arginine', dose: aakg.dose, color: 'var(--warning)' })
    if (beta) preItems.push({ name: 'Beta-Alanin', dose: beta.dose, color: 'var(--warning)' })
    slots.push({
      time: '06:50',
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
  const d3 = byId('d3k2')
  if (d3) {
    slots.push({
      time: '12:30',
      window: 'ebéd',
      kind: 'fat-bound',
      kindColor: 'var(--info)',
      relatedTo: 'ebéd zsírral',
      items: [{ name: 'D3 + K2', dose: d3.dose, color: 'var(--info)' }],
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
  const mg = byId('magnez')
  const omega = byId('omega3')
  if (mg || omega) {
    const eveningItems: ProtocolSlotItem[] = []
    if (mg) eveningItems.push({ name: 'Magnézium-glicinát', dose: mg.dose, color: 'var(--cat-preference)' })
    if (omega) eveningItems.push({ name: 'Omega-3 (vacsorához)', dose: omega.dose, color: 'var(--cat-physiology)' })
    slots.push({
      time: '21:00',
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
