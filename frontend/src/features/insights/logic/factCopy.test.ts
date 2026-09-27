import { humanizeFactText, originChipLabel, bucketFacts } from '@/features/insights/logic/factCopy'
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

describe('originChipLabel', () => {
  it('names every source, the csapatfal one included (S7)', () => {
    expect(originChipLabel('pattern')).toBe('mintából')
    expect(originChipLabel('chat')).toBe('beszélgetésből')
    expect(originChipLabel('manual')).toBe('kézzel')
    expect(originChipLabel('weekly_review')).toBe('heti áttekintésből')
    expect(originChipLabel('question')).toBe('kérdésre válaszoltál')
    expect(originChipLabel('team_chat')).toBe('csapatfalról')
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
