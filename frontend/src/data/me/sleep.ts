import type { SleepEntry } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

const sleepLogFixed: SleepEntry[] = [
  { date: '2026-05-09', bedtime: '23:15', wakeup: '06:45', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 130, notes: null },
  { date: '2026-05-10', bedtime: '23:40', wakeup: '07:00', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 95, notes: 'Vacsora csúszott', inBedMin: 460, awakeMin: 22, lightMin: 200, remMin: 140, deepMin: 98, sourceQualityPct: 82, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRRLDDLLRRLDDLLRRLALDDLRRR' } },
  { date: '2026-05-11', bedtime: '23:55', wakeup: '07:20', duration: 6.5, quality: 6, awakenings: 2, mealToSleep: 80, notes: 'Volleyball szombat · late dinner', inBedMin: 432, awakeMin: 42, lightMin: 190, remMin: 112, deepMin: 88, sourceQualityPct: 72, source: 'screenshot' },
  { date: '2026-05-12', bedtime: '22:50', wakeup: '06:30', duration: 7.7, quality: 8, awakenings: 0, mealToSleep: 145, notes: null },
  { date: '2026-05-13', bedtime: '23:10', wakeup: '06:50', duration: 7.7, quality: 8, awakenings: 1, mealToSleep: 140, notes: null, inBedMin: 480, awakeMin: 18, lightMin: 208, remMin: 148, deepMin: 106, sourceQualityPct: 88, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ADDLLRRLDDLLRRRLDDLLRRLLDDLRRRRR' } },
  { date: '2026-05-14', bedtime: '23:30', wakeup: '06:50', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 110, notes: null },
  { date: '2026-05-15', bedtime: '00:15', wakeup: '07:00', duration: 6.8, quality: 5, awakenings: 3, mealToSleep: 65, notes: 'Magnézium kihagyva · késő szénhidrát', inBedMin: 445, awakeMin: 37, lightMin: 196, remMin: 112, deepMin: 100, sourceQualityPct: 64, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRLDDLLARLDDLLRRLALDDLR' } },
  { date: '2026-05-16', bedtime: '23:00', wakeup: '06:30', duration: 6.6, quality: 8, awakenings: 1, mealToSleep: 150, notes: null, inBedMin: 430, awakeMin: 34, lightMin: 194, remMin: 110, deepMin: 92, sourceQualityPct: 74, source: 'screenshot' },
  { date: '2026-05-17', bedtime: '23:20', wakeup: '07:00', duration: 7.7, quality: 8, awakenings: 1, mealToSleep: 155, notes: null },
  { date: '2026-05-18', bedtime: '23:50', wakeup: '07:10', duration: 7.3, quality: 7, awakenings: 2, mealToSleep: 95, notes: 'Volleyball + késő vacsora', inBedMin: 462, awakeMin: 24, lightMin: 202, remMin: 138, deepMin: 98, sourceQualityPct: 80, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRRLDDLLRRLDDLLRRLALDDLRRR' } },
  { date: '2026-05-19', bedtime: '22:45', wakeup: '06:30', duration: 7.8, quality: 9, awakenings: 0, mealToSleep: 160, notes: 'Gyógyszer D1 · pihenve, magnézium ment', inBedMin: 478, awakeMin: 13, lightMin: 210, remMin: 152, deepMin: 106, sourceQualityPct: 92, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ADDLLRRLDDLLRRRLDDLLRRLLDDLRRRR' } },
  { date: '2026-05-20', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 140, notes: null },
  { date: '2026-05-21', bedtime: '23:25', wakeup: '06:45', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 110, notes: null },
  { date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 125, notes: 'Tegnap stabil', inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, sourceQualityPct: 95, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' } },
]

// mezo-idz2: a DayOrb (és minden mai-napra néző fogyasztó) mock módban is lásson tegnap
// éjszakát. Dátum-relatív, hogy ne avuljon el — a fenti sorok szándékosan fix dátumúak,
// mert a hét/hónap nézetek görbéi rájuk épülnek. Egy befagyasztott órájú vizuális
// futásban a „ma" egybeeshet egy meglévő fix sorral, ezért a beszúrás idempotens: csak
// akkor adjuk hozzá, ha erre a napra még nincs sor, majd a fenti (növekvő) sorrendet a
// beszúrás helyétől függetlenül explicit rendezéssel biztosítjuk.
// A skip-ág is MÁSOLATOT ad vissza: a `.sort()` helyben rendez, tehát a nyers ternary
// magát a modul-szintű `*Fixed` konstanst mutálná (mezo-tzid).
const todayIso = localDateString()

// mezo-7vdm #6: az alvásnaplót SZÁNDÉKOSAN NEM hidaljuk át, a súlynaplóval ellentétben.
// Az alvás-felületek DARABSZÁM szerint ablakoznak a legutóbbi éjszakákra (nem dátum
// szerint), ezért a fix farok és a mai sor közti lyuk ott nem is látszik — viszont a
// hídéjszakák kiszorítanák a kézzel írt, hypnogramos demó-éjszakákat generikus töltelékkel,
// és a fázis-/REM-kártyák kiürülnének. A /me/suly heti csoportosítása ezzel szemben DÁTUM
// szerint csoportosít, ott a lyuk valódi tünet — a hidat ezért csak a súlynapló kapja.
export const sleepLog: SleepEntry[] = (
  sleepLogFixed.some((e) => e.date === todayIso)
    ? [...sleepLogFixed]
    : [...sleepLogFixed, { date: todayIso, bedtime: '23:20', wakeup: '06:30', duration: 7.1, quality: 7, awakenings: 1, mealToSleep: 120, notes: null }]
).sort((a, b) => a.date.localeCompare(b.date))
