// ============================================================
// Mezo · a mock-seedek FOLYTONOSSÁGA és belső egyezése (mezo-7vdm #6).
//
// A fix seed-sorozatok a 2026-05-22-i mock-korszakkal érnek véget, a dátum-relatív „mai" sor
// viszont a valós órához igazodik. Emiatt valós időben LYUK tátongott a kettő közt — mire ez
// az issue készült, már több hónapos —, és a /me/suly heti csoportosítása egyelemű legfrissebb
// hetet mutatott. Ezek a tesztek azt őrzik, hogy a híd megvan és hogy a felület EGY számot
// állít a súlyról, ne hármat.
//
// A valós órán futnak (nincs fake timer): pont az a helyzet érdekel, amiben a drift keletkezik.
// ============================================================
import { goal, weightLog, weightTrends } from '@/data/me/goals'
import { sleepLog } from '@/data/me/sleep'
import { localDateString } from '@/shared/lib/dates'

const today = localDateString()

/** A sorozat legnagyobb szomszédos dátumköze napokban. */
function maxGapDays(dates: string[]): number {
  const ms = dates.map((d) => Date.parse(`${d}T00:00:00Z`)).sort((a, b) => a - b)
  let max = 0
  for (let i = 1; i < ms.length; i++) max = Math.max(max, (ms[i] - ms[i - 1]) / 86_400_000)
  return max
}

test('a súlynapló a fix faroktól a mai napig FOLYTONOS — nincs hónapos lyuk', () => {
  // A fix sorozat eleje szándékosan ritkás (2-3 naponta mér), a hídnak viszont naponta kell
  // sort adnia, ezért a farokra szűkítünk: 2026-05-22-től máig.
  const tail = weightLog.filter((w) => w.date >= '2026-05-22').map((w) => w.date)
  expect(tail[tail.length - 1]).toBe(today >= '2026-05-22' ? today : '2026-05-22')
  expect(maxGapDays(tail)).toBeLessThanOrEqual(1)
})

// Az alvásnapló SZÁNDÉKOSAN nincs áthidalva (lásd a sleep.ts fejlécét): a fázis- és
// REM-kártyák DARABSZÁM szerint ablakoznak a legutóbbi éjszakákra, tehát a hídéjszakák
// kiszorítanák a kézzel írt, hypnogramos demó-tartalmat. Ez a teszt AZT őrzi, hogy a
// gazdag éjszakák a látható ablakban maradjanak — ha valaki mégis hidat tenne alá, ez bukik.
test('az alvásnapló legutóbbi éjszakái a KÉZZEL ÍRT, fázisos seedből valók', () => {
  const recent = sleepLog.slice(-8)
  expect(recent.filter((e) => e.inBedMin !== undefined).length).toBeGreaterThanOrEqual(4)
})

test('a napló egyetlen napra sem ad két sort', () => {
  const dates = weightLog.map((w) => w.date)
  expect(new Set(dates).size).toBe(dates.length)
  const nights = sleepLog.map((e) => e.date)
  expect(new Set(nights).size).toBe(nights.length)
})

test('a goal.currentWeight A NAPLÓBÓL jön — nem mond mást, mint a legfrissebb sor', () => {
  expect(goal.currentWeight).toBe(weightLog[weightLog.length - 1].value)
})

test('a weightTrends.last7d.avg az utolsó hét sorainak átlaga', () => {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
  const window = weightLog.filter((w) => w.date >= cutoff)
  const expected = Math.round((window.reduce((a, w) => a + w.value, 0) / window.length) * 100) / 100
  expect(weightTrends.last7d.avg).toBe(expected)
})

test('a seedek determinisztikusak — kétszer importálva ugyanaz jön', async () => {
  const again = await import('@/data/me/goals')
  expect(again.weightLog).toEqual(weightLog)
})
