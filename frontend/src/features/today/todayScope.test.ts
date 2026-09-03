import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * A `features/today/components` mappa NYUGDÍJAZÁSI őre.
 *
 * Eredetileg (mezo-e26w) ez a fájl a Today SAJÁT iOS-listanyelvét védte: egyetlen
 * Today-komponens sem nyúlhatott vissza a `shared/ui/ItemRow`-hoz, mert a két listanyelv
 * összecsúszásától a Fuel vizuális goldenjei kezdtek mozogni. Ez a határ a Design 2.0
 * takarításával (mezo-d20.9.1) MEGSZŰNT: a Today lapnyelvét beszélő komponensek
 * (TodayList/TodayRow/DayGroups/Daypart*) a TodayPage-dzsel együtt kikerültek a fából, és
 * az egyetlen `ItemRow`-t importáló Today-komponens (AnchorIsland — a szándékos kivétel,
 * ami a mintát pozitív kontrollként hitelesítette) szintén. Ami maradt, abban nincs mit
 * őrizni: a szabály ma vakon, pozitív kontroll nélkül futna, azaz üresen zöldellne — egy
 * vakon zöld guard rosszabb a semminél, ezért az ItemRow-határ két tesztje itt megszűnt.
 *
 * Ami megmarad — és amiért a fájl él —, az a harmadik teszt eredeti munkája: a nyugdíjazott
 * felületek tényleg ne szivárogjanak vissza. A lista most a Design 2.0 takarításával törölt
 * nézetekkel bővül; ha valaki visszahozza valamelyiket, azt tudatos döntésként kell megtennie
 * (a fájl innen kivéve), nem véletlen resurrectionként.
 */
const DIR = join(process.cwd(), 'src/features/today/components')

/** Korábbi körök (mezo-e26w / mezo-puci) nyugdíjazásai. */
const RETIRED_EARLIER = ['MezoMessage.tsx', 'IslandFactsStrip.tsx', 'CompanionNoteCard.tsx']

/** Design 2.0 (mezo-d20.9.1): a TodayPage kompozíciós gyökér és a hozzá tartozó
 *  lapnyelv-komponensek — a NapHubPage + a Nap-aloldalak váltották ki őket. */
const RETIRED_DESIGN_20 = [
  'AnchorIsland.tsx', 'ChainCelebrations.tsx', 'DailyQuestsChip.tsx', 'DayGroups.tsx',
  'DaypartDay.tsx', 'DaypartEvening.tsx', 'DaypartMorning.tsx', 'DaypartPanel.tsx',
  'DaypartTabs.tsx', 'IntentionBanner.tsx', 'MezoChip.tsx', 'NeedsRow.tsx',
  'TodayList.tsx', 'TodayRow.tsx', 'TodayStats.tsx', 'VulnerabilityCard.tsx',
]

describe('a nyugdíjazott Today-felületek tényleg eltűntek', () => {
  test.each([...RETIRED_EARLIER, ...RETIRED_DESIGN_20])('%s nincs a fában', (file) => {
    expect(readdirSync(DIR)).not.toContain(file)
  })

  test('sanity: a mappa nem üres — a maradó komponensek tényleg ott vannak', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    expect(files.sort()).toEqual([
      'ActivityLogCard.tsx', 'DailyQuestList.tsx', 'DailyQuestsCard.tsx',
      'DailyQuestsSheet.tsx', 'EletjelStrip.tsx', 'MezoMessagesSheet.tsx',
    ])
  })
})
