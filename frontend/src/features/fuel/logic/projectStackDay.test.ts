// projectStackDay — pure day-projection for the Fuel/Stack timeline (mezo-vx9v). Replaces
// buildProtocol's slot derivation with zone→time anchoring off the day's real wake/bed/training
// blocks, rest-day zone regrouping (skip / displace, persistedZone preserved), and per-occurrence
// taken-state resolution (incl. the legacy null-slotKey intake fallback). Pure, no React.

import { isStimFreeName, projectStackDay, resolveTakenKeys } from '@/features/fuel/logic/projectStackDay'
import { PRE_WORKOUT_STACK_LEAD_MIN } from '@/features/fuel/logic/buildProtocol'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { Intake } from '@/data/fuel/fuelApi'
import type { ProtocolOccurrence, StackZoneKey, SupplementStashItem } from '@/data/types'

// ── fixture factories ────────────────────────────────────────────────────────
const stashLite = (id: string, name: string, dose = '5g'): SupplementStashItem => ({
  id,
  name,
  brand: 'Test',
  type: 'supplement',
  category: 'test',
  dose,
  form: 'kapszula',
  stock: 10,
  stockUnit: 'db',
  protocol: 'test',
  timing: 'flexible',
  taken: false,
  macros: { kcal: null, p: null, c: null, f: null },
})

const occ = (over: Partial<ProtocolOccurrence>): ProtocolOccurrence => ({
  id: 'o1',
  pantryItemId: 'kreatin',
  slotKey: 'wake',
  dose: null,
  pinned: false,
  placementSource: 'rule',
  placementReason: null,
  restDayFallback: null,
  dailyTotalHint: null,
  ...over,
})

const intake = (over: Partial<Intake> & { pantryItemId: string }): Intake => ({
  id: 'i1',
  takenAt: '2026-08-03T07:00:00',
  dose: null,
  slotKey: null,
  ...over,
})

// ── 1. training day: zone→time anchoring ────────────────────────────────────
describe('training day zone times', () => {
  const blocks: PlannerBlock[] = [{ kind: 'gym', time: '17:30', durationMin: 60, label: 'Gym' }]
  const stash = [stashLite('kreatin', 'Kreatin')]
  const occurrences: ProtocolOccurrence[] = STACK_ZONE_ORDER.map(zone => occ({ id: `o-${zone}`, slotKey: zone }))

  const result = projectStackDay({
    occurrences,
    stash,
    intakes: [],
    wake: '05:50',
    bed: '23:00',
    mealsPerDay: 4,
    blocks,
  })

  test('every zone renders, in STACK_ZONE_ORDER, at its anchored time', () => {
    expect(result.map(s => s.zone)).toEqual(STACK_ZONE_ORDER)
    const timeByZone = Object.fromEntries(result.map(s => [s.zone, s.time])) as Record<StackZoneKey, string>
    expect(timeByZone).toEqual({
      wake: '05:50', // straight from the anchor
      breakfast: '06:35', // placeWindows(wake, bed, 4, blocks) breakfast window, rounded
      pre_workout: toHHmm(toMin('17:30') - PRE_WORKOUT_STACK_LEAD_MIN), // block − 40min = '16:50'
      post_workout: toHHmm(toMin('17:30') + 60 + 30), // block end (durationMin 60) + 30min = '19:00'
      lunch: '16:15', // placeWindows' lunch window snapped by the training envelope, rounded
      dinner: '19:16', // placeWindows' dinner window pushed by the min-gap rule, rounded
      evening: toHHmm(toMin('23:00') - 120), // bed − 2h = '21:00'
      bedtime: toHHmm(toMin('23:00') - 30), // bed − 30min = '22:30'
    })
  })

  test('anchorNote + label are set per zone', () => {
    const noteByZone = Object.fromEntries(result.map(s => [s.zone, s.anchorNote])) as Record<StackZoneKey, string | null>
    expect(noteByZone).toEqual({
      wake: null,
      breakfast: 'étkezéshez kötve',
      pre_workout: `edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`,
      post_workout: 'edzés +30p',
      lunch: 'étkezéshez kötve',
      dinner: 'étkezéshez kötve',
      evening: 'lefekvés −2h',
      bedtime: 'lefekvés −30p',
    })
    for (const s of result) expect(s.label).toBe(STACK_ZONE_LABEL[s.zone])
  })

  test('entry fields propagate 1:1 from the occurrence', () => {
    const o = occ({
      id: 'o-custom',
      pantryItemId: 'kreatin',
      slotKey: 'wake',
      dose: '3g',
      pinned: true,
      placementSource: 'user',
      placementReason: 'user moved it',
      dailyTotalHint: '15-20g/nap',
    })
    const r = projectStackDay({ occurrences: [o], stash, intakes: [], wake: '05:50', bed: '23:00', mealsPerDay: 4, blocks: [] })
    const entry = r.find(s => s.zone === 'wake')?.entries[0]
    expect(entry).toMatchObject({
      occurrenceId: 'o-custom',
      pantryItemId: 'kreatin',
      persistedZone: 'wake',
      name: 'Kreatin',
      dose: '3g',
      pinned: true,
      placementSource: 'user',
      reason: 'user moved it',
      dailyTotalHint: '15-20g/nap',
      skippedToday: false,
      displacedToday: false,
      taken: false,
    })
  })
})

