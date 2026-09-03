import { FORBIDDEN, countSentences } from '@/features/tutorial/registry/lint'
import { WELCOME, WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
import { KALAUZ_REGISTRY } from '@/features/tutorial/registry'

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

test('a tabbar-lépés az öt VALÓDI fület hordozza, a valódi ikonokkal', () => {
  const step = WELCOME.steps.find((s) => s.kind === 'tabbar')
  expect(step?.kind).toBe('tabbar')
  if (step?.kind !== 'tabbar') return
  // A prototípus `i-polc`-ot használ az Én fülre; a TabBar.tsx:16 `i-emberek`-et. A kód a mérvadó.
  expect(step.tabs.map((t) => t.icon)).toEqual(['i-nap', 'i-edzes', 'i-fuel', 'i-mezo', 'i-emberek'])
  expect(step.tabs.map((t) => t.label)).toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
})

test('versionOf: a welcome verziója a registryn kívülről is megszólal', async () => {
  const { versionOf } = await import('@/features/tutorial/registry')
  expect(versionOf('welcome')).toBe(WELCOME_VERSION)
  expect(versionOf('fuel')).toBe(1)
  expect(versionOf('nincs-ilyen')).toBeNull()
})
