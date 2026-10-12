// The shared Fuel label maps and sentence builders in English (Folyadék F5, mezo-n4wf5.5): every converted
// logic file reads `m().fuelLogika…` / `m().fuelKozos…` at CALL time, so the same function (and the same
// getter-backed exported map) answers in the language of the moment. The test setup pins `hu` before every test.
import { afterEach, describe, expect, it } from 'vitest'
import { setLang } from '@/shared/i18n'
import { MEAL_REASONS, mealSkipLabel } from '@/features/fuel/logic/mealSkips'
import { Az, az, durHu, hitLabel, windowReasonCopy, type ReasonCtx } from '@/features/fuel/logic/mealWindow'
import { placeWindows, type DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { buildWindowLane } from '@/features/fuel/logic/fuelSwimlane'
import { MEAL_ROLE_LABEL, buildKeretHero, heroEquationLines } from '@/features/fuel/logic/keretHero'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { mealQualityTruth } from '@/features/fuel/logic/mealQualityTruth'
import { ROLE_OPTIONS, roleLabel, roleRubricLabel } from '@/features/fuel/logic/recipeRole'
import { RECIPE_SLOT_FACE, recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
import { projectStackDay } from '@/features/fuel/logic/projectStackDay'
import { PRE_WORKOUT_STACK_LEAD_MIN } from '@/features/fuel/logic/buildProtocol'
import { STACK_ZONE_LABEL } from '@/data/fuel/stackZones'
import { ZONE_LABELS } from '@/data/fuel/fuelConfig'
import {
  CONFIDENCE_WORD, DAY_STATUS, SAVED_ONLY, dec, huShortDate, huWeekRange, huWeekdayDate, markChangeLine, markToastLine,
} from '@/features/fuel/sheets/learnedBaseFormat'
import type { FuelSlot, MealBreakdown, ProtocolOccurrence, SupplementStashItem } from '@/data/types'

const en = () => setLang('en', { persist: false })
const hu = () => setLang('hu', { persist: false })

afterEach(hu)

const CTX: ReasonCtx = { wake: '06:30', bed: '23:00', trainingStart: '17:00', trainingEnd: '18:00' }
const BUDGET: DayBudget = { kcal: 2400, p: 160, c: 260, f: 80, energy: { base: 2000, planned: 400, extra: 0, balance: 0, target: 2400 } }

describe('the shared Fuel logic speaks English', () => {
  it('mealSkips: the reason chips and the reason line', () => {
    en()
    expect(MEAL_REASONS.map(r => r.label)).toEqual(['Not hungry', 'No time', 'Stomach bug', 'I’m ill', 'Travelling', 'Other'])
    expect(mealSkipLabel({ reasonCategory: 'NONE' })).toBe('no reason given')
    expect(mealSkipLabel({ reasonCategory: 'OTHER', reasonText: 'Work' })).toBe('“Work”')
    expect(mealSkipLabel({ reasonCategory: 'OTHER', reasonText: ' ' })).toBe('Other')
    expect(mealSkipLabel({ reasonCategory: 'STOMACH' })).toBe('Stomach bug')
  })

  it('mealWindow: durations, the hit word and the reasons', () => {
    en()
    expect(durHu(125)).toBe('2 h 5 min')
    expect(durHu(120)).toBe('2 h')
    expect(durHu(20)).toBe('20 min')
    expect(hitLabel({ kind: 'in' })).toBe('In the window')
    expect(hitLabel({ kind: 'near', offsetMin: 20 })).toBe('+20 min later')
    expect(hitLabel({ kind: 'far', offsetMin: -80 })).toBe('−1 h 20 min earlier')
    expect(windowReasonCopy('after-wake', CTX).title).toBe('Soon after waking (06:30)')
    expect(windowReasonCopy('pre-training-main', CTX).title).toBe('A few hours before training (17:00)')
    expect(windowReasonCopy('pre-training-snack', { ...CTX, trainingStart: null }).title).toBe('45–90 minutes before training')
    expect(windowReasonCopy('post-training', CTX).title).toBe('Half an hour to an hour and a half after training (18:00)')
    expect(windowReasonCopy('before-bed', CTX).title).toBe('At least 2.5 hours before bed (23:00)')
    expect(windowReasonCopy('bridge', CTX).body).toBe('It bridges the longer gap, so you do not arrive at the next meal starving.')
    expect(windowReasonCopy('shifted', { ...CTX, shiftedAfter: { label: 'Lunch', at: '13:40' } }).title).toBe('Moved: lunch was later (13:40)')
    expect(windowReasonCopy('shifted', CTX).title).toBe('Moved after the previous window')
    // the Hungarian article helper returns the bare label in English
    expect(az('lunch')).toBe('lunch')
    expect(Az('lunch')).toBe('Lunch')
  })

  it('buildDayPlan: the planned windows carry English names', () => {
    en()
    const labels = placeWindows('07:00', '23:00', 6, []).map(w => w.label)
    expect(labels).toEqual(expect.arrayContaining(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Morning snack', 'Evening snack']))
    expect(labels).toHaveLength(6)
  })

  it('fuelSwimlane + keretHero + mealShare: macro names, ring numbers, role words, the equation', () => {
    en()
    const slot: FuelSlot = { time: '07:30', kind: 'meal', label: 'Breakfast', slotKey: 'breakfast', state: 'pending', kcal: 400, p: 30, c: 40, f: 10 }
    expect(buildWindowLane({ slots: [slot], budget: BUDGET, meals: [] }).tiles[0].rings.map(r => r.label)).toEqual(['Protein', 'Carbs', 'Fat'])

    const vm = buildKeretHero({
      budget: BUDGET, staticEnergy: false, consumed: { kcal: 420, p: 32, c: 50, f: 10 }, meals: [],
      water: { currentMl: 1850, targetMl: 2400 }, slots: [], nowHHmm: '12:00', fiberTargetG: 30,
    })
    expect(vm.rings.map(r => r.label)).toEqual(['Protein', 'Carbs', 'Fat', 'Water', 'Fibre'])
    // English decimal point (Hungarian: „1,9 l")
    expect(vm.rings.find(r => r.key === 'water')!.value).toBe('1.9 l')
    expect(heroEquationLines(vm, 'cut').map(l => l.label)).toEqual(['Base', 'Movement', 'Your goal', 'Food', 'Left'])
    expect(MEAL_ROLE_LABEL.pre).toBe('BEFORE TRAINING')
    expect(mealMacroShare({ p: 30, c: 40, f: 10 }).map(r => r.label)).toEqual(['Protein', 'Carbs', 'Fat'])
  })

  it('glycemicBand: the band word, the tip, the expectations, the swaps and the facts', () => {
    en()
    const high = glycemicBand({ c: 90, sugarG: 50, fiberG: 1, p: 5, f: 2 })!
    expect(high.label).toBe('high')
    expect(high.tip.title).toBe('Dress the carbs')
    expect(high.expect.energy).toBe('A quick boost, then a dip')
    expect(high.improve!.steps.map(s => s.title)).toContain('Half the sweet part')
    expect(high.facts.map(f => f.label)).toEqual(['carbs', 'of which sugar', 'fibre', 'protein'])
    const low = glycemicBand({ c: 20, sugarG: null, fiberG: 8, p: 30, f: 10 })!
    expect(low.label).toBe('low')
    expect(low.tip).toEqual({ title: 'A good balance', body: 'Protein and fibre release the sugar slowly: this plate evens itself out.' })
    expect(low.facts[1].value).toBe('estimated')
  })

  it('mealQualityTruth: reads the density row whichever language the server scored the meal in', () => {
    const breakdown = (label: string) => ({
      dimensions: [{ id: 'energy_density', context: [{ label, value: '183 kcal/100g' }] }],
    }) as unknown as MealBreakdown
    for (const lang of [hu, en]) {
      lang()
      expect(mealQualityTruth(breakdown('Sűrűség')).densityKcalPer100g).toBe(183)
      expect(mealQualityTruth(breakdown('Density')).densityKcalPer100g).toBe(183)
    }
  })

  it('recipeRole + recipeSlotFace: roles, rubric words, block names', () => {
    en()
    expect(ROLE_OPTIONS.map(o => o.label)).toEqual(['General', 'Before training', 'After training'])
    expect(roleLabel('pre_workout')).toBe('Before training')
    expect(roleRubricLabel('post_workout')).toBe('after training')
    expect(recipeSlotFace('snack').label).toBe('Snack')
    expect(RECIPE_SLOT_FACE.dinner.label).toBe('Dinner')
    expect(recipeSlotFace(null).label).toBe('Meal')
  })

  it('buildEnergyBreakdown: the two summands of the movement', () => {
    en()
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, planned: 900, extra: 120, balance: 0, target: 3292 },
      blocks: [], weightKg: 86, tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' }, segment: null, activityLabel: '', goalLabel: '',
    })!
    expect(bd.movement.parts!.map(p => p.label)).toEqual(['Planned workout · logged', 'Unplanned movement'])
  })

  it('projectStackDay + the zone and day-part maps', () => {
    en()
    const occ = (id: string, slotKey: ProtocolOccurrence['slotKey'], pantryItemId: string): ProtocolOccurrence => ({
      id, pantryItemId, slotKey, dose: null, pinned: false, placementSource: 'rule', placementReason: null, restDayFallback: null, dailyTotalHint: null,
    } as ProtocolOccurrence)
    const stash = [{ id: 'kreatin', name: 'Kreatin', dose: '5g' } as SupplementStashItem]
    const slots = projectStackDay({
      occurrences: [occ('o1', 'breakfast', 'kreatin'), occ('o2', 'pre_workout', 'gone'), occ('o3', 'bedtime', 'kreatin')],
      stash, intakes: [], wake: '07:00', bed: '23:00', mealsPerDay: 4,
      blocks: [{ kind: 'gym', time: '17:00', durationMin: 60, label: 'Pull A' }],
    })
    expect(slots.map(s => [s.label, s.anchorNote])).toEqual([
      ['Breakfast', 'with a meal'],
      ['Pre-workout', `training −${PRE_WORKOUT_STACK_LEAD_MIN} min`],
      ['Bedtime', 'bed −30 min'],
    ])
    // the stored supplement name is never translated; a deleted item gets the catalog's placeholder
    expect(slots[0].entries[0].name).toBe('Kreatin')
    expect(slots[1].entries[0].name).toBe('(deleted pantry item)')
    expect(STACK_ZONE_LABEL.post_workout).toBe('Post-workout')
    expect(Object.values(ZONE_LABELS)).toEqual(['Morning', 'Midday', 'Afternoon', 'Evening'])
  })

  it('learnedBaseFormat: words, dates and numbers', () => {
    en()
    expect(CONFIDENCE_WORD.medium).toBe('Fairly sure')
    expect(Object.keys(CONFIDENCE_WORD)).toEqual(['low', 'medium', 'high'])
    expect(DAY_STATUS.suspicious).toEqual(['looked incomplete', 'sus'])
    expect(SAVED_ONLY.empty).toBe('Saved. I will count it in as soon as I have enough data.')
    expect(markChangeLine({ appliedBaseBeforeKcal: 2400, appliedBaseAfterKcal: 2420 })).toBe('The budget changed by +20 kcal')
    expect(markChangeLine({ appliedBaseBeforeKcal: 2400, appliedBaseAfterKcal: 2360 })).toBe('The budget changed by −40 kcal')
    expect(markChangeLine({ appliedBaseBeforeKcal: 2400, appliedBaseAfterKcal: 2400 })).toBe('The budget did not change')
    expect(markToastLine('off', { appliedBaseBeforeKcal: 1, appliedBaseAfterKcal: 2 })).toBe(SAVED_ONLY.off)
    expect(huShortDate('2026-09-14')).toBe('14 Sep')
    expect(huWeekRange('2026-09-21', '2026-09-27')).toBe('21–27 Sep')
    expect(huWeekRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct')
    expect(huWeekdayDate('2026-09-23')).toBe('Wed, 23 Sep')
    expect(dec(0.5, 2)).toBe('0.50')
  })
})

describe('a runtime switch: hu → en → hu on the same function and the same exported map', () => {
  it('follows the language of the moment, with nothing cached', () => {
    const read = () => ({
      skip: mealSkipLabel({ reasonCategory: 'NOT_HUNGRY' }),
      chip: MEAL_REASONS[0].label,
      hit: hitLabel({ kind: 'near', offsetMin: 95 }),
      window: placeWindows('07:00', '23:00', 3, [])[0].label,
      band: glycemicBand({ c: 20, sugarG: 2, fiberG: 8, p: 30, f: 10 })!.label,
      role: ROLE_OPTIONS[1].label,
      face: RECIPE_SLOT_FACE.breakfast.label,
      zone: STACK_ZONE_LABEL.wake,
      part: ZONE_LABELS.midday,
      status: DAY_STATUS.usable[0],
      sure: CONFIDENCE_WORD.high,
      week: huWeekRange('2026-09-28', '2026-10-04'),
      day: huWeekdayDate('2026-09-23'),
      num: dec(1.5, 1),
    })
    const HU = {
      skip: 'Nem vagyok éhes', chip: 'Nem vagyok éhes', hit: '+1 ó 35 p később', window: 'Reggeli', band: 'alacsony',
      role: 'Edzés előtt', face: 'Reggeli', zone: 'Ébredés', part: 'Dél', status: 'számít', sure: 'Biztos',
      week: 'szept. 28–okt. 4.', day: 'Sze, szept. 23.', num: '1,5',
    }
    const EN = {
      skip: 'Not hungry', chip: 'Not hungry', hit: '+1 h 35 min later', window: 'Breakfast', band: 'low',
      role: 'Before training', face: 'Breakfast', zone: 'Wake-up', part: 'Midday', status: 'counts', sure: 'Sure',
      week: '28 Sep – 4 Oct', day: 'Wed, 23 Sep', num: '1.5',
    }
    expect(read()).toEqual(HU)
    en()
    expect(read()).toEqual(EN)
    hu()
    expect(read()).toEqual(HU)
  })
})