// ── 2. zone ordering + empty-zone dropping ───────────────────────────────────
describe('zone ordering + empty zones', () => {
  const stash = [stashLite('kreatin', 'Kreatin'), stashLite('magnez', 'Magnézium')]
  // Deliberately out of STACK_ZONE_ORDER in the source array.
  const occurrences: ProtocolOccurrence[] = [
    occ({ id: 'o-bedtime', pantryItemId: 'magnez', slotKey: 'bedtime' }),
    occ({ id: 'o-wake', pantryItemId: 'kreatin', slotKey: 'wake' }),
    occ({ id: 'o-evening', pantryItemId: 'magnez', slotKey: 'evening' }),
  ]
  const result = projectStackDay({
    occurrences,
    stash,
    intakes: [],
    wake: '07:00',
    bed: '23:00',
    mealsPerDay: 3,
    blocks: [], // rest day: pre_workout/post_workout zoneTime is null too
  })

  test('only zones that have an occurrence render, sorted by STACK_ZONE_ORDER (not array order)', () => {
    expect(result.map(s => s.zone)).toEqual(['wake', 'evening', 'bedtime'])
  })

  test('zones with a resolvable time but no occurrence are dropped (breakfast/lunch/dinner)', () => {
    expect(result.find(s => s.zone === 'breakfast')).toBeUndefined()
    expect(result.find(s => s.zone === 'lunch')).toBeUndefined()
    expect(result.find(s => s.zone === 'dinner')).toBeUndefined()
  })

  test('zones with no occurrence AND no resolvable time are dropped (pre_workout/post_workout, no blocks)', () => {
    expect(result.find(s => s.zone === 'pre_workout')).toBeUndefined()
    expect(result.find(s => s.zone === 'post_workout')).toBeUndefined()
  })

  test('each rendered slot carries exactly its own zone entries', () => {
    expect(result.find(s => s.zone === 'wake')?.entries.map(e => e.pantryItemId)).toEqual(['kreatin'])
    expect(result.find(s => s.zone === 'evening')?.entries.map(e => e.pantryItemId)).toEqual(['magnez'])
    expect(result.find(s => s.zone === 'bedtime')?.entries.map(e => e.pantryItemId)).toEqual(['magnez'])
  })
})

