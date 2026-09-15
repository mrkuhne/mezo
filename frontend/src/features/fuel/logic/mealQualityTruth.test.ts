// ============================================================
// Mezo · mealQualityTruth tests (mezo-tm3sb)
//
// A Minőség lapkák eddig a logolt tételsorokból számoltak. Egy receptből logolt étkezés viszont
// EGY összecsukott sor, a recept egyetlen domináns feldolgozottság-bélyegével és „1 adag"
// mennyiséggel — ezért az alapanyag-arány 0% vagy 100% volt, sosem az igazság, az energiasűrűség
// pedig gramm híján gondolatjel. A háttérrendszer mostantól a HOZZÁVALÓKBÓL pontoz, tehát a bontás
// maga hordozza a helyes választ; ez a modul azt olvassa ki, és nem számol másodszor.
// ============================================================
import { describe, expect, test } from 'vitest'
import type { MealBreakdown, MealDimension } from '@/data/types'
import { mealQualityTruth } from '@/features/fuel/logic/mealQualityTruth'

const breakdown = (dimensions: MealDimension[]): MealBreakdown => ({
  confidence: 0.8, summary: null, tagline: null, dimensions, improve: [], tools: [],
})

const novaDim = (stack: { nova: number; pct: number; label: string }[],
                 items: { name: string; nova: number }[]): MealDimension => ({
  id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.9,
  color: 'var(--cat-tendency)', detail: '', coverage: 1,
  nova: { dominant: 1, stack, items },
} as unknown as MealDimension)

const densityDim = (rows: { label: string; value: string }[]): MealDimension => ({
  id: 'energy_density', label: 'Energia-sűrűség', weight: 0.1, score: 0.7,
  color: 'var(--coral)', detail: '', coverage: 1, context: rows,
} as unknown as MealDimension)

/** A degradált dimenzió a BÁZIS mezőket hordozza és NINCS payloadja (mezo-jcpt.1) — a ház
 *  szerkezeti megkülönböztetése, nem az `id`-je alapján ismerhető fel. */
const degraded = (id: string): MealDimension => ({
  id, label: id, weight: 0, score: 0, color: 'var(--sub)', detail: 'Nincs adat.', coverage: 0,
} as unknown as MealDimension)

describe('a helyes válasz a bontásból', () => {
  test('az alapanyag-arány a NOVA-stack 1-es csoportjának kalória-részesedése', () => {
    const t = mealQualityTruth(breakdown([
      novaDim(
        [{ nova: 1, pct: 57, label: 'Zab · áfonya · mandula' },
         { nova: 2, pct: 6, label: 'Méz' },
         { nova: 3, pct: 37, label: 'Túró' },
         { nova: 4, pct: 0, label: '—' }],
        [{ name: 'Zabpehely 35g', nova: 1 }, { name: 'Túró 100g', nova: 3 }]),
    ]))
    // 57%, nem 0% és nem 100% — pontosan ez volt a hiba, amit ez a modul zár be.
    expect(t.basePct).toBe(57)
  })

  test('az ultra-feldolgozott a HOZZÁVALÓK darabszáma, nem a recepteké', () => {
    const t = mealQualityTruth(breakdown([
      novaDim([{ nova: 4, pct: 20, label: 'x' }], [
        { name: 'Zabpehely 35g', nova: 1 },
        { name: 'Müzliszelet 30g', nova: 4 },
        { name: 'Tejpor 10g', nova: 4 },
      ]),
    ]))
    expect(t.ultraItems).toBe(2)
  })

  test('nulla ultra-feldolgozott hozzávaló ISMERT nulla, nem hiányzó adat', () => {
    const t = mealQualityTruth(breakdown([
      novaDim([{ nova: 1, pct: 100, label: 'x' }], [{ name: 'Zabpehely 35g', nova: 1 }]),
    ]))
    expect(t.ultraItems).toBe(0)
  })

  test('az energiasűrűséget a saját dimenziója „Sűrűség" sorából olvassuk', () => {
    const t = mealQualityTruth(breakdown([densityDim([{ label: 'Sűrűség', value: '183 kcal/100g' }])]))
    expect(t.densityKcalPer100g).toBe(183)
  })
})

describe('őszinte-null: amit a bontás nem tud, az gondolatjel', () => {
  test('bontás nélkül mindhárom tény hiányzik', () => {
    expect(mealQualityTruth(undefined)).toEqual({
      basePct: null, ultraItems: null, densityKcalPer100g: null,
    })
  })

  test('degradált NOVA-dimenzió nem ad se arányt, se darabszámot', () => {
    // A degradált dimenziónak nincs payloadja — a 0% itt nem „nulla alapanyag", hanem „nem tudjuk".
    const t = mealQualityTruth(breakdown([degraded('nova')]))
    expect(t.basePct).toBeNull()
    expect(t.ultraItems).toBeNull()
  })

  test('degradált energiasűrűség NEM esik vissza a tételsorokra', () => {
    // A háttérrendszer már eldöntötte, hogy a tömeg nem megbízható (pl. a minimális tömeg-küszöb
    // alatt van). Ilyenkor a felület nem számol helyette egy kedvezőbb számot.
    const t = mealQualityTruth(breakdown([degraded('energy_density')]))
    expect(t.densityKcalPer100g).toBeNull()
  })

  test('hiányzó „Sűrűség" sor gondolatjel, nem nulla', () => {
    const t = mealQualityTruth(breakdown([densityDim([{ label: 'Valami más', value: '12' }])]))
    expect(t.densityKcalPer100g).toBeNull()
  })

  test('értelmezhetetlen „Sűrűség" érték gondolatjel, nem nulla', () => {
    const t = mealQualityTruth(breakdown([densityDim([{ label: 'Sűrűség', value: 'nincs adat' }])]))
    expect(t.densityKcalPer100g).toBeNull()
  })

  test('üres NOVA-stack nem hazudik nulla alapanyagot', () => {
    const t = mealQualityTruth(breakdown([novaDim([], [])]))
    expect(t.basePct).toBeNull()
    expect(t.ultraItems).toBeNull()
  })

  test('NOVA-stack 1-es sor NÉLKÜL ismert nulla — a csoport szerepel, csak 0%-on', () => {
    // Ez a másik irány: ha a stack valóban tartalmaz 1-es sort 0%-kal, az MÉRT nulla.
    const t = mealQualityTruth(breakdown([
      novaDim([{ nova: 1, pct: 0, label: '—' }, { nova: 4, pct: 100, label: 'Müzliszelet' }],
        [{ name: 'Müzliszelet 60g', nova: 4 }]),
    ]))
    expect(t.basePct).toBe(0)
    expect(t.ultraItems).toBe(1)
  })
})
