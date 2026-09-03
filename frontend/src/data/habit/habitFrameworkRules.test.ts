import { describe, expect, test } from 'vitest'
import { clearForeignFields, validateFramework, type FrameworkDraft } from '@/data/habit/habitFrameworkRules'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** Egy minimális draft — minden keret-mező üres, a teszt csak azt tölti ki, ami számít. */
function draft(patch: Partial<FrameworkDraft> = {}): FrameworkDraft {
  return {
    habitKey: 'custom_self', framework: null, anchorHabitKey: null, anchorCopy: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null, ...patch,
  }
}

/** Kétsoros katalógus: egy élő és egy inaktív horgony-jelölt. */
const catalog: HabitCatalog = {
  chains: [{
    id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
    defs: [
      { habitKey: 'morning_sunlight', isActive: true } as HabitDefInfo,
      { habitKey: 'retired_row', isActive: false } as HabitDefInfo,
    ],
  }],
}

describe('clearForeignFields — a HabitFrameworkValidator.clearForeignFields tükre', () => {
  test('FOGG-ra váltva a CLEAR-mezők nullázódnak, a FOGG-mezők maradnak', () => {
    const out = clearForeignFields(draft({
      framework: 'FOGG', anchorCopy: 'letettem a fogkefét', celebration: 'ökölrázás',
      cue: 'régi jelzés', craving: 'régi vágy', reward: 'régi jutalom', identity: 'régi identitás',
    }))
    expect([out.cue, out.craving, out.reward, out.identity]).toEqual([null, null, null, null])
    expect(out.anchorCopy).toBe('letettem a fogkefét')
    expect(out.celebration).toBe('ökölrázás')
  })

  test('CLEAR-re váltva a FOGG-mezők nullázódnak — az anchorCopy IS', () => {
    // A backend kommentje szerint az anchorCopy azért megy, mert a Nap felületen ki VAN rajzolva
    // (.nr-anchor), tehát egy megtartott „miután …" hamis jelzést hagyna egy Clear recept alatt.
    const out = clearForeignFields(draft({
      framework: 'CLEAR', anchorHabitKey: 'morning_sunlight', anchorCopy: 'fogmosás után',
      celebration: 'ökölrázás', cue: 'jelzés', craving: 'vágy', reward: 'jutalom', identity: 'identitás',
    }))
    expect([out.anchorHabitKey, out.anchorCopy, out.celebration]).toEqual([null, null, null])
    expect([out.cue, out.craving, out.reward, out.identity])
      .toEqual(['jelzés', 'vágy', 'jutalom', 'identitás'])
  })

  test('keret nélkül semmit nem tisztít — a validáció dolga eldönteni, hogy ez árva-e', () => {
    const input = draft({ anchorCopy: 'ébredés után', celebration: 'ökölrázás' })
    expect(clearForeignFields(input)).toEqual(input)
  })
})

describe('validateFramework — keret nélkül', () => {
  test('árva keret-mező 400: HABIT_FRAMEWORK_FIELDS_ORPHAN', () => {
    expect(() => validateFramework(draft({ celebration: 'ökölrázás' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FIELDS_ORPHAN')
  })

  test('a puszta anchorCopy NEM árva — a backend hasAny listája szándékosan kihagyja', () => {
    // HabitFrameworkValidator.java:31-34: anchorHabitKey/cue/craving/reward/celebration/identity,
    // anchorCopy nélkül. A teljes valós seed pontosan ilyen (keret nélkül, anchorCopy-val).
    expect(() => validateFramework(draft({ anchorCopy: 'ébredés után' }), catalog)).not.toThrow()
  })

  test('a csak-whitespace mező nincs kitöltve (isBlank-tükör)', () => {
    expect(() => validateFramework(draft({ celebration: '   ' }), catalog)).not.toThrow()
  })
})

describe('validateFramework — FOGG', () => {
  test('horgony nélkül 400: HABIT_FRAMEWORK_FOGG_INCOMPLETE', () => {
    expect(() => validateFramework(draft({ framework: 'FOGG', celebration: 'ökölrázás' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
  })

  test('ünneplés nélkül 400: HABIT_FRAMEWORK_FOGG_INCOMPLETE', () => {
    expect(() => validateFramework(draft({ framework: 'FOGG', anchorCopy: 'fogmosás után' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
  })

  test('szabad szöveges horgony + ünneplés átmegy', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorCopy: 'fogmosás után', celebration: 'ökölrázás' }), catalog,
    )).not.toThrow()
  })

  test('élő testvér-defre mutató horgony átmegy', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'morning_sunlight', celebration: 'ökölrázás' }), catalog,
    )).not.toThrow()
  })

  test('ismeretlen horgony-kulcs 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'custom_nemletezik', celebration: 'ökölrázás' }), catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })

  test('önmagára mutató horgony 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ habitKey: 'custom_self', framework: 'FOGG', anchorHabitKey: 'custom_self', celebration: 'ökölrázás' }),
      catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })

  test('inaktív defre mutató horgony 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'retired_row', celebration: 'ökölrázás' }), catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })
})

describe('validateFramework — CLEAR', () => {
  test('hiányzó craving 400: HABIT_FRAMEWORK_CLEAR_INCOMPLETE', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', cue: '7:10-kor a konyhában', reward: 'a pipa maga' }), catalog,
    )).toThrow('HABIT_FRAMEWORK_CLEAR_INCOMPLETE')
  })

  test('cue + craving + reward átmegy, identity nélkül is', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', cue: 'jelzés', craving: 'vágy', reward: 'jutalom' }), catalog,
    )).not.toThrow()
  })

  test('CLEAR-nél a horgony-hivatkozást nem is nézzük — a clearForeignFields már levette', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', anchorHabitKey: 'custom_nemletezik', cue: 'j', craving: 'v', reward: 'r' }),
      catalog,
    )).not.toThrow()
  })
})