// ── 3. rest day: skip / displace / persistedZone semantics ──────────────────
describe('rest day regrouping (no training blocks today)', () => {
  const stash = [
    stashLite('origin-pwo', 'Origin PWO'),
    stashLite('whey', 'Impact Whey Protein'),
    stashLite('aakg', 'AAKG'),
    stashLite('betaalanin', 'Beta-Alanin'),
    stashLite('kreatin', 'Kreatin'),
  ]
  const occurrences: ProtocolOccurrence[] = [
    // explicit 'skip' fallback → lands in the pre_workout default zone (breakfast), skippedToday.
    occ({ id: 'o-skip', pantryItemId: 'origin-pwo', slotKey: 'pre_workout', restDayFallback: 'skip' }),
    // explicit displace fallback → lands in its named zone, displacedToday.
    occ({ id: 'o-whey', pantryItemId: 'whey', slotKey: 'post_workout', restDayFallback: 'breakfast' }),
    // null fallback on a pinned pre_workout occurrence → defaults to breakfast, displaced (not skipped).
    occ({ id: 'o-pin', pantryItemId: 'aakg', slotKey: 'pre_workout', restDayFallback: null, pinned: true }),
    // null fallback on a post_workout occurrence → defaults to lunch, displaced.
    occ({ id: 'o-post-default', pantryItemId: 'betaalanin', slotKey: 'post_workout', restDayFallback: null }),
    // non-training zone → entirely unaffected by rest-day regrouping.
    occ({ id: 'o-wake', pantryItemId: 'kreatin', slotKey: 'wake' }),
  ]
  const result = projectStackDay({
    occurrences,
    stash,
    intakes: [],
    wake: '07:00',
    bed: '23:00',
    mealsPerDay: 3,
    blocks: [],
  })

  test('explicit skip fallback: lands in breakfast, skippedToday, persistedZone kept', () => {
    const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'origin-pwo')
    expect(entry).toMatchObject({ skippedToday: true, displacedToday: false, persistedZone: 'pre_workout' })
  })

  test('explicit displace fallback: lands in its fallback zone, displacedToday, persistedZone kept', () => {
    const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'whey')
    expect(entry).toMatchObject({ skippedToday: false, displacedToday: true, persistedZone: 'post_workout' })
  })

  test('null fallback on a pinned pre_workout occurrence defaults to breakfast (displaced, not skipped)', () => {
    const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'aakg')
    expect(entry).toMatchObject({ skippedToday: false, displacedToday: true, persistedZone: 'pre_workout', pinned: true })
  })

  test('null fallback on a post_workout occurrence defaults to lunch (displaced)', () => {
    const entry = result.find(s => s.zone === 'lunch')?.entries.find(e => e.pantryItemId === 'betaalanin')
    expect(entry).toMatchObject({ skippedToday: false, displacedToday: true, persistedZone: 'post_workout' })
  })

  test('a non-training occurrence is untouched by rest-day regrouping', () => {
    const entry = result.find(s => s.zone === 'wake')?.entries.find(e => e.pantryItemId === 'kreatin')
    expect(entry).toMatchObject({ skippedToday: false, displacedToday: false, persistedZone: 'wake' })
  })

  test('pre_workout and post_workout zones are absent — every occurrence there was regrouped away', () => {
    expect(result.find(s => s.zone === 'pre_workout')).toBeUndefined()
    expect(result.find(s => s.zone === 'post_workout')).toBeUndefined()
  })
})

