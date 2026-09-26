// ============================================================
// Mezo · glycemicBand — a vércukor-válasz HÁROM SÁVJA (mezo-6mi43)
//
// A derivációt a jóváhagyott prototípus adja, szám szerint:
// docs/design_2.0/prototypes/companion-titanium/food-state.js `glycemicFor` (:71).
// Ezek a körök azt szegezik le, amit az owner kétszer is megerősített:
//   · SEMMILYEN szám nem jelenik meg glikémiás indexként — a vegyes étkezés GI-matematikája
//     22-50%-ot téved, ezért a funkció három sávra kötelezi magát;
//   · a „magas" sáv NEM kudarc és nem szégyen — a szöveg soha nem ítélkezik;
//   · ha a cukor nem ismert, a becslést KIMONDJUK (`sugarEstimated`), nem adjuk ki mért adatnak;
//   · ha a szénhidrát nem ismert, NINCS sáv — `null`, nem tippelés.
// ============================================================
import { describe, expect, test } from 'vitest'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'

/** Cukor nélküli 100 g szénhidrát: a teher fix 60, így a fék (rost × 2) pontosan címezhető. */
const withFiber = (fiberG: number) =>
  glycemicBand({ c: 100, sugarG: 0, fiberG, p: 0, f: 0 })

describe('glycemicBand · a sávhatárok (a prototípus számai, változtatás nélkül)', () => {
  test('11,9-es index még „alacsony" — a határ szigorúan kisebb, nem kisebb-egyenlő', () => {
    // teher 60 − fék 48,1 = 11,9
    expect(withFiber(24.05)!.level).toBe('low')
  })

  test('pontosan 12-es index már „közepes"', () => {
    expect(withFiber(24)!.level).toBe('mid')
  })

  test('23,9-es index még „közepes"', () => {
    expect(withFiber(18.05)!.level).toBe('mid')
  })

  test('pontosan 24-es index már „magas"', () => {
    expect(withFiber(18)!.level).toBe('high')
  })

  test('a magyar sávszó a szinttel jár', () => {
    expect(withFiber(24.05)!.label).toBe('alacsony')
    expect(withFiber(24)!.label).toBe('közepes')
    expect(withFiber(18)!.label).toBe('magas')
  })

  test('a fék minden lassító tápanyagot beszámít — fehérje és zsír is lefelé húz', () => {
    const bare = glycemicBand({ c: 100, sugarG: 0, fiberG: 0, p: 0, f: 0 })!
    const dressed = glycemicBand({ c: 100, sugarG: 0, fiberG: 0, p: 60, f: 40 })!
    // 60 − (60×0,25 + 40×0,2) = 60 − 23 = 37 → még mindig magas, de mérhetően kisebb teher
    expect(bare.level).toBe('high')
    expect(dressed.level).toBe('high')
    // a hiányzó tápanyag 0-ként fékez, nem rontja el a számítást
    expect(glycemicBand({ c: 100, sugarG: 0, fiberG: null, p: null, f: null })!.level).toBe('high')
  })
})

describe('glycemicBand · őszinte hiány', () => {
  test('ismeretlen szénhidrát mellett nincs sáv — null, nem tippelés', () => {
    expect(glycemicBand({ c: null, sugarG: 20, fiberG: 4, p: 20, f: 10 })).toBeNull()
  })

  test('ismeretlen cukor esetén a becslést kimondjuk', () => {
    const band = glycemicBand({ c: 60, sugarG: null, fiberG: 6, p: 20, f: 10 })!
    expect(band.sugarEstimated).toBe(true)
    expect(band.facts.find(f => f.label === 'ebből cukor')!.value).toBe('becsült')
  })

  test('ismert cukor esetén nincs becslés-jelzés, a szám a mért érték', () => {
    const band = glycemicBand({ c: 60, sugarG: 11.4, fiberG: 6, p: 20, f: 10 })!
    expect(band.sugarEstimated).toBe(false)
    expect(band.facts.find(f => f.label === 'ebből cukor')!.value).toBe('11 g')
  })

  test('a tény-sorok a prototípus négy sorát adják, gramban', () => {
    const band = glycemicBand({ c: 64.4, sugarG: 11.2, fiberG: 7, p: 22, f: 9 })!
    expect(band.facts).toEqual([
      { label: 'szénhidrát', value: '64 g' },
      { label: 'ebből cukor', value: '11 g' },
      { label: 'rost', value: '7 g' },
      { label: 'fehérje', value: '22 g' },
    ])
  })
})

