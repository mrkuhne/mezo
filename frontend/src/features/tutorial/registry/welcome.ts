// ============================================================
// Mezo · WELCOME — a T0 első indítás négy lépése (mezo-gb1s.4, S2b spec §3).
// A KALAUZ_REGISTRY-n KÍVÜL él, két okból: (1) a lépések koppintható demók, amiket a
// KalauzCard öt típusa nem tud kifejezni; (2) egy `/nap` route-ú bejegyzés a `nap` kalauzzal
// ütközne — azonos minta, amit a registry sorrend-lintje (registry.test.ts) el is utasít. A seen-kulcs
// viszont ugyanabba a tutorial_progress map-be megy — a backend kulcs-agnosztikus, tehát
// nincs contract- vagy migráció-változás.
//
// Ami a prototípusból (docs/design_2.0/prototypes/kalauz.html:1158-1265) KIESETT:
// az 1. „Szia, Mezo vagyok" lépés (a köszönés az 1. lépés címébe olvadt) és az 5. fejléc-
// lépés (standard minta; ráadásul a napszak-váltó hatóköre nyitott kérdés, epic-spec §13.1).
// Ami MEGVÁLTOZOTT: az Én fül ikonja `i-polc` → `i-emberek` (TabBar.tsx:16), és a
// „fotó / hang" logolás-létra helyére a VALÓDI QuickInputSheet anatómiája került — a `+`
// gomb mögött csak a csempe-rács és a „Mondd el Mezónak" sor él (QuickInputSheet.tsx:104-178).
// ============================================================
import type { ClayIconName, ClaySpotName } from '@/shared/ui/clay'

/** Stable id — a seen-store kulcsa. Sose nevezzük át; verziót bumpolunk. */
export const WELCOME_ID = 'welcome'
export const WELCOME_VERSION = 1

export interface WelcomeDaypart { key: string; label: string; spot: ClaySpotName; size: number; sub: string }
export interface WelcomeTab { key: string; label: string; icon: ClayIconName; voice: string }
export interface WelcomeTile { label: string; icon: ClayIconName }

interface StepBase { title: string; voice: string }
export type WelcomeStep =
  | (StepBase & { kind: 'napszak'; dayparts: WelcomeDaypart[] })
  | (StepBase & { kind: 'tabbar'; tabs: WelcomeTab[] })
  | (StepBase & { kind: 'log'; tiles: WelcomeTile[]; chat: string })
  | (StepBase & { kind: 'sugo' })

export interface WelcomeGuide { id: string; version: number; steps: WelcomeStep[] }

export const WELCOME: WelcomeGuide = {
  id: WELCOME_ID,
  version: WELCOME_VERSION,
  steps: [
    {
      kind: 'napszak',
      // A köszönés ide olvadt (S2b-1). Ez az egyetlen mechanika, amit egy ülésben lehetetlen
      // felfedezni: a /nap oldal napszakonként átrendezi magát.
      title: 'Szia, Mezo vagyok.',
      voice: 'Egy nap nálunk három szakasz: reggel **indítunk**, napközben **logolunk és edzünk**, este **lezárjuk**. A Nap fül mindig azt mutatja, ami éppen soron van.',
      dayparts: [
        { key: 'reggel', label: 'Reggel', spot: 's-reggel', size: 58, sub: 'rutin · mérleg · Mezo üzenete' },
        { key: 'nap', label: 'Nap', spot: 's-energia', size: 70, sub: 'logolás · edzés · check-in' },
        { key: 'este', label: 'Este', spot: 's-este', size: 58, sub: 'rutin · Napzárás' },
      ],
    },
    {
      kind: 'tabbar',
      title: 'Öt hely, ahol minden megvan.',
      voice: 'Koppints a fülekre — mindegyik megmutatja, mi lakik nála.',
      tabs: [
        { key: 'nap', label: 'Nap', icon: 'i-nap', voice: 'A mai nap gerince: rutin, üzenetek, küldetések, Életjel — mindig az, ami most a dolgunk.' },
        { key: 'train', label: 'Edzés', icon: 'i-edzes', voice: 'Edzés, sport, futás: a heti terv, az aktív edzés, a gyakorlatok és a medálok.' },
        { key: 'fuel', label: 'Fuel', icon: 'i-fuel', voice: 'Étkezés és napi keret, kamra, receptek, a stack és a gyógyszer.' },
        { key: 'mezo', label: 'Mezo', icon: 'i-mezo', voice: 'A társ: a chat, a minták, amiket rólad észrevesz, és amit rólad megtanult.' },
        { key: 'me', label: 'Én', icon: 'i-emberek', voice: 'Te: cél, súly, alvás, emberek, karakter, beállítások.' },
      ],
    },
    {
      kind: 'log',
      title: 'Logolni bárhonnan, tíz másodperc.',
      voice: 'A **+** gomb minden oldalon ott van. Koppints rá — megnézheted, mi fér el mögötte.',
      // A VALÓDI QuickInputSheet csempéi (QuickInputSheet.tsx:151-168), sorrendhelyesen.
      tiles: [
        { label: 'Étkezés', icon: 'i-fuel' },
        { label: 'Edzés', icon: 'i-edzes' },
        { label: 'Stack', icon: 'i-stack' },
        { label: 'Súly', icon: 'i-suly' },
        { label: 'Check-in', icon: 'i-checkin' },
        { label: 'Alvás', icon: 'i-alvas' },
        { label: 'Napló', icon: 'i-naplo' },
      ],
      chat: 'Mondd el Mezónak',
    },
    {
      kind: 'sugo',
      title: 'Ha bármikor elakadsz.',
      voice: 'Minden oldalnak van kalauza: elsőre magától felugrik. Utána a **?** alatt bármikor visszanézheted.',
    },
  ],
}
