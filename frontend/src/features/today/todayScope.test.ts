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

/** Titánium Nap/Mai (mezo-mhum, manifest C6): a „Célok · ma" csempe a nyitóoldalról a társ
 *  KÖVETKEZŐ LÉPÉS-létrájába költözött (a `logic/nextStep` azóta törölve, mezo-yjzhw.4), a célok otthona az Én
 *  marad. A csempe-komponens így gazdátlan lett — visszahozni csak tudatos döntésként szabad. */
const RETIRED_TITANIUM = ['LifeGoalTodayTile.tsx']

/** Visszaöltöztetés (mezo-ju4j6.10): a Titán-kori jelenlét-jel és az ÉLŐ three.js jelenete.
 *  A Nap/Mai középpontján ma az agyag Mezo-szimbólum áll (`NapCompanion.tsx`) — ez egyben a
 *  Boop-avatar foglalt helye. A `TitanScene` volt a fa EGYETLEN three.js-fogyasztója, ezért a
 *  csomag is kikerült a `package.json`-ból: ha valaki visszahozza a fájlt, a hiányzó függőség
 *  azonnal megbuktatja a buildet — ez a teszt viszont hamarabb és beszédesebben szól. */
const RETIRED_VISSZAOLTOZTETES = ['TitanCompanion.tsx', 'TitanScene.tsx']

describe('a nyugdíjazott Today-felületek tényleg eltűntek', () => {
  test.each([...RETIRED_EARLIER, ...RETIRED_DESIGN_20, ...RETIRED_TITANIUM, ...RETIRED_VISSZAOLTOZTETES])('%s nincs a fában', (file) => {
    expect(readdirSync(DIR)).not.toContain(file)
  })

  test('sanity: a mappa nem üres — a maradó komponensek tényleg ott vannak', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    expect(files.sort()).toEqual([
      'ActivityLogCard.tsx', 'DailyQuestList.tsx', 'DailyQuestsCard.tsx',
      'DailyQuestsSheet.tsx', 'EletjelStrip.tsx',
      // Reflexió S5 (mezo-eq85.5) — az Észrevételek fül kártyája.
      // Visszaöltöztetés (mezo-ju4j6.10): a nyitóoldal jelenlét-jele — agyag Mezo-szimbólum
      // a szükséglet-színek haloja előtt, a Boop-avatar foglalt helyén.
      'MezoMessagesSheet.tsx', 'NapCompanion.tsx', 'NapFuelGraphic.tsx',
      'NapPersonalInsight.tsx', 'NapzarasCard.tsx', 'ObservationCard.tsx',
      // mezo-me75u.12 — az észrevétel-kártya tagolt bizonyíték-sorai.
      'ObservationEvidence.tsx',
    ])
  })
})
