// ============================================================
// Mezo · Fuel kalauz-bejegyzések (mezo-gb1s.6 · újrahorgonyozva: Fuel Titanium S5, mezo-qt5q).
//
// A18/E11: a Kalauz minden Fuel-lépése ÉLŐ oldalra és a lapon TÉNYLEG ott lévő horgonyra mutat.
// Egy leváltott útvonalra mutató lépés halott, de az is halott, amelyik élő útvonalon RÉGI
// felületet ír le — a copy-drift ugyanolyan törés, mint a 404.
//
// Ami S5-ben megszűnt, és hova került:
//   • `fuel-log` (`/fuel/log`) — a napi lista a MAI lap kanonikus része (A10), ezért ez a
//     bejegyzés BEOLVADT a `fuel` T1-be: a dátum-lapozás és a blokkok onnan szólnak.
//   • `fuel-naplo` (`/fuel/naplo`) — a napi minőség a Trendekbe költözött (C5), ezért a
//     pontszám-fogalom kártyája a Trendek-bejegyzésben él tovább.
//   • `fuel-terv` (`/fuel/plan`) — a heti kép a Trendek (C1/C6): UGYANEZ a bejegyzés maradt,
//     csak az útvonala, a címkéje és a kártyái követték a lapot. Az `id` szándékosan NEM
//     változott (a seen-store kulcsa), a `version` viszont nőtt, hogy a felhasználó egyszer
//     újra lássa az új lapot.
//   • `fuel-konyha` (`/fuel/konyha`) — ÚJ bejegyzés: a negyedik cél-lap, a Receptek és a Kamra
//     szülője, eddig kalauz nélkül állt.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const FUEL_KALAUZ: KalauzEntry[] = [
  {
    id: 'fuel',
    route: '/fuel',
    tier: 'T1',
    // v2 (mezo-qt5q): a Mai lap a Titán energiaműszert, az étkezés-blokkokat és a közös
    // dátum-lapozást hordozza — a `/fuel/log` bejegyzés ide olvadt.
    version: 2,
    label: 'Fuel',
    cards: [
      {
        kind: 'intro', spot: 'i-fuel', orb: 's-orb',
        title: 'Ez a Fuel.',
        voice: 'Itt követjük, hogy mit eszel. Nem diéta és nem számolgatás — inkább **térkép**: mennyi energia ment be ma, és mennyi fér még.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A napi keret és a makrók.',
        voice: 'A tested minden nap kap egy **keretet** — ennyi energia fér bele. Fent az energiaív és a négy gyűrű mutatja, hol tartunk.',
        ...fogalom('makro'),
      },
      {
        kind: 'hogyan', spot: 'i-reggeli', orb: 's-orb-figyel', anchor: 'fuel-log',
        title: 'A nap étkezései blokkonként.',
        voice: 'Minden étkezési ablak saját blokkot kap, és a blokk gombja visz a naplózóra. Egy mentett étkezés a pontszámával együtt a saját oldalára nyílik.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Evés után, pár másodperc.',
        voice: 'A dátum nyilai hét napot visznek vissza, és a régebbi nap **Pótlás** módban nyílik. Ha kimaradt egy étkezés, később is pótoljuk — a nap ettől nem lesz kevesebb.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Nem sziget.',
        voice: 'Edzésnapon több keret jár. A súlyod és az alvásod is innen kap adatot — és a chatben Mezo ebből tud tanácsot adni.',
        links: [
          { to: '/train', label: 'Edzés', icon: 'i-edzes', effect: 'edzésnap → +keret' },
          { to: '/me/weight', label: 'Súly', icon: 'i-suly' },
          { to: '/me/sleep', label: 'Alvás', icon: 'i-alvas' },
          { to: '/mezo/chat', label: 'Mezo chat', icon: 'i-mezo' },
        ],
      },
    ],
  },
  // ── T2 aloldalak (mezo-gb1s.6, S5-ben újrahorgonyozva) ──────────────────────
  // Címke = a lap SAJÁT szava (a fül-sáv `navModel.ts` nevei), szó szerint. A
  // `/fuel/gyogyszer` szándékosan horgony nélkül él: KÉT teljesen külön arca van (üres vs.
  // követett ciklus), egyikre sem lehet őszintén rámutatni — a „Mutasd meg a képernyőn"
  // ott némán degradál (KalauzSheet.tsx:64).
  // A spec §10 T2-listájának „Gyors logolás sheet" (`quickinput`) tétele NEM ide tartozik:
  // nem route, tehát a Provider route-effektje nem tudja triggerelni — komponens-esemény
  // seam kellene hozzá, ami motor-munka.
  {
    id: 'fuel-log-uj',
    route: '/fuel/log/uj',
    tier: 'T2',
    // v2 (mezo-qt5q): S1c NÉGY útra cserélte a három forrást — a kártya szövege követte.
    version: 2,
    label: 'Naplózás',
    cards: [
      {
        kind: 'intro', spot: 'i-ebed', orb: 's-orb',
        title: 'Itt áll össze egy étkezés.',
        voice: 'Tételenként rakod hozzá, amit ettél. A fejléc mutatja, melyik ablakba és melyik napra könyvelődik.',
      },
      {
        kind: 'fogalom', spot: 'i-reggeli', orb: 's-orb',
        title: 'Az ablak a nap ritmusa.',
        voice: 'Az ablakok a napod típusából jönnek — edzésnapon máshol vannak, mint pihenőn. A naplózó azt jelzi, melyik ablak esedékes most.',
        ...fogalom('ablak'),
      },
      {
        // A horgony a négy fül sávja (`FuelLogModes.tsx` `.fmx-logmodes`) — pontosan az, amit
        // ez a kártya leír. A LogFlow-overlayben ugyanaz az elem a MealComposeren ül.
        kind: 'hogyan', spot: 'i-kamra', orb: 's-orb-figyel', anchor: 'log-forrasok',
        title: 'Négy út egy tányérig.',
        voice: '**Fotó**, **Hang**, **Gépelés** és a **Szokásosak** — a fülekkel váltasz köztük. A kamera nyit elsőre, mert a fotó a leggyorsabb út.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor kész a tányér.',
        voice: 'Elég egy fotó vagy egy mondat — a finomítás ráér. A mentés visszavisz a napi listára.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A tételek máshonnan jönnek.',
        voice: 'A polcod és a receptjeid töltik fel a listát — amit egyszer felvettél, itt egy koppintás.',
        links: [
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra', effect: 'grammra pontos tételek' },
          { to: '/fuel/recipes', label: 'Receptek', icon: 'i-recept', effect: 'egész tányér egyben' },
          { to: '/fuel', label: 'Mai', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    // Az id a `/fuel/plan` Terv-bejegyzéséé volt; a lap a Trendekbe költözött (C1/C5/C6), a
    // kulcs viszont stabil marad — lásd a fájl fejlécét.
    id: 'fuel-terv',
    route: '/fuel/trendek',
    tier: 'T2',
    version: 2,
    label: 'Trendek',
    cards: [
      {
        kind: 'intro', spot: 'i-trend', orb: 's-orb',
        title: 'Ez a heti kép.',
        voice: 'Egy képernyő a hetedről: a napok a keretedhez mérve, mindegyiken a nap pontja. Alatta a hosszabb táv és a mintázatok.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A pontszám nem osztályzat.',
        voice: 'Azt méri, mennyire illett az étkezés a napodhoz — a keretedhez és a makróidhoz. A nap bontása a sávra koppintva nyílik.',
        ...fogalom('pontszam'),
      },
      {
        kind: 'hogyan', spot: 'i-heti', orb: 's-orb-figyel', anchor: 'trendek-heti',
        title: 'A hét napjai a kerethez mérve.',
        voice: 'Minden sáv a tényleges logjaidból jön, a szám fölötte a nap pontja. Amiről nincs adat, kimarad az átlagokból — kitalált nulla sosem áll ott.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Hét végén, egyszer.',
        voice: 'Vasárnap este vagy hétfő reggel: egy pillantás arra, merre ment a hét. Napi döntéshez a Mai a hely.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A hét több oldalról áll össze.',
        voice: 'Az étkezés-oldalt a Mai napjai és a Kiegészítők töltik, az edzés-oldalt a heti edzésterved.',
        links: [
          { to: '/fuel', label: 'Mai', icon: 'i-fuel', effect: 'innen jön az adat' },
          { to: '/fuel/stack', label: 'Kiegészítők', icon: 'i-stack' },
          { to: '/train/week', label: 'Heti terv', icon: 'i-edzes', effect: 'edzésnap → +keret' },
          { to: '/mezo/patterns', label: 'Minták', icon: 'i-minta' },
        ],
      },
    ],
  },
  {
    id: 'fuel-konyha',
    route: '/fuel/konyha',
    tier: 'T2',
    version: 1,
    label: 'Konyha',
    cards: [
      {
        kind: 'intro', spot: 'i-fazek', orb: 's-orb',
        title: 'Ez a Konyha.',
        voice: 'A receptjeid és a kamrád egy helyen. Innen épül fel minden, amit később grammra logolsz.',
      },
      {
        kind: 'hogyan', spot: 'i-recept', orb: 's-orb-figyel', anchor: 'konyha-felvetel',
        title: 'Két felvétel a lap tetején.',
        voice: '**Recept mentése** a saját szavaiddal, **Új elem a kamrába** a címke fotójából vagy egy termék linkjéből. Alattuk a Receptműhely, a receptjeid és a polcod posztere.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevásárlás vagy főzés után.',
        voice: 'Amit gyakran eszel, vedd fel egyszer. Utána minden naplózás gyorsabb, és a makrói is pontosabbak.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen nyílik a két lista.',
        voice: 'A poszterek a saját teljes oldalukra visznek, a Műhely pedig beszélgetve rak össze új receptet.',
        links: [
          { to: '/fuel/recipes', label: 'Receptek', icon: 'i-recept' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
          { to: '/fuel/recipes/muhely', label: 'Műhely', icon: 'i-muhely', effect: 'AI-val összerakva' },
        ],
      },
    ],
  },
  {
    id: 'fuel-stack',
    route: '/fuel/stack',
    tier: 'T2',
    // v2 (mezo-qt5q): a Protokoll és a Kezelés EGY lap lett (D3), a Terv pedig Trendek.
    version: 2,
    label: 'Kiegészítők',
    cards: [
      {
        kind: 'intro', spot: 'i-stack', orb: 's-orb',
        title: 'Ez a napi stack.',
        voice: 'A kiegészítőid a nap ívére kiterítve: reggel, edzés körül, este. Nincs külön bekapcsolás — ez a lista maga az élő protokoll.',
      },
      {
        kind: 'fogalom', spot: 'i-lombik', orb: 's-orb',
        title: 'A zóna mondja meg, mikor.',
        voice: 'Pihenőnapon az edzés-zónák maguktól átköltöznek, vagy kimaradnak. A „miért ide" indoklás mindig a zónán ül.',
        ...fogalom('stack'),
      },
      {
        kind: 'hogyan', spot: 's-energia', orb: 's-orb-figyel', anchor: 'stack-hero',
        title: 'Fent a mai állás.',
        voice: 'A fejben a bevett és az összes adag aránya áll. Lent a zónákban pipálod, amit bevettél — minden módosítás azonnal mentődik.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevételkor, egy koppintás.',
        voice: 'A pipa akkor kerül a sorra, amikor tényleg lement. A kihagyott adag üresen marad — a napi arány így marad őszinte.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A polcról jön, a hétbe fut.',
        voice: 'A tételeket a Kamrából adod hozzá, a szerkesztés a Protokoll-lapon él, az adherencia pedig a Trendekben köszön vissza.',
        links: [
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra', effect: 'innen adsz hozzá' },
          { to: '/fuel/stack/protocol', label: 'Protokoll', icon: 'i-lombik', effect: 'mit miért, és a szerkesztés' },
          { to: '/fuel/trendek', label: 'Trendek', icon: 'i-trend', effect: 'heti adherencia' },
        ],
      },
    ],
  },
  {
    id: 'fuel-receptek',
    route: '/fuel/recipes',
    tier: 'T2',
    // v2 (mezo-qt5q): S4 a Műhely-gombot a Konyha főlapjára vitte — a kártya követte.
    version: 2,
    label: 'Receptek',
    cards: [
      {
        kind: 'intro', spot: 'i-recept', orb: 's-orb',
        title: 'Ez a receptkönyv.',
        voice: 'A visszatérő ételeid egy helyen, makrókkal együtt. Logoláskor egy koppintás az egész tányér.',
      },
      {
        kind: 'hogyan', spot: 'i-muhely', orb: 's-orb-figyel', anchor: 'receptek-tabs',
        title: 'Szűrj a sávval.',
        voice: '**Mind · Reggeli · Ebéd · Vacsi · ★** — minden szegmens a saját darabszámát viseli. A **＋ Új** kézzel ment receptet; a Receptműhely a Konyha főlapjáról nyílik.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor másodszor főznéd.',
        voice: 'Ha egy étel visszatér, mentsd receptként. Utána a logolása pár másodperc, a fit-jelvény pedig magától megjön.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A recept tovább él.',
        voice: 'A hozzávalók a polcodról jönnek, a kész recept pedig a naplózóban vár egy adagra.',
        links: [
          { to: '/fuel/konyha', label: 'Konyha', icon: 'i-fazek', effect: 'innen nyílik a Műhely' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
          { to: '/fuel/log/uj', label: 'Naplózás', icon: 'i-fuel', effect: 'adagra logolva' },
        ],
      },
    ],
  },
  {
    id: 'fuel-kamra',
    route: '/fuel/kamra',
    tier: 'T2',
    version: 1,
    label: 'Kamra',
    cards: [
      {
        kind: 'intro', spot: 'i-kamra', orb: 's-orb',
        title: 'Ez a kamra.',
        voice: 'A polcod: ételek, supplementek, stimulánsok egy leltárban. Innen logolsz grammra, és innen épül a stack.',
      },
      {
        // S4 (mezo-hygp): a hős-szám a Konyha hub Kamra-poszterére költözött, ezért ez a
        // kártya a típus-szűrőkre mutat — arra, ami ezen a lapon valóban ott van.
        kind: 'hogyan', spot: 'i-polc', orb: 's-orb-figyel', anchor: 'kamra-tabs',
        title: 'Típusra váltasz, és keresel.',
        voice: 'A szűrők mindegyike a saját darabszámát viseli, fölöttük a kereső. A **Szűrők** a kategóriákat szűkíti, a csempe pedig a tétel saját oldalára visz.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevásárlás után.',
        voice: 'Amit gyakran eszel, vedd fel egyszer. Utána minden logolás gyorsabb — és a makrói is pontosabbak.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A polc három helyre dolgozik.',
        voice: 'A tételeidből lesz a napi stack, a receptek hozzávalói és a grammra pontos log.',
        links: [
          { to: '/fuel/stack', label: 'Kiegészítők', icon: 'i-stack' },
          { to: '/fuel/recipes', label: 'Receptek', icon: 'i-recept' },
          { to: '/fuel/log/uj', label: 'Naplózás', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    id: 'fuel-gyogyszer',
    route: '/fuel/gyogyszer',
    tier: 'T2',
    // v2 (mezo-qt5q): a heti kontextus a Trendek, nem a visszavont Terv-lap.
    version: 2,
    label: 'Gyógyszer',
    cards: [
      {
        kind: 'intro', spot: 'i-injekcio', orb: 's-orb',
        title: 'Ez a gyógyszer-oldal.',
        voice: 'Ha rendszeres gyógyszert szedsz, itt fut a ciklusa és a beadásai. Ha nem, ez az oldal üresen áll — és így van rendben.',
      },
      {
        kind: 'hogyan', spot: 'i-lombik', orb: 's-orb-figyel',
        title: 'Egy ciklus, hét cella.',
        voice: 'A **＋ Gyógyszer felvétele** kérdez nevet, dózist, beviteli módot és kadenciát. Utána a hét cellája mutatja, hol tart a ciklus.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A beadás napján.',
        voice: 'A **＋ Beadás** rögzíti az adagot, és a ciklus onnan számol tovább. Elmaradt beadásból nem lesz riasztás.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Külön él a stacktől.',
        voice: 'A napi kiegészítők a Kiegészítők lapon laknak; a Trendek heti képe csak akkor mutat gyógyszer-csíkot, ha van élő ciklus.',
        links: [
          { to: '/fuel/stack', label: 'Kiegészítők', icon: 'i-stack' },
          { to: '/fuel/trendek', label: 'Trendek', icon: 'i-trend' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
        ],
      },
    ],
  },
]