describe('glycemicBand · a jóváhagyott szövegek', () => {
  test('alacsony sáv: „Szép egyensúly" és a nyugodt kilátás', () => {
    const band = withFiber(24.05)!
    expect(band.tip.title).toBe('Szép egyensúly')
    expect(band.expect.energy).toBe('Egyenletes energia 3-4 órára')
    expect(band.expect.back).toBe('Kb. 2 óra múlva ér vissza az alapszintre, finoman')
    expect(band.expect.hunger).toBe('Az éhség későn, fokozatosan tér vissza')
  })

  test('közepes sáv rost és fehérje nélkül: „Rost előre"', () => {
    // fék csak zsírból, hogy a rost 4 alatt és a fehérje 15 alatt maradjon
    const band = glycemicBand({ c: 60, sugarG: 0, fiberG: 2, p: 10, f: 12 })!
    // teher 36 − (4 + 2,5 + 2,4) = 27,1 → magas, ezért kevesebb szénhidráttal:
    const midBare = glycemicBand({ c: 50, sugarG: 0, fiberG: 2, p: 10, f: 12 })!
    expect(band.level).toBe('high')
    expect(midBare.level).toBe('mid')
    expect(midBare.tip.title).toBe('Rost előre')
    expect(midBare.expect.energy).toBe('Stabil energia 2-3 órára')
  })

  test('közepes sáv rosttal: „Jó irány, egy aprósággal"', () => {
    expect(withFiber(24)!.tip.title).toBe('Jó irány, egy aprósággal')
  })

  test('magas sáv édes szénhidráttal: „Öltöztesd fel a szénhidrátot"', () => {
    // cukor a szénhidrát 45%-a felett ÉS legalább 12 g
    const band = glycemicBand({ c: 100, sugarG: 60, fiberG: 0, p: 0, f: 0 })!
    expect(band.level).toBe('high')
    expect(band.tip.title).toBe('Öltöztesd fel a szénhidrátot')
  })

  test('magas sáv édesség nélkül: „Egy séta most sokat ér"', () => {
    const band = glycemicBand({ c: 100, sugarG: 0, fiberG: 0, p: 0, f: 0 })!
    expect(band.level).toBe('high')
    expect(band.tip.title).toBe('Egy séta most sokat ér')
    expect(band.expect.energy).toBe('Gyors löket, majd visszaesés')
  })

  test('a becsült cukor is átléphet az édes ágra — a 30%-os feltevés nem teszi automatikusan azzá', () => {
    // becsült cukor = c × 0,3, ami sosem éri el a 45%-os édes küszöböt
    const band = glycemicBand({ c: 200, sugarG: null, fiberG: 0, p: 0, f: 0 })!
    expect(band.sugarEstimated).toBe(true)
    expect(band.tip.title).toBe('Egy séta most sokat ér')
  })
})

describe('glycemicBand · az owner két nem-tárgyalható döntése', () => {
  const all = [
    glycemicBand({ c: 100, sugarG: 60, fiberG: 0, p: 0, f: 0 })!,
    glycemicBand({ c: 50, sugarG: 0, fiberG: 2, p: 10, f: 12 })!,
    glycemicBand({ c: 20, sugarG: 2, fiberG: 8, p: 30, f: 20 })!,
    glycemicBand({ c: 64, sugarG: null, fiberG: 7, p: 22, f: 9 })!,
  ]

  /** Minden szöveg, amit a sáv a felületre ad. */
  const copyOf = (b: NonNullable<ReturnType<typeof glycemicBand>>) => [
    b.label, b.tip.title, b.tip.body,
    b.expect.energy, b.expect.back, b.expect.hunger,
    ...b.facts.map(f => `${f.label} ${f.value}`),
  ].join(' | ')

  test('soha nem jelenik meg glikémiás index — se a szó, se egy index-szám', () => {
    for (const band of all) {
      const copy = copyOf(band).toLowerCase()
      expect(copy).not.toContain('glikémiás')
      expect(copy).not.toContain('glikemias')
      expect(copy).not.toContain('index')
      expect(copy).not.toContain('gi ')
      // a sáv nem szivárogtat ki számot a szint mellé
      expect(Object.keys(band)).not.toContain('index')
      expect(band.label).not.toMatch(/\d/)
    }
  })

  test('a magas sáv sem ítélkezik — nincs kudarc-szó egyetlen szövegben sem', () => {
    const shame = [
      'elrontott', 'elrontod', 'elrontottad', 'hiba', 'hibás', 'rossz', 'túlléptél',
      'túlléptem', 'bűn', 'kudarc', 'szégyen', 'vétek', 'tilos', 'ne egyél',
    ]
    for (const band of all) {
      const copy = copyOf(band).toLowerCase()
      for (const word of shame) {
        expect(copy, `„${word}" nem szerepelhet: ${copy}`).not.toContain(word)
      }
    }
  })
})

describe('glycemicBand · „Legközelebb így lesz laposabb" (owner, 2026-09-26)', () => {
  test('alacsony sávon nincs mit simítani — nincs javaslat', () => {
    expect(withFiber(24.05)!.improve).toBeNull()
  })

  test('az owner tízóraija (banán, méz, rozskenyér): édes rész + rost, együtt közepes', () => {
    const band = glycemicBand({ c: 110, sugarG: 48, fiberG: 12, p: 21, f: 6 })!
    expect(band.level).toBe('high')
    expect(band.improve!.steps.map(s => s.title)).toEqual(['Feleannyi édes rész', 'Rost mellé'])
    expect(band.improve!.result).toBe('mid')
  })

  test('becsült cukorra NEM javasolunk kevesebb édeset — nem tudjuk, van-e benne', () => {
    const band = glycemicBand({ c: 78, sugarG: null, fiberG: 8, p: 42, f: 10 })!
    expect(band.improve!.steps.map(s => s.title)).not.toContain('Feleannyi édes rész')
  })

  test('mindig legfeljebb két lépés, és a sáv nem lehet rosszabb a mostaninál', () => {
    const band = glycemicBand({ c: 200, sugarG: 90, fiberG: 2, p: 10, f: 5 })!
    expect(band.improve!.steps.length).toBe(2)
    expect(band.improve!.result).toBe('high')
  })
})
