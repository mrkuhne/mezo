import {
  humanizeFactText, originSentence, originChipLabel, reinforcementSentence,
  promptStatusLabel, bucketFacts, matchesQuery,
} from '@/features/insights/logic/factCopy'
import type { KnowledgeFact } from '@/data/types'

const fact = (over: Partial<KnowledgeFact>): KnowledgeFact => ({
  id: 'x', text: 'Alapszöveg', category: 'health', active: true, reinforced: 0,
  source: 'chat', owner: 'deru', lastReinforcedAt: null, createdAt: '2026-01-01T00:00:00Z', ...over,
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

  it('csak a szó ELSŐ KÉT betűje alapján ismeri fel a rövidítést — a toldalékolt "HRV-alapú" nem kisbetűsödik hibásan', () => {
    expect(humanizeFactText('HRV-alapú terhelés ↔ alvás'))
      .toBe('A HRV-alapú terhelés és az alvás együtt mozognak.')
  })

  it('a záró írásjelet levágja mindkét oldalról, nem duplázza a mondatvégi pontot', () => {
    expect(humanizeFactText('Stressz-szint ↔ aznapi alvásminőség.'))
      .toBe('A stressz-szint és az aznapi alvásminőség együtt mozognak.')
  })

  it('rövidítésnél a betűnév kiejtése dönt a névelőről, nem az írott alak — "az RPE", nem "a RPE"', () => {
    expect(humanizeFactText('Valami ↔ RPE'))
      .toBe('A valami és az RPE együtt mozognak.')
    // H betűnév ("há") mássalhangzóval kezdődik → marad "a"
    expect(humanizeFactText('HRV ↔ valami')).toBe('A HRV és a valami együtt mozognak.')
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

  it('heti áttekintés és kérdés eredetet is megnevez (mezo-zpxv7)', () => {
    expect(originSentence(fact({ source: 'weekly_review' }))).toBe('A heti áttekintésből derült ki.')
    expect(originSentence(fact({ source: 'question' }))).toBe('Egy kérdésre válaszoltál rá.')
    expect(originChipLabel('weekly_review')).toBe('heti áttekintésből')
    expect(originChipLabel('question')).toBe('kérdésre válaszoltál')
  })

  it('a csapatfal-válaszból megjegyzett tényt is megnevezi (S7, mezo-d6ivw.7)', () => {
    expect(originSentence(fact({ source: 'team_chat' }))).toBe('A csapatfalon adott válaszodból jegyeztem meg.')
    expect(originChipLabel('team_chat')).toBe('csapatfalról')
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

  it('minden bekapcsolt tény a chatben van — nincs várólista (facts-always, mezo-d6ivw.8)', () => {
    const { inPrompt, off } = bucketFacts(facts)
    // reinforcement DESC (b=9 elöl), egyenlőségnél (a és d: 5-5) az újabb createdAt nyer (d 06-01 > a 01-01)
    expect(inPrompt.map((f) => f.id)).toEqual(['b', 'd', 'a'])
    expect(off.every((f) => !f.active)).toBe(true)
  })

  it('minden tény pontosan egy vödörben van', () => {
    const { inPrompt, off } = bucketFacts(facts)
    expect(inPrompt.length + off.length).toBe(facts.length)
  })
})

describe('promptStatusLabel + matchesQuery', () => {
  it('minden vödörnek van kimondott címkéje', () => {
    expect(promptStatusLabel('in-prompt')).toBe('A társ tudja — minden beszélgetésben ott van')
    expect(promptStatusLabel('off')).toBe('Kikapcsolva — a társ nem látja')
  })

  it('a keresés a megjelenített szövegre és a kategória-címkére illeszkedik', () => {
    const f = fact({ text: 'Gyógyszer-ciklusnap ↔ napi kalória', category: 'health' })
    expect(matchesQuery(f, 'kalória')).toBe(true)
    expect(matchesQuery(f, 'EGÉSZSÉG')).toBe(true)
    expect(matchesQuery(f, 'bench')).toBe(false)
    expect(matchesQuery(f, '')).toBe(true)
  })

  it('a keresés az eredet-mondatban megjelenő minta-címre is illeszkedik', () => {
    const f = fact({
      text: 'Stressz rontja az alvást',
      source: 'pattern',
      patternTitle: 'Stressz-szint ↔ aznapi alvásminőség',
    })
    expect(matchesQuery(f, 'aznapi')).toBe(true)
  })
})