// ── 3a. stim-aware pre-workout split (mezo-j6c9) ─────────────────────────────
describe('stim-aware pre-workout split on a multi-block day (mezo-j6c9)', () => {
  // Morning gym + evening volleyball — the day this feature exists for.
  const blocks: PlannerBlock[] = [
    { kind: 'gym', time: '07:30', durationMin: 60, label: 'Pull A' },
    { kind: 'sport', time: '18:30', durationMin: 90, label: 'Röplabda' },
  ]
  const stash = [
    stashLite('origin-pwo', 'Origin PWO'),
    stashLite('stimfree-pwo', 'Stim-Free Pre-Workout'),
    stashLite('kreatin', 'Kreatin'),
  ]
  const base = {
    stash,
    intakes: [] as Intake[],
    wake: '05:50',
    bed: '23:00',
    mealsPerDay: 4,
    blocks,
  }
  const bothPwo: ProtocolOccurrence[] = [
    occ({ id: 'o-pwo', pantryItemId: 'origin-pwo', slotKey: 'pre_workout', restDayFallback: 'skip' }),
    occ({ id: 'o-sf', pantryItemId: 'stimfree-pwo', slotKey: 'pre_workout', restDayFallback: 'skip' }),
    occ({ id: 'o-wake', pantryItemId: 'kreatin', slotKey: 'wake' }),
  ]

  test('both kinds present: two adjacent pre_workout slots — regular at first block −40, stim-free at last block −40', () => {
    const result = projectStackDay({ ...base, occurrences: bothPwo })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre).toHaveLength(2)
    expect(pre[0].time).toBe(toHHmm(toMin('07:30') - PRE_WORKOUT_STACK_LEAD_MIN)) // 06:50
    expect(pre[1].time).toBe(toHHmm(toMin('18:30') - PRE_WORKOUT_STACK_LEAD_MIN)) // 17:50
    expect(pre[0].entries.map(e => e.pantryItemId)).toEqual(['origin-pwo'])
    expect(pre[1].entries.map(e => e.pantryItemId)).toEqual(['stimfree-pwo'])
    // Adjacent in the emitted array — the split stays one visual group.
    const idx = result.findIndex(s => s.zone === 'pre_workout')
    expect(result[idx + 1].zone).toBe('pre_workout')
  })

  test('both slots keep the pre_workout zone key + label; anchorNote names each block', () => {
    const result = projectStackDay({ ...base, occurrences: bothPwo })
    const pre = result.filter(s => s.zone === 'pre_workout')
    for (const s of pre) expect(s.label).toBe(STACK_ZONE_LABEL.pre_workout)
    expect(pre[0].anchorNote).toBe(`Pull A · edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
    expect(pre[1].anchorNote).toBe(`Röplabda · edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
    for (const s of pre) for (const e of s.entries) expect(e.persistedZone).toBe('pre_workout')
  })

  test('only regular pwo: single slot at the first block, block named in the note, no phantom second slot', () => {
    const result = projectStackDay({
      ...base,
      occurrences: [occ({ id: 'o-pwo', pantryItemId: 'origin-pwo', slotKey: 'pre_workout' })],
    })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre).toHaveLength(1)
    expect(pre[0].time).toBe('06:50')
    expect(pre[0].anchorNote).toBe(`Pull A · edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
  })

  test('only stim-free pwo: single slot anchored to the LAST block', () => {
    const result = projectStackDay({
      ...base,
      occurrences: [occ({ id: 'o-sf', pantryItemId: 'stimfree-pwo', slotKey: 'pre_workout' })],
    })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre).toHaveLength(1)
    expect(pre[0].time).toBe('17:50')
    expect(pre[0].anchorNote).toBe(`Röplabda · edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
  })

  test('single-block day: no split — stim-free anchors to the one block with the plain note (pre-mezo-j6c9 behavior)', () => {
    const result = projectStackDay({
      ...base,
      blocks: [{ kind: 'gym', time: '17:30', durationMin: 60, label: 'Gym' }],
      occurrences: bothPwo,
    })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre).toHaveLength(1)
    expect(pre[0].time).toBe(toHHmm(toMin('17:30') - PRE_WORKOUT_STACK_LEAD_MIN))
    expect(pre[0].anchorNote).toBe(`edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
    expect(pre[0].entries.map(e => e.pantryItemId)).toEqual(['origin-pwo', 'stimfree-pwo'])
  })

  test('two blocks at the SAME time: no split (concurrent gym + sport is one training envelope)', () => {
    const result = projectStackDay({
      ...base,
      blocks: [
        { kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' },
        { kind: 'sport', time: '18:00', durationMin: 90, label: 'Röplabda' },
      ],
      occurrences: bothPwo,
    })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre).toHaveLength(1)
    expect(pre[0].anchorNote).toBe(`edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`)
  })

  test('taken resolves per zone key on the split slots too (intake slotKey pre_workout ticks the stim-free entry)', () => {
    const result = projectStackDay({
      ...base,
      occurrences: bothPwo,
      intakes: [intake({ pantryItemId: 'stimfree-pwo', slotKey: 'pre_workout' })],
    })
    const pre = result.filter(s => s.zone === 'pre_workout')
    expect(pre[0].entries[0].taken).toBe(false) // origin-pwo
    expect(pre[1].entries[0].taken).toBe(true) // stimfree-pwo
  })

  test('rest day: the stim-free occurrence regroups exactly like any pre_workout occurrence (skip fallback honored)', () => {
    const result = projectStackDay({ ...base, blocks: [], occurrences: bothPwo })
    expect(result.find(s => s.zone === 'pre_workout')).toBeUndefined()
    const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'stimfree-pwo')
    expect(entry).toMatchObject({ skippedToday: true, persistedZone: 'pre_workout' })
  })
})

describe('isStimFreeName', () => {
  test.each([
    'Stim-Free Pre-Workout',
    'STIM FREE PWO',
    'StimFree Pump',
    'Koffeinmentes pre-workout',
    'Koffein-mentes edzés előtti',
    'Caffeine Free PWO',
    'Caffeine-Free Booster',
    'Stimulánsmentes formula',
  ])('matches %s', name => expect(isStimFreeName(name)).toBe(true))

  test.each(['Origin PWO', 'Citrullin-malát', 'AAKG', 'Pump Booster', 'Kreatin'])(
    'does NOT match %s (naturally caffeine-free ≠ claimed stim-free)',
    name => expect(isStimFreeName(name)).toBe(false),
  )
})

// ── 3b. weightKg → peri-workout snack cascade (mezo-vx9v Task 8 review follow-up) ────────────────
describe('weightKg forwards to placeWindows and can cascade into a meal-zone time shift', () => {
  // sport block short enough (60min < PERI_SNACK_MIN_DURATION=90) that ONLY the weightKg-driven
  // kcal threshold (blockKcal = MET_BY_KIND.sport(4.5) * weightKg * 1h) can make it "significant"
  // enough to earn a peri-workout snack window. weightKg=0 → 0kcal, no snack; weightKg=90 →
  // 405kcal ≥ PERI_SNACK_MIN_KCAL(300) → snack inserted, and — because placeWindows' "pre-fuel"
  // training snap then prefers the closer-to-the-block snack window over breakfast — the
  // breakfast zone's OWN anchored time shifts as a side effect (it stops being re-snapped).
  const stash = [stashLite('kreatin', 'Kreatin')]
  const occurrences: ProtocolOccurrence[] = [occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'breakfast' })]
  const blocks: PlannerBlock[] = [{ kind: 'sport', time: '13:00', durationMin: 60, label: 'Sport' }]
  const base = { occurrences, stash, intakes: [] as Intake[], wake: '06:00', bed: '23:00', mealsPerDay: 3, blocks }

  test('weightKg 0 keeps breakfast snapped to the pre-fuel training slot; weightKg 90 frees it back to its own anchor', () => {
    const light = projectStackDay({ ...base, weightKg: 0 })
    const heavy = projectStackDay({ ...base, weightKg: 90 })
    const lightBreakfast = light.find(s => s.zone === 'breakfast')?.time
    const heavyBreakfast = heavy.find(s => s.zone === 'breakfast')?.time
    expect(lightBreakfast).toBe('11:45')
    expect(heavyBreakfast).toBe('06:45')
    expect(heavyBreakfast).not.toBe(lightBreakfast)
  })

  test('omitting weightKg behaves exactly like weightKg: 0 (defaults to 0, not undefined-crashes)', () => {
    const noWeight = projectStackDay(base)
    const explicitZero = projectStackDay({ ...base, weightKg: 0 })
    expect(noWeight.find(s => s.zone === 'breakfast')?.time).toBe(explicitZero.find(s => s.zone === 'breakfast')?.time)
  })
})

// ── 4. dose fallback ─────────────────────────────────────────────────────────
describe('dose fallback', () => {
  const stash = [stashLite('kreatin', 'Kreatin', '5g stash-dose')]

  test('occurrence dose null → falls back to the stash item dose', () => {
    const result = projectStackDay({
      occurrences: [occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake', dose: null })],
      stash,
      intakes: [],
      wake: '07:00',
      bed: '23:00',
      mealsPerDay: 3,
      blocks: [],
    })
    expect(result.find(s => s.zone === 'wake')?.entries[0].dose).toBe('5g stash-dose')
  })

  test('occurrence dose set → wins over the stash item dose', () => {
    const result = projectStackDay({
      occurrences: [occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake', dose: '10g override' })],
      stash,
      intakes: [],
      wake: '07:00',
      bed: '23:00',
      mealsPerDay: 3,
      blocks: [],
    })
    expect(result.find(s => s.zone === 'wake')?.entries[0].dose).toBe('10g override')
  })

  test('occurrence dose null + item missing from stash → dose null, name falls back to the placeholder', () => {
    const result = projectStackDay({
      occurrences: [occ({ id: 'o1', pantryItemId: 'ghost-item', slotKey: 'wake', dose: null })],
      stash,
      intakes: [],
      wake: '07:00',
      bed: '23:00',
      mealsPerDay: 3,
      blocks: [],
    })
    const entry = result.find(s => s.zone === 'wake')?.entries[0]
    expect(entry?.dose).toBeNull()
    expect(entry?.name).toBe('(törölt Kamra-item)')
  })
})

// ── 5. taken resolution ───────────────────────────────────────────────────────
describe('taken resolution', () => {
  describe('resolveTakenKeys (unit)', () => {
    test('an intake with an explicit slotKey ticks only that zone', () => {
      const occurrences = [
        occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake' }),
        occ({ id: 'o2', pantryItemId: 'kreatin', slotKey: 'lunch' }),
      ]
      const intakes: Intake[] = [intake({ pantryItemId: 'kreatin', slotKey: 'wake' })]
      expect(resolveTakenKeys(intakes, occurrences)).toEqual(new Set(['kreatin|wake']))
    })

    test('a legacy null-slotKey intake ticks the FIRST zone-ordered occurrence of that item', () => {
      const occurrences = [
        // deliberately out of zone order in the source array
        occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'lunch' }),
        occ({ id: 'o2', pantryItemId: 'kreatin', slotKey: 'wake' }),
      ]
      const intakes: Intake[] = [intake({ pantryItemId: 'kreatin', slotKey: null })]
      expect(resolveTakenKeys(intakes, occurrences)).toEqual(new Set(['kreatin|wake']))
    })

    test('a legacy intake skips a zone already claimed and assigns the next zone-ordered occurrence', () => {
      const occurrences = [
        occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake' }),
        occ({ id: 'o2', pantryItemId: 'kreatin', slotKey: 'lunch' }),
      ]
      const intakes: Intake[] = [
        intake({ id: 'i1', pantryItemId: 'kreatin', slotKey: 'wake' }),
        intake({ id: 'i2', pantryItemId: 'kreatin', slotKey: null }),
      ]
      expect(resolveTakenKeys(intakes, occurrences)).toEqual(new Set(['kreatin|wake', 'kreatin|lunch']))
    })

    test('a legacy intake for an item with no matching occurrence adds no key', () => {
      const occurrences = [occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake' })]
      const intakes: Intake[] = [intake({ pantryItemId: 'ghost', slotKey: null })]
      expect(resolveTakenKeys(intakes, occurrences)).toEqual(new Set())
    })

    test('a legacy intake for an item whose every occurrence is already claimed adds no key', () => {
      const occurrences = [occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake' })]
      const intakes: Intake[] = [
        intake({ id: 'i1', pantryItemId: 'kreatin', slotKey: 'wake' }),
        intake({ id: 'i2', pantryItemId: 'kreatin', slotKey: null }),
      ]
      expect(resolveTakenKeys(intakes, occurrences)).toEqual(new Set(['kreatin|wake']))
    })
  })

  describe('projectStackDay taken wiring (integration)', () => {
    const stash = [stashLite('kreatin', 'Kreatin')]

    test('an intake with an explicit slotKey ticks only the matching-zone occurrence of that item', () => {
      const occurrences = [
        occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake' }),
        occ({ id: 'o2', pantryItemId: 'kreatin', slotKey: 'lunch' }),
      ]
      const intakes: Intake[] = [intake({ pantryItemId: 'kreatin', slotKey: 'wake' })]
      const result = projectStackDay({ occurrences, stash, intakes, wake: '07:00', bed: '23:00', mealsPerDay: 3, blocks: [] })
      expect(result.find(s => s.zone === 'wake')?.entries[0].taken).toBe(true)
      expect(result.find(s => s.zone === 'lunch')?.entries[0].taken).toBe(false)
    })

    test('a legacy null-slotKey intake ticks the first zone-ordered occurrence end to end', () => {
      const occurrences = [
        occ({ id: 'o1', pantryItemId: 'kreatin', slotKey: 'lunch' }),
        occ({ id: 'o2', pantryItemId: 'kreatin', slotKey: 'wake' }),
      ]
      const intakes: Intake[] = [intake({ pantryItemId: 'kreatin', slotKey: null })]
      const result = projectStackDay({ occurrences, stash, intakes, wake: '07:00', bed: '23:00', mealsPerDay: 3, blocks: [] })
      expect(result.find(s => s.zone === 'wake')?.entries[0].taken).toBe(true)
      expect(result.find(s => s.zone === 'lunch')?.entries[0].taken).toBe(false)
    })

    test('a skipped rest-day occurrence is never taken, even when its persisted-zone key is in the intakes', () => {
      const pwoStash = [stashLite('origin-pwo', 'Origin PWO')]
      const occurrences = [occ({ id: 'o1', pantryItemId: 'origin-pwo', slotKey: 'pre_workout', restDayFallback: 'skip' })]
      const intakes: Intake[] = [intake({ pantryItemId: 'origin-pwo', slotKey: 'pre_workout' })]
      const result = projectStackDay({ occurrences, stash: pwoStash, intakes, wake: '07:00', bed: '23:00', mealsPerDay: 3, blocks: [] })
      const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'origin-pwo')
      expect(entry).toMatchObject({ skippedToday: true, taken: false })
    })

    test('a displaced (not skipped) rest-day occurrence still resolves taken via its persisted-zone key', () => {
      const wheyStash = [stashLite('whey', 'Impact Whey Protein')]
      const occurrences = [occ({ id: 'o1', pantryItemId: 'whey', slotKey: 'post_workout', restDayFallback: 'breakfast' })]
      const intakes: Intake[] = [intake({ pantryItemId: 'whey', slotKey: 'post_workout' })]
      const result = projectStackDay({ occurrences, stash: wheyStash, intakes, wake: '07:00', bed: '23:00', mealsPerDay: 3, blocks: [] })
      const entry = result.find(s => s.zone === 'breakfast')?.entries.find(e => e.pantryItemId === 'whey')
      expect(entry).toMatchObject({ displacedToday: true, taken: true })
    })
  })
})
