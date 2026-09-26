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
// lépés (standard minta). A „?" a fejlécben ül; napszak-váltó NINCS (üveg bible §7.1).
// Üvegesítés U10 (mezo-me75u.10, owner-jóváhagyott szövegcsere): az 1–2. lépés a MAI
// chrome-ot írja le — a sávban bal lent a terület élő Boopja (koppintásra területváltó),
// mellette a terület négy füle (app/navModel.ts). A fülek mondatai a navModel négy fülét
// sorolják; a demó élő Boopokat mutat, nem agyag fül-ikonokat. A „+" gomb mögött a VALÓDI
// QuickInputSheet anatómiája él: a csempe-rács és a „Mondd el Mezónak" sor.
// A napszakok és a csempék a Titanium 3D készletet viselik (üveg bible §4).
// ============================================================
import type { BoopDomain, Icon3DName } from '@/shared/ui/clay'

/** Stable id — a seen-store kulcsa. Sose nevezzük át; verziót bumpolunk. */
export const WELCOME_ID = 'welcome'
export const WELCOME_VERSION = 1

export interface WelcomeDaypart { key: string; label: string; icon: Icon3DName; size: number; sub: string }
/** `key` = a navModel domain-id; a demó ebből rajzolja a terület élő Boopját. */
export interface WelcomeTab { key: BoopDomain; label: string; voice: string }
export interface WelcomeTile { label: string; icon: Icon3DName }

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
      // A köszönés ide olvadt (S2b-1). A Mai oldal NEM rendezi át magát napszakonként (csak az
      // esti Napzárás-kártya jön elő az ablakában — NapzarasCard), ezért a szöveg nem is ígéri.
      title: 'Szia, Mezo vagyok.',
      voice: 'Egy nap nálunk három szakasz: reggel **indítunk**, napközben **logolunk és edzünk**, este **lezárjuk**.',
      dayparts: [
        { key: 'reggel', label: 'Reggel', icon: 't-dawn', size: 48, sub: 'rutin · mérleg · Mezo üzenete' },
        { key: 'nap', label: 'Nap', icon: 't-sun', size: 62, sub: 'logolás · edzés · check-in' },
        { key: 'este', label: 'Este', icon: 't-moon', size: 48, sub: 'rutin · Napzárás' },
      ],
    },
    {
      kind: 'tabbar',
      title: 'Öt terület, egy koppintásra.',
      voice: 'Bal lent a **Boopra** koppintva váltasz területet; mellette a terület négy füle. Koppints a figurákra — mindegyik megmutatja, mi lakik nála.',
      // A navModel DOMAINS sorrendje és négy füle (welcome.test.ts ezt ellenőrzi).
      tabs: [
        { key: 'nap', label: 'Nap', voice: 'A mai nap: a Mai oldal, A napom, a beszélgetés Mezóval és a rutin.' },
        { key: 'train', label: 'Edzés', voice: 'Mai edzés, a terv, a heti terhelés és a gyakorlatok — a sport és a futás is innen indul.' },
        { key: 'fuel', label: 'Fuel', voice: 'Étkezés és napi keret, kiegészítők, trendek és a konyha.' },
        { key: 'mezo', label: 'Mezo', voice: 'A csapat üzenőfala, a karakterek, amit rólad tudunk, és az emlékek.' },
        { key: 'me', label: 'Én', voice: 'Te: áttekintés és célok, súly, alvás, napló — és a beállítások.' },
      ],
    },
    {
      kind: 'log',
      title: 'Logolni bárhonnan, tíz másodperc.',
      voice: 'A **+** gomb minden oldalon ott van. Koppints rá — megnézheted, mi fér el mögötte.',
      // A VALÓDI QuickInputSheet csempéi (QuickInputSheet.tsx:151-168), sorrendhelyesen.
      tiles: [
        { label: 'Étkezés', icon: 't-bowl' },
        { label: 'Edzés', icon: 't-dumbbell' },
        { label: 'Stack', icon: 't-supps' },
        { label: 'Súly', icon: 't-weight' },
        { label: 'Check-in', icon: 't-checkin' },
        { label: 'Alvás', icon: 't-sleep' },
        { label: 'Napló', icon: 't-journal' },
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
