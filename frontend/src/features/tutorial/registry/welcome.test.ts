import { FORBIDDEN, countSentences } from '@/features/tutorial/registry/lint'
import { WELCOME, WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
import { KALAUZ_REGISTRY } from '@/features/tutorial/registry'
import { DOMAINS } from '@/app/navModel'

test('a welcome NEM a KALAUZ_REGISTRY-ben él', () => {
  // S2b-5: egy /nap route-ú bejegyzés ütközne a `nap` kalauzzal (azonos minta — a
  // registry route-lintje elutasítja), és a KalauzCard öt típusa nem tudja kifejezni
  // a koppintható demókat.
  expect(KALAUZ_REGISTRY.some((e) => e.id === WELCOME_ID)).toBe(false)
})

test('a welcome négy lépése a spec §3 sorrendjében áll', () => {
  expect(WELCOME.id).toBe('welcome')
  expect(WELCOME.version).toBe(WELCOME_VERSION)
  expect(WELCOME.steps.map((s) => s.kind)).toEqual(['napszak', 'tabbar', 'log', 'sugo'])
})

test('hang-lint: nincs tiltott szó, lépésenként legfeljebb 2 mondat', () => {
  for (const s of WELCOME.steps) {
    expect(s.title, s.kind).not.toMatch(FORBIDDEN)
    expect(s.voice, s.kind).not.toMatch(FORBIDDEN)
    expect(countSentences(s.voice), s.kind).toBeLessThanOrEqual(2)
  }
})

test('a demó-lépések szövegei is lintelve vannak', () => {
  for (const s of WELCOME.steps) {
    if (s.kind === 'napszak') for (const d of s.dayparts) expect(d.sub, d.label).not.toMatch(FORBIDDEN)
    if (s.kind === 'tabbar') for (const t of s.tabs) {
      expect(t.voice, t.label).not.toMatch(FORBIDDEN)
      expect(countSentences(t.voice), t.label).toBeLessThanOrEqual(2)
    }
    if (s.kind === 'log') for (const t of s.tiles) expect(t.label).not.toMatch(FORBIDDEN)
  }
})

test('a tabbar-lépés az öt VALÓDI területet hordozza, a navModel sorrendjében és nevén', () => {
  const step = WELCOME.steps.find((s) => s.kind === 'tabbar')
  expect(step?.kind).toBe('tabbar')
  if (step?.kind !== 'tabbar') return
  // U10 (mezo-me75u.10): a demó a terület ÉLŐ Boopját rajzolja (`key` = navModel domain-id),
  // nem agyag fül-ikont. A kód (navModel) a mérvadó, nem a prototípus.
  expect(step.tabs.map((t) => t.key)).toEqual(DOMAINS.map((d) => d.id))
  expect(step.tabs.map((t) => t.label)).toEqual(DOMAINS.map((d) => d.name))
})

test('a tabbar-lépés a MAI chrome-ot írja le: Boop-váltó + négy fül, fülenként a navModel füleivel', () => {
  const step = WELCOME.steps.find((s) => s.kind === 'tabbar')
  if (step?.kind !== 'tabbar') throw new Error('nincs tabbar-lépés')
  expect(step.title).toBe('Öt terület, egy koppintásra.')
  expect(step.voice).toMatch(/Boop/)
  expect(step.voice).toMatch(/négy füle/)
  const voice = (k: string) => step.tabs.find((t) => t.key === k)!.voice
  expect(voice('nap')).toMatch(/Mai oldal.*A napom.*beszélgetés.*rutin/)
  expect(voice('train')).toMatch(/terv.*terhelés.*gyakorlatok/)
  expect(voice('fuel')).toMatch(/kiegészítők.*trendek.*konyha/)
  expect(voice('mezo')).toMatch(/üzenőfala.*rólad.*emlékek/)
  expect(voice('me')).toMatch(/áttekintés.*súly.*alvás.*napló/)
})

test('az 1. lépés nem ígér napszakváltó oldalt, és nincs napszak-váltó a szövegben', () => {
  const step = WELCOME.steps[0]
  // A Mai oldal nem rendezi át magát napszakonként (dayFace csak a fejléc auróráját hajtja).
  expect(step.voice).not.toMatch(/Nap fül|magától azt mutatja/)
  if (step.kind !== 'napszak') throw new Error('az 1. lépés a napszak')
  expect(step.dayparts.map((d) => d.icon)).toEqual(['t-dawn', 't-sun', 't-moon'])
})

test('a logolás-lépés csempéi a 3D készletet viselik', () => {
  const step = WELCOME.steps.find((s) => s.kind === 'log')
  if (step?.kind !== 'log') throw new Error('nincs log-lépés')
  expect(step.tiles.map((t) => t.icon)).toEqual(['t-bowl', 't-dumbbell', 't-supps', 't-weight', 't-checkin', 't-sleep', 't-journal'])
})

test('versionOf: a welcome verziója a registryn kívülről is megszólal', async () => {
  const { versionOf, getKalauz } = await import('@/features/tutorial/registry')
  expect(versionOf('welcome')).toBe(WELCOME_VERSION)
  // A registry-beli id verziója a REGISTRYBŐL jön (nem a WELCOME_VERSION, és nem null) — egy
  // beégetett szám itt minden kalauz-bumpnál hamisan pirosodna (mezo-qt5q).
  expect(versionOf('fuel')).toBe(getKalauz('fuel')!.version)
  expect(versionOf('fuel')).toBeGreaterThanOrEqual(1)
  expect(versionOf('nincs-ilyen')).toBeNull()
})
