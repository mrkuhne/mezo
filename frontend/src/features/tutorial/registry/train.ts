// ============================================================
// Mezo · az Edzés tabsor kalauza (mezo-gb1s.3 → mezo-88iwa.5 Train Titanium T4).
// A hat számított hős-variánsos EdzésHub (mezo-gb1s.3 eredeti terve) megszűnt: a
// négy-fülű IA alatt `/train` sosem renderel — azonnal `/train/mai`-re irányít
// (router.tsx TrainIndex). Ezért a korábbi T1 „train" bejegyzés (route `/train`,
// train-hero anchor) elesett: az anchor csak az EdzésHub-ban élt, a redirect előtt
// sosem látszott volna, és `/train` a KalauzSheet szemével sem külön oldal többé
// (findKalauz a ténylegesen landolt `/train/mai`-t oldja fel). A T2 aloldalak listája
// (S3a, mezo-gb1s.5) változatlan — `/train/mai` tier-je is T2 marad, a spec-listával
// összhangban.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const TRAIN_KALAUZ: KalauzEntry[] = [
  // ── T2 aloldalak (mezo-gb1s.5 → mezo-88iwa.5) ────────────────────────────────
  // Címke = az oldal saját megjelenített neve, szó szerint (mz-hero-nm / a Titanium
  // poszterek saját címe). A korábban idézett PageTitle primitív megszűnt: utolsó
  // fogyasztója a pre-Titanium Gyakorlatok héj volt (mezo-lf3cv P2).
  // A /train/review a T2-lista egyetlen paraméteres route-ja — az átfedés-lint
  // (registry.test.ts) őrzi, hogy egy jövőbeli literál testvér ne rang-holtversenyezzen.
  // A /train/session chrome-mentes oldal (AppLayout hideChrome): a fejléc ?-e ott nem
  // létezik, az újranyitás a prep-fázis mini ?-én át megy (D11, ActiveWorkoutPage).
  {
    id: 'train-mai',
    route: '/train/mai',
    tier: 'T2',
    // v3 (fix round 1, mezo-88iwa.5): a T1 „missing tab-level orientation" review-találat
    // kártyát kért a négy fülről (Mai/Terv/Terhelés/Gyakorlatok). Külön T1 bejegyzés nem
    // fér bele: a route-lint (registry.test.ts) tiltja a `/train/mai` route duplikálását,
    // az S3a-lista pedig itt rögzíti a tier-t T2-re — a `/train` route maga elesett Task
    // 2-ben, mert a redirect előtt sosem renderel (lásd a fájl fejléce). A tabsor-tanítás
    // ezért ide, a de facto landolt oldal elé került, a fuel.ts négy-fülű hogyan-idiómáját
    // követve, `train-tabs` anchorral (TabBar.tsx — a sáv MAGA a négy fül, minden
    // /train/*-on).
    // v4 (final-review fix wave, mezo-88iwa.6 T5): a napsáv kártyája a törölt „‹ Ma gomb"-ot
    // tanította — a page-header (és vele a gomb) a T5 posztererrel megszűnt. Copy-drift,
    // ugyanaz a szabály, ami a fuel.ts fejlécét is version-bumpre kötelezi: az élő oldalt
    // rosszul leíró kártyát azok is újra kell hogy lássák, akik a régit már látták.
    version: 4,
    label: 'Mai nap',
    cards: [
      {
        kind: 'intro', spot: 'i-edzes', orb: 's-orb',
        title: 'Ez a Mai nap.',
        voice: 'Egy nap teljes edzés-menetrendje: gym, sport vagy futás — ami mára ki van osztva, itt sorakozik.',
      },
      {
        kind: 'hogyan', spot: 'i-retegek', orb: 's-orb-figyel', anchor: 'train-tabs',
        title: 'Ez az Edzés.',
        voice: 'A **Mai** a mai edzésed, a sport és az egyedi edzés indítása, a **Terv** a futó terved hétről hétre a sablonjaiddal és az új tervvel, a **Terhelés** azt mutatja, mit kapott a tested a héten izmonként, a **Gyakorlatok** pedig minden mozdulatod a rekordjaiddal. Lent ez a négy fül visz mindenhová.',
      },
      {
        kind: 'hogyan', spot: 'i-heti', orb: 's-orb-figyel', anchor: 'mai-napsav',
        title: 'A napsáv lapoz.',
        voice: 'Fent a hét napjai — koppints egyre, és az ő menetrendje jön fel. A mai napod saját MA chipje mindig visszahoz a mába.',
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
        ],
      },
    ],
  },
  {
    id: 'train-week',
    route: '/train/week',
    tier: 'T2',
    // v2 (final-review fix wave, mezo-88iwa.13 T12): a napsáv-horgony kártya a HŐSre
    // költözött (lásd a `hogyan` kártya kommentjét lentebb) — ugyanaz a szabály, ami a
    // train-mai fejlécét is version-bumpre kötelezte (lásd ott a v4 komment): az élő oldalt
    // rosszul leíró/elavult horgonyú kártyát azok is újra kell hogy lássák, akik a régit már
    // látták.
    version: 2,
    label: 'Terhelés',
    cards: [
      {
        kind: 'intro', spot: 'i-heti', orb: 's-orb',
        title: 'Ez a Terhelés.',
        voice: 'A heti munkád egy képben: mennyi van meg belőle, és melyik izomcsoport hol tart.',
      },
      {
        // T12 (mezo-88iwa.13): a napsáv elhagyta a lapot — a horgony a HŐSRE költözött, és
        // vele a kártya szövege is. A napokra való lépés Mai saját napsávjában él tovább.
        kind: 'hogyan', spot: 'i-edzes', orb: 's-orb-figyel', anchor: 'heti-terheles',
        title: 'A nagy szám a heti munkád.',
        voice: 'A sáv azt mutatja, mennyi van meg abból, amit a hét kér. Lentebb a test térképe és az izomcsoportok — egy csoportra koppintva látod a részleteit.',
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
          // T10 Task 2 (mezo-88iwa.11): a lap neve ma „Terv" (navModel.ts), nem
          // „Mesociklusok" — a chip a fül SAJÁT nevét viseli, ahogy minden más chip.
          { to: '/train/mesocycles', label: 'Terv', icon: 'i-meso', effect: 'a heti napok forrása' },
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
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
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
        ],
      },
    ],
  },
  {
    id: 'train-exercises',
    route: '/train/exercises',
    tier: 'T2',
    // v2 (parity P2 Task 4, mezo-lf3cv): a lap a teljes katalógus lett — a top-ötös
    // sorrend és a ▶ videógomb tűnt el róla, a szöveg követi. Az „Új gyakorlat" felvétel
    // MEGMARADT (fix round 1): a lista végén álló szaggatott `.pl-add` sor az egyetlen
    // helye az egész appban, ezért a „hogyan" kártya külön ki is mondja, hol van.
    version: 2,
    label: 'Gyakorlatok',
    cards: [
      {
        kind: 'intro', spot: 'i-polc', orb: 's-orb',
        title: 'Ez a Gyakorlatok.',
        voice: 'Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.',
      },
      {
        kind: 'hogyan', spot: 'i-video', orb: 's-orb-figyel', anchor: 'exercises-kereso',
        title: 'Keress vagy szűrj.',
        voice: 'Írj a keresőbe névre vagy izomra, vagy szűrj izomcsoportra a gombokkal — egy sorra koppintva megnyílik a gyakorlat egész története. Ha valamit nem találsz, a lista legalján a „＋ Új gyakorlat" sorral veheted fel.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés közben, tervezéskor.',
        voice: 'Edzés közben egy mozdulat utánanézéséért, tervezéskor a válogatásért. A rekordok maguktól frissülnek a szettjeidből.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A katalógus a hozzávaló.',
        voice: 'A blokk-tervező innen válogat, a rekordokat pedig az élő edzés szettjei írják.',
        links: [
          // T10 Task 2 (mezo-88iwa.11): a gyakorlat-válogatás nem a Terv lapon, hanem az
          // Edzéstervek mögötti új-terv-összeállításban történik — a chip oda mutat, és a
          // lap mai nevét viseli.
          { to: '/train/mesocycles/konyvtar', label: 'Edzéstervek', icon: 'i-polc', effect: 'innen válogat az új terv' },
          { to: '/train/session', label: 'Indítás', icon: 'i-lang', effect: 'a szettek ide íródnak' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
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
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
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
        title: 'Ez a futó terved.',
        voice: 'Nem lista: maga a terv, ami most megy — hányadik héten jársz, és mi vár rád a hét minden napján.',
      },
      {
        // NOTE (T9 fix round 1, mezo banned-word sweep): this `fogalom` card predates
        // this task's copy — its „A blokk a motor." title/voice is left as-is, OUT of
        // scope per the review finding. Every other card in this section is this task's
        // OWN new copy and has been swept for „blokk"/„rámpa" below.
        kind: 'fogalom', spot: 's-hegycel', orb: 's-orb',
        title: 'A blokk a motor.',
        voice: 'A heti edzéseidet az aktív blokk osztja ki — itt látod, hol tart, és itt születik a következő.',
        ...fogalom('mezociklus'),
      },
      {
        kind: 'hogyan', spot: 'i-naplo', orb: 's-orb-figyel', anchor: 'mesociklus-mosaic',
        title: 'Két ajtó a terv alatt.',
        voice: 'A **Melyik izmod hol tart** az aktív hétbe visz, az **Edzéstervek** pedig a terveidhez, a történetedhez és az új terv indításához.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Tervváltáskor.',
        voice: 'Terv végén és új indításakor — hét közben elég a Heti. Két lezárt futam össze is vethető.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul minden hét.',
        voice: 'A terv adja a heti napokat, a napok a mai edzésed — a lánc itt kezdődik.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'az aktív hét' },
          { to: '/train/templates', label: 'Sablonjaid', icon: 'i-polc' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
        ],
      },
    ],
  },
  // ── T3 aloldal: az Edzéstervek könyvtár (mezo-88iwa.11, T10 Task 2) ─────────
  // T3, nem T2: ez nem a spec §10 fő-aloldal listájának tagja, hanem egy koppintással
  // elért aloldal a Terv mögött — auto-open helyett a fejléc ?-e nyitja.
  {
    id: 'train-konyvtar',
    route: '/train/mesocycles/konyvtar',
    tier: 'T3',
    version: 1,
    label: 'Edzéstervek',
    cards: [
      {
        kind: 'intro', spot: 'i-polc', orb: 's-orb',
        title: 'Ez az Edzéstervek.',
        voice: 'Egy helyen a terveid: ami most fut, ami utána jön, és ami már mögötted van.',
      },
      {
        kind: 'hogyan', spot: 'i-stack', orb: 's-orb-figyel', anchor: 'konyvtar-hero',
        title: 'A fejléc négy száma.',
        voice: 'Fent egy sorban látod, mennyi fut, mennyi vár, hány sablonod van és hány futamot zártál le. Lentebb ezek nyílnak meg egyesével.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Tervváltáskor.',
        voice: 'Amikor a mostani terved a végéhez ér, vagy valami újat szeretnél kipróbálni.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul az új terv.',
        voice: 'Sablonból pár koppintás, nulláról egy képernyő — a kész terv a Terv lapon fut tovább.',
        links: [
          { to: '/train/mesocycles', label: 'Terv', icon: 'i-meso', effect: 'itt fut a kész terv' },
          { to: '/train/templates', label: 'Sablonjaid', icon: 'i-polc', effect: 'amiből indíthatsz' },
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
        title: 'Itt már élesben vagy.',
        voice: 'A mai edzés összes gyakorlata egy listában: mi vár, milyen súlyokkal, hány szett — és rögtön logolhatsz.',
      },
      {
        kind: 'fogalom', spot: 'i-retegek', orb: 's-orb',
        title: 'Egy szám a tartalékról.',
        voice: 'Minden szettnél a súly és az ismétlés mellé egy RIR-t is jegyzünk. Ebből tudja Mezo, mennyire volt nehéz.',
        ...fogalom('rir'),
      },
      {
        kind: 'hogyan', spot: 'i-lang', orb: 's-orb-figyel', anchor: 'session-start',
        title: 'Szettről szettre.',
        voice: 'Minden kártya egy gyakorlat: beírod a súlyt és az ismétlést, köztük pihenő-időzítő jár. A fejléc ⋯ gombja alatt lakik a küldetés, a jegyzet és a szett-igazítás — kilépni pedig bármikor lehet.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A terem küszöbén.',
        voice: 'Ahogy belépsz a terembe, az edzés már fut. Az összegzés a végén magától jön.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Az edzés nyomot hagy.',
        voice: 'A szettjeid a rekordjaidat írják, a lezárt alkalom pedig bármikor visszanézhető.',
        links: [
          { to: '/train/exercises', label: 'Gyakorlatok', icon: 'i-polc', effect: 'rekordok és videók' },
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
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
          { to: '/train/mai', label: 'Mai nap', icon: 'i-edzes' },
        ],
      },
    ],
  },
]
