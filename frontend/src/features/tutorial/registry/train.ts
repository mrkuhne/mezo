// ============================================================
// Mezo · az Edzés hub kalauza (mezo-gb1s.3).
// A hős hat számított variánst vehet fel (terv nélküli szellem, gym, sport, futás, saját,
// pihenőnap — EdzesHubPage.tsx:109-235), ezért a „hogyan" kártya arról beszél, hogy a
// felső csempe MINDIG a mai napot mutatja, nem arról, hogy MI van benne.
// A fogalom-kártya a mezociklus, mert a terv nélküli új user első akadálya pont ez a szó:
// a hős szellem-variánsa azt mondja neki, hogy „tervezz egy mesociklust".
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const TRAIN_KALAUZ: KalauzEntry[] = [
  {
    id: 'train',
    route: '/train',
    tier: 'T1',
    version: 1,
    label: 'Edzés',
    cards: [
      {
        kind: 'intro', spot: 's-edzes', orb: 's-orb',
        title: 'Ez az Edzés.',
        voice: 'Itt él a mai edzésed, a heti terved és minden, amit eddig megemeltél. A tervezéstől a sorozat lelogolásáig egy hely.',
      },
      {
        kind: 'fogalom', spot: 'i-meso', orb: 's-orb',
        title: 'A terv több hétre szól.',
        voice: 'Az edzés nem napról napra születik: egy mezociklus előre kiosztja a heteket, és Mezo ebből rakja ki a mai napodat.',
        ...fogalom('mezociklus'),
      },
      {
        kind: 'hogyan', spot: 's-hajtas', orb: 's-orb-figyel', anchor: 'train-hero',
        title: 'A hős mindig a mai nap.',
        voice: 'A legfelső csempe azt mutatja, mi van ma — edzés, sport, futás vagy pihenő —, és egy koppintással indul. Terv nélkül itt ajánlunk egyet.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés előtt és közben.',
        voice: 'Indulás előtt megnézed, mi jön; közben a sorozatokat itt vezetjük. Utána a Heti és a Medálok mutatják, mi gyűlt össze.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Az edzés máshol is látszik.',
        voice: 'Egy edzésnapon több energia jár, és a súlyod is másképp mozog. Mezo ezeket összeköti.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'a hét ritmusa' },
          { to: '/train/mesocycles', label: 'Mezociklus', icon: 'i-meso', effect: 'a többhetes terv' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'edzésnap → +keret' },
          { to: '/train/medals', label: 'Medálok', icon: 'i-erme' },
        ],
      },
    ],
  },
  // ── T2 aloldalak (mezo-gb1s.5) ──────────────────────────────────────────────
  // Címke = az oldal saját megjelenített neve, szó szerint (PageTitle / mz-hero-nm).
  // A /train/review a T2-lista egyetlen paraméteres route-ja — az átfedés-lint
  // (registry.test.ts) őrzi, hogy egy jövőbeli literál testvér ne rang-holtversenyezzen.
  // A /train/session chrome-mentes oldal (AppLayout hideChrome): a fejléc ?-e ott nem
  // létezik, az újranyitás a prep-fázis mini ?-én át megy (D11, ActiveWorkoutPage).
  {
    id: 'train-mai',
    route: '/train/mai',
    tier: 'T2',
    version: 1,
    label: 'Mai nap',
    cards: [
      {
        kind: 'intro', spot: 'i-edzes', orb: 's-orb',
        title: 'Ez a Mai nap.',
        voice: 'Egy nap teljes edzés-menetrendje: gym, sport vagy futás — ami mára ki van osztva, itt sorakozik.',
      },
      {
        kind: 'hogyan', spot: 'i-heti', orb: 's-orb-figyel', anchor: 'mai-napsav',
        title: 'A napsáv lapoz.',
        voice: 'Fent a hét napjai — koppints egyre, és az ő menetrendje jön fel. A ‹ Ma gomb mindig visszahoz a mába.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Indulás előtt.',
        voice: 'Edzés előtt: mi vár ma, és honnan indul. A Hetiből ide érkezel, ha egy napra ránézel.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A nap a hétből jön.',
        voice: 'A menetrendet a heti terv adja, a mai gym pedig innen indul élesbe.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'a hét ritmusa' },
          { to: '/train/session', label: 'Indítás', icon: 'i-lang', effect: 'a mai gym élesben' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-week',
    route: '/train/week',
    tier: 'T2',
    version: 1,
    label: 'Heti edzések',
    cards: [
      {
        kind: 'intro', spot: 'i-heti', orb: 's-orb',
        title: 'Ez a Heti.',
        voice: 'A hét minden napja egy sorban: mi volt, mi lesz, mi ment le — egy pillantásra.',
      },
      {
        kind: 'hogyan', spot: 'i-edzes', orb: 's-orb-figyel', anchor: 'heti-napok',
        title: 'A napsorok visznek tovább.',
        voice: 'A mai gym a sorából indul, a lezárt edzés visszanézhető. Lent az izom-zónák mutatják, hova gyűlik a heti terhelés.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A hét két szélén.',
        voice: 'Hét elején a terv, hét végén a mérleg. Közben akkor, ha átrendeznél — az Időpontok gombbal.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A hét a blokkból jön.',
        voice: 'A napok kiosztását a mezociklus adja, a lezárt alkalmakból pedig medál is születhet.',
        links: [
          { to: '/train/mesocycles', label: 'Mesociklusok', icon: 'i-meso', effect: 'a terv forrása' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
          { to: '/train/medals', label: 'Medálok', icon: 'i-erme' },
        ],
      },
    ],
  },
  {
    id: 'train-sport',
    route: '/train/sport',
    tier: 'T2',
    version: 1,
    label: 'Sport',
    cards: [
      {
        kind: 'intro', spot: 'i-sport', orb: 's-orb',
        title: 'Ez a Sport.',
        voice: 'A csapatedzések és meccsek helye: heti terv, napló — és az, hogyan ül össze a gym-mel.',
      },
      {
        kind: 'hogyan', spot: 'i-naplo', orb: 's-orb-figyel', anchor: 'sport-tabs',
        title: 'Három fül, egy sportág.',
        voice: 'A **Heti terv** a slotjaid, a **Napló** a lelogolt alkalmak, a **Cross-load** a közös terhelés a gym-mel. Logolni a ＋ Log gombbal tudsz fent.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés után, egy percre.',
        voice: 'Meccs vagy edzés után: mennyi volt, milyen volt. A heti kép ezekből áll össze.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A pálya is terhelés.',
        voice: 'A sport-alkalmak a heti terhelésbe számítanak — és sportnapon a keret is másképp alakul.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'közös terhelés-kép' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'edzésnap → +keret' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-futas',
    route: '/train/futas',
    tier: 'T2',
    version: 1,
    label: 'Futás',
    cards: [
      {
        kind: 'intro', spot: 'i-futas', orb: 's-orb',
        title: 'Ez a Futás.',
        voice: 'A futóblokkod otthona: heti adagok, napló és a terveid, hétről hétre.',
      },
      {
        kind: 'hogyan', spot: 'i-cel', orb: 's-orb-figyel', anchor: 'futas-tabs',
        title: 'Itt is három fül.',
        voice: 'Az **E heti edzés** a mostani adag, a **Napló** a megtett körök, a **Tervek** a blokkjaid. Újat a ＋ Új terv gombbal indítasz.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Futás után, hét elején.',
        voice: 'Futás után logolsz, hét elején ránézel, mit ír elő a blokk. Aktív terv nélkül a Tervek fül a kiindulópont.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A kör beszámít.',
        voice: 'A futásaid a heti menetrendben és a mai napodban is ott vannak — egy terhelés, több nézet.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-exercises',
    route: '/train/exercises',
    tier: 'T2',
    version: 1,
    label: 'Gyakorlatok',
    cards: [
      {
        kind: 'intro', spot: 'i-polc', orb: 's-orb',
        title: 'Ez a Gyakorlatok.',
        voice: 'A teljes katalógus és a saját rekordjaid: a top gyakorlataid elöl, minden más egy keresésre.',
      },
      {
        kind: 'hogyan', spot: 'i-video', orb: 's-orb-figyel', anchor: 'exercises-kereso',
        title: 'Keress vagy szűrj.',
        voice: 'Írj a keresőbe vagy szűrj izomcsoportra — a találat sora a rekordjaidat nyitja, a ▶ a technika-videót. Sajátot az Új gyakorlat gombbal veszel fel.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés közben, tervezéskor.',
        voice: 'Edzés közben egy videóért, tervezéskor egy új gyakorlatért. A rekordok maguktól frissülnek a szettjeidből.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A katalógus a hozzávaló.',
        voice: 'A blokk-tervező innen válogat, a rekordokat pedig az élő edzés szettjei írják.',
        links: [
          { to: '/train/mesocycles', label: 'Mesociklusok', icon: 'i-meso', effect: 'innen válogat a terv' },
          { to: '/train/session', label: 'Indítás', icon: 'i-lang', effect: 'a szettek ide íródnak' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-medals',
    route: '/train/medals',
    tier: 'T2',
    version: 1,
    label: 'Medálok',
    cards: [
      {
        kind: 'intro', spot: 's-medal', orb: 's-orb',
        title: 'Ez a Medálok.',
        voice: 'A vitrined: rekordok és teljesült célok, dátum szerint, ahogy megszülettek.',
      },
      {
        kind: 'hogyan', spot: 'i-erme', orb: 's-orb-figyel', anchor: 'medals-hero',
        title: 'Magától érkezik.',
        voice: 'Egy top szett, egy új csúcs — és a medál a vitrinbe kerül. Külön vadászni nem szükséges.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor csillant valami.',
        voice: 'Edzés után, ha új csúcs született — vagy csak visszanézni, mennyi gyűlt. A számláló fent mutatja a havi termést.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A vitrin forrása az edzés.',
        voice: 'A medál a lelogolt szettekből születik, és XP-ként a szintedben is megjelenik.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'a lezárt alkalmakból' },
          { to: '/me/growth', label: 'Growth', icon: 'i-growth', effect: 'XP-ként is számít' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-mesocycles',
    route: '/train/mesocycles',
    tier: 'T2',
    version: 1,
    label: 'Mesociklusok',
    cards: [
      {
        kind: 'intro', spot: 'i-meso', orb: 's-orb',
        title: 'Ez a Mesociklusok.',
        voice: 'A többhetes blokkjaid könyvtára: az aktív futam felül, alatta a történet.',
      },
      {
        kind: 'fogalom', spot: 's-hegycel', orb: 's-orb',
        title: 'A blokk a motor.',
        voice: 'A heti edzéseidet az aktív blokk osztja ki — itt látod, hol tart, és itt születik a következő.',
        ...fogalom('mezociklus'),
      },
      {
        kind: 'hogyan', spot: 'i-naplo', orb: 's-orb-figyel', anchor: 'mesociklus-mosaic',
        title: 'Négy csempe, négy irány.',
        voice: 'A **Heti vizsgálat** az aktív hétbe visz, a **Történet** a lezárt futamokhoz, a **Sablonok** a terveidhez, az **Új blokk** a tervezőbe.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Blokk-váltáskor.',
        voice: 'Blokk végén és új indításakor — hét közben elég a Heti. Két lezárt futam össze is vethető.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul minden hét.',
        voice: 'A blokk adja a heti napokat, a napok a mai edzésed — a lánc itt kezdődik.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'az aktív hét' },
          { to: '/train/templates', label: 'Sablonok', icon: 'i-polc' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-session',
    route: '/train/session',
    tier: 'T2',
    version: 1,
    label: 'Aktív edzés',
    cards: [
      {
        kind: 'intro', spot: 's-edzes', orb: 's-orb',
        title: 'Ez az indítás.',
        voice: 'A mai edzés eligazítása: mi vár, milyen súlyokkal, mennyi szett — mielőtt elindulnál.',
      },
      {
        kind: 'fogalom', spot: 'i-retegek', orb: 's-orb',
        title: 'Egy szám a tartalékról.',
        voice: 'Minden szettnél a súly és az ismétlés mellé egy RIR-t is jegyzünk. Ebből tudja Mezo, mennyire volt nehéz.',
        ...fogalom('rir'),
      },
      {
        kind: 'hogyan', spot: 'i-lang', orb: 's-orb-figyel', anchor: 'session-start',
        title: 'Egy gomb, és élesben.',
        voice: 'A ⚡ Kezdjük el indítja az élő módot: szettről szettre logolsz, köztük pihenő-időzítő jár. Kilépni bármikor lehet — az edzés megvárja.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A terem küszöbén.',
        voice: 'Indítás előtt egy perc eligazítás, aztán élesben. Az összegzés a végén magától jön.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Az edzés nyomot hagy.',
        voice: 'A szettjeid a rekordjaidat írják, a lezárt alkalom pedig bármikor visszanézhető.',
        links: [
          { to: '/train/exercises', label: 'Gyakorlatok', icon: 'i-polc', effect: 'rekordok és videók' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
  {
    id: 'train-review',
    route: '/train/review/:workoutId',
    tier: 'T2',
    version: 1,
    label: 'Visszanézés',
    cards: [
      {
        kind: 'intro', spot: 'i-naplo', orb: 's-orb',
        title: 'Ez egy lezárt edzés.',
        voice: 'A szettek, a statisztika és az összevetés az előző azonos nappal — ami történt, itt marad.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Aznap vagy hetekkel később.',
        voice: 'Edzés után még frissiben, vagy a Hetiből visszalapozva. A lánc mentén az előző alkalmakra is átléphetsz.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A múlt a mércéd.',
        voice: 'Az itteni csúcsokból lesznek a medálok — és a következő azonos nap ehhez méri magát.',
        links: [
          { to: '/train/medals', label: 'Medálok', icon: 'i-erme', effect: 'a csúcsok ide kerülnek' },
          { to: '/train/week', label: 'Heti', icon: 'i-heti' },
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
        ],
      },
    ],
  },
]
