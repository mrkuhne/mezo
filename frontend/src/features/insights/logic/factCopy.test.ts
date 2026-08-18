import {
  humanizeFactText, originSentence, originChipLabel, reinforcementSentence,
  promptStatusLabel, bucketFacts, matchesQuery,
} from '@/features/insights/logic/factCopy'
import type { KnowledgeFact } from '@/data/types'

const fact = (over: Partial<KnowledgeFact>): KnowledgeFact => ({
  id: 'x', text: 'Alapszöveg', category: 'health', active: true, reinforced: 0,
  source: 'chat', lastReinforcedAt: null, createdAt: '2026-01-01T00:00:00Z', ...over,
})

describe('humanizeFactText', () => {
  it('az "A ↔ B" minta-címből emberi mondatot képez', () => {
    expect(humanizeFactText('Gyógyszer-ciklusnap ↔ napi kalória'))
      .toBe('A gyógyszer-ciklusnap és a napi kalória együtt mozognak.')
  })

  it('magánhangzós kezdetnél "az" névelőt tesz', () => {
    expect(humanizeFactText('Alvásóra ↔ másnapi súlyváltozás'))
      .toBe('Az alvásóra és a másnapi súlyváltozás együtt mozognak.')
  })

  it('a csupa nagybetűs rövidítést nem kisbetűsíti', () => {
    expect(humanizeFactText('HRV ↔ aznapi terhelés'))
      .toBe('A HRV és az aznapi terhelés együtt mozognak.')
  })

  it('nyíl nélküli mondatot változatlanul hagy', () => {
    expect(humanizeFactText('Caffeine cutoff: 14:00 hard limit')).toBe('Caffeine cutoff: 14:00 hard limit')
  })

  it('kettőnél több nyílnál nem találgat', () => {
    expect(humanizeFactText('a ↔ b ↔ c')).toBe('a ↔ b ↔ c')
  })
})

describe('originSentence', () => {
  it('minta-tényt magyaráz', () => {
    expect(originSentence(fact({ source: 'pattern', text: 'X ↔ Y', patternTitle: 'X ↔ Y' })))
      .toBe('Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi.')
  })

  it('eltérő minta-címet evidenciaként hozzáfűz', () => {
    expect(originSentence(fact({ source: 'pattern', text: 'Este eszik', patternTitle: 'Késői étkezés ↔ alvás' })))
      .toBe('Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi. (A minta: „Késői étkezés ↔ alvás".)')
  })

  it('chat és kézi eredetet is megnevez', () => {
    expect(originSentence(fact({ source: 'chat' }))).toBe('A beszélgetéseitekből szűrtem ki.')
    expect(originSentence(fact({ source: 'manual' }))).toBe('Te vetted fel kézzel.')
    expect(originChipLabel('pattern')).toBe('mintából')
  })
})

describe('reinforcementSentence', () => {
  it('nulla megerősítésnél őszinte', () => {
    expect(reinforcementSentence(0, null)).toBe('Még nem jött vissza megerősítés.')
  })

  it('dátummal és anélkül is beszédes', () => {
    expect(reinforcementSentence(2, '2026-08-05T19:20:00Z')).toBe('2× visszaigazolva · utoljára Aug 5')
    expect(reinforcementSentence(3, null)).toBe('3× visszaigazolva')
  })
})

describe('bucketFacts', () => {
  const facts = [
    fact({ id: 'a', reinforced: 5 }),
    fact({ id: 'b', reinforced: 9 }),
    fact({ id: 'c', reinforced: 1, active: false }),
    fact({ id: 'd', reinforced: 5, createdAt: '2026-06-01T00:00:00Z' }),
  ]

  it('a bekapcsoltakat megerősítés szerint rangsorolja, döntetlennél a frissebb nyer', () => {
    const { inPrompt } = bucketFacts(facts, 10)
    expect(inPrompt.map((f) => f.id)).toEqual(['b', 'd', 'a'])
  })

  it('a topN fölötti bekapcsoltak várakoznak, a kikapcsoltak külön vödörbe kerülnek', () => {
    const { inPrompt, waiting, off } = bucketFacts(facts, 2)
    expect(inPrompt.map((f) => f.id)).toEqual(['b', 'd'])
    expect(waiting.map((f) => f.id)).toEqual(['a'])
    expect(off.map((f) => f.id)).toEqual(['c'])
  })
})

describe('promptStatusLabel + matchesQuery', () => {
  it('minden vödörnek van kimondott címkéje', () => {
    expect(promptStatusLabel('in-prompt')).toBe('Most benne van a chatben')
    expect(promptStatusLabel('waiting')).toBe('Bekapcsolva, de most kimarad')
    expect(promptStatusLabel('off')).toBe('Kikapcsolva — a társ nem látja')
  })

  it('a keresés a megjelenített szövegre és a kategória-címkére illeszkedik', () => {
    const f = fact({ text: 'Gyógyszer-ciklusnap ↔ napi kalória', category: 'health' })
    expect(matchesQuery(f, 'kalória')).toBe(true)
    expect(matchesQuery(f, 'EGÉSZSÉG')).toBe(true)
    expect(matchesQuery(f, 'bench')).toBe(false)
    expect(matchesQuery(f, '')).toBe(true)
  })
})
