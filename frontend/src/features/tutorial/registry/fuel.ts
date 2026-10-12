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
//
// Folyadék F5 (mezo-n4wf5.5): a Fuel minden lapja új arcot kapott (világos lapok, a szám egy szint: tál, kémcső,
// edény, fazék), és a szavak is változtak („stack" → kiegészítők, „Vacsi" → Vacsora, „AI" → Mezo, „kadencia" →
// gyakoriság, a pont a tízes skálán áll). A kártyák a RÉGI lapot írták le (energiaív és gyűrűk, sávok, poszterek,
// zónák), ezért a szövegük követte a lapot, és a `version` nőtt: az élő oldalt rosszul leíró kártyát azok is lássák
// újra, akik a régit már látták (bible F1.10). A kalauz egyelőre CSAK magyarul szól (a kétnyelvűsítése külön szelet).
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const FUEL_KALAUZ: KalauzEntry[] = [
  {
    id: 'fuel',
    route: '/fuel',
    tier: 'T1',
    // v2 (mezo-qt5q): a `/fuel/log` bejegyzés ide olvadt. v3 (Folyadék F5): a hős a nap tálja, a makrók öt kémcső.
    version: 3,
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
        voice: 'A tested minden nap kap egy **keretet**: ennyi energia fér bele. Fent a nap tálja mutatja, mennyit ettél és mennyi fér még; alatta öt kémcső áll: fehérje, szénhidrát, zsír, víz és rost.',
        ...fogalom('makro'),
      },
      {
        kind: 'hogyan', spot: 'i-reggeli', orb: 's-orb-figyel', anchor: 'fuel-log',
        title: 'A nap étkezései blokkonként.',
        voice: 'Minden étkezési ablak saját blokkot kap, a csészéje a blokk keretét mutatja, a gombja pedig a naplózóra visz. A mentett étkezés sora a saját oldalára nyílik, a pontja Mezo értékelésére.',
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
    // v2 (mezo-qt5q): S1c NÉGY útra cserélte a három forrást — a kártya szövege követte. v3 (Folyadék F5): a hős a
    // nap tálja azzal, ami még belefér; a cím az ablak neve.
    version: 3,
    label: 'Naplózás',
    cards: [
      {
        kind: 'intro', spot: 'i-ebed', orb: 's-orb',
        title: 'Itt áll össze egy étkezés.',
        voice: 'Tételenként rakod hozzá, amit ettél. A cím az ablak neve, fölötte a nap áll; a tál mutatja, mennyi fér még bele.',
      },
      {
        kind: 'fogalom', spot: 'i-reggeli', orb: 's-orb',
        title: 'Az ablak a nap ritmusa.',
        voice: 'Az ablakok a napod típusából jönnek — edzésnapon máshol vannak, mint pihenőn. A naplózó azt jelzi, melyik ablak esedékes most.',
        ...fogalom('ablak'),
      },
      {
        // A horgony a négy forrás gombsora (`FuelLogModes.tsx` `.fg-shell`) — pontosan az, amit
        // ez a kártya leír. A LogFlow-overlayben ugyanaz az elem a MealComposeren ül.
        kind: 'hogyan', spot: 'i-kamra', orb: 's-orb-figyel', anchor: 'log-forrasok',
        title: 'Négy út egy tányérig.',
        voice: '**Fotó**, **Kamra**, **Recept** és **Szokásosak** — innen rögtön hozzáadhatsz. A szövegmező és a mikrofon végig kéznél van; a fotó és a szöveg elemzése az Elemzés gombbal indul.',
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
    // v3 (Folyadék F5): a hét hét EDÉNY (nem sáv), a pont a tízes skálán áll.
    version: 3,
    label: 'Trendek',
    cards: [
      {
        kind: 'intro', spot: 'i-trend', orb: 's-orb',
        title: 'Ez a heti kép.',
        voice: 'Egy képernyő a hetedről: hét edény, mindegyik a nap keretéig telik, fölötte a nap pontja. Alatta a hét számai, a hosszabb táv és a mintázatok.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A pontszám nem osztályzat.',
        voice: 'Azt méri, mennyire illett az étkezés a napodhoz: a keretedhez és a makróidhoz. A nap bontása az edényre koppintva nyílik.',
        ...fogalom('pontszam'),
      },
      {
        kind: 'hogyan', spot: 'i-heti', orb: 's-orb-figyel', anchor: 'trendek-heti',
        title: 'A hét napjai a kerethez mérve.',
        voice: 'Minden edény a tényleges logjaidból telik, a szaggatott vonal a keret, a szám fölötte a nap pontja. Amiről nincs adat, kimarad az átlagokból: kitalált nulla sosem áll ott.',
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
    // v2 (Folyadék F5): a hős az üres fazék (meghívó a Műhelybe), a két felvétel alatta áll, a poszterek sorok lettek.
    version: 2,
    label: 'Konyha',
    cards: [
      {
        kind: 'intro', spot: 'i-fazek', orb: 's-orb',
        title: 'Ez a Konyha.',
        voice: 'A receptjeid és a kamrád egy helyen. Fent az üres fazék a Műhelybe hív: te mondod a célt, Mezo a hozzávalót.',
      },
      {
        kind: 'hogyan', spot: 'i-recept', orb: 's-orb-figyel', anchor: 'konyha-felvetel',
        title: 'Két gyors felvétel.',
        voice: '**Recept mentése** a saját szavaiddal, **Új elem a kamrába** a címke fotójából vagy egy termék linkjéből. Alattuk a receptjeid és a polcod sora.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevásárlás vagy főzés után.',
        voice: 'Amit gyakran eszel, vedd fel egyszer. Utána minden naplózás gyorsabb, és a makrói is pontosabbak.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen nyílik a két lista.',
        voice: 'A két sor a saját teljes oldalára visz, a Műhely pedig beszélgetve rak össze új receptet.',
        links: [
          { to: '/fuel/recipes', label: 'Receptek', icon: 'i-recept' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
          { to: '/fuel/recipes/muhely', label: 'Műhely', icon: 'i-muhely', effect: 'Mezóval összerakva' },
        ],
      },
    ],
  },
  {
    id: 'fuel-stack',
    route: '/fuel/stack',
    tier: 'T2',
    // v2 (mezo-qt5q): a Protokoll és a Kezelés EGY lap lett (D3), a Terv pedig Trendek. v3 (Folyadék F5): a „stack"
    // szó kiegészítők lett, a zóna idősáv, a hős a nap adagjai kapszulákban.
    version: 3,
    label: 'Kiegészítők',
    cards: [
      {
        kind: 'intro', spot: 'i-stack', orb: 's-orb',
        title: 'Ezek a mai kiegészítőid.',
        voice: 'A kiegészítőid a nap ívére kiterítve: reggel, edzés körül, este. Nincs külön bekapcsolás: ez a lista maga az élő protokoll.',
      },
      {
        kind: 'fogalom', spot: 'i-lombik', orb: 's-orb',
        title: 'Az idősáv mondja meg, mikor.',
        voice: 'Pihenőnapon az edzés körüli idősávok maguktól átköltöznek, vagy kimaradnak. Hogy egy elem miért oda került, azt a Protokoll lap mondja meg.',
        ...fogalom('stack'),
      },
      {
        kind: 'hogyan', spot: 's-energia', orb: 's-orb-figyel', anchor: 'stack-hero',
        title: 'Fent a mai állás.',
        voice: 'Fent a mai adagok kapszulákban, napszakonként: ami tele van, azt már bevetted. A nagy gomb a következőt pipálja ki; lent az idősávokban bármelyik sort kipipálhatod, és minden azonnal mentődik.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevételkor, egy koppintás.',
        voice: 'A pipa akkor kerül a sorra, amikor tényleg lement. A kihagyott adag üresen marad: a napi arány így marad őszinte.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A polcról jön, a hétbe fut.',
        voice: 'Az elemek a Kamrából jönnek, a szerkesztés a Protokoll lapon él, az pedig, hogy mennyire tartod, a Trendekben köszön vissza.',
        links: [
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra', effect: 'innen adsz hozzá' },
          { to: '/fuel/stack/protocol', label: 'Protokoll', icon: 'i-lombik', effect: 'mit miért, és a szerkesztés' },
          { to: '/fuel/trendek', label: 'Trendek', icon: 'i-trend', effect: 'a heted képe' },
        ],
      },
    ],
  },
  {
    id: 'fuel-receptek',
    route: '/fuel/recipes',
    tier: 'T2',
    // v2 (mezo-qt5q): S4 a Műhely-gombot a Konyha főlapjára vitte — a kártya követte. v3 (Folyadék F5): a szűrő hat
    // pirula (Vacsora, Uzsonna, Csillagos szóval), a hős a legtöbbet evett receptjeid.
    version: 3,
    label: 'Receptek',
    cards: [
      {
        kind: 'intro', spot: 'i-recept', orb: 's-orb',
        title: 'Ez a receptkönyv.',
        voice: 'A visszatérő ételeid egy helyen, makrókkal együtt. Logoláskor egy koppintás az egész tányér.',
      },
      {
        kind: 'hogyan', spot: 'i-muhely', orb: 's-orb-figyel', anchor: 'receptek-tabs',
        title: 'Szűrj a pirulákkal.',
        voice: '**Mind · Reggeli · Ebéd · Vacsora · Uzsonna · Csillagos**: mindegyik a saját darabszámát viseli. Fent az **Új recept** kézzel ment receptet; a Műhely a Konyha főlapjáról nyílik.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor másodszor főznéd.',
        voice: 'Ha egy étel visszatér, mentsd receptként. Utána a logolása pár másodperc, Mezo értékelése pedig magától megjön.',
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
    // v2 (Folyadék F5): a szűrő öt pirula (Mind · Étel · Kiegészítő · Stimuláns · Gyógyszer), a három fejléc-gomb a
    // hős gombja lett (+ Új tétel · Import · Közös katalógus).
    version: 2,
    label: 'Kamra',
    cards: [
      {
        kind: 'intro', spot: 'i-kamra', orb: 's-orb',
        title: 'Ez a kamra.',
        voice: 'A polcod: ételek, kiegészítők, stimulánsok és gyógyszerek egy leltárban. Innen logolsz grammra, és innen kerülnek be a kiegészítőid.',
      },
      {
        // S4 (mezo-hygp): a hős-szám a Konyha hub Kamra-poszterére költözött, ezért ez a
        // kártya a típus-szűrőkre mutat — arra, ami ezen a lapon valóban ott van.
        kind: 'hogyan', spot: 'i-polc', orb: 's-orb-figyel', anchor: 'kamra-tabs',
        title: 'Típusra váltasz, és keresel.',
        voice: '**Mind · Étel · Kiegészítő · Stimuláns · Gyógyszer**: a szűrők a saját darabszámukat viselik, fölöttük a kereső, a csempe pedig a tétel saját oldalára visz. Új tételt a lap tetején veszel fel: **+ Új tétel**, **Import** vagy **Közös katalógus**.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Bevásárlás után.',
        voice: 'Amit gyakran eszel, vedd fel egyszer. Utána minden logolás gyorsabb, és a makrói is pontosabbak.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A polc három helyre dolgozik.',
        voice: 'A tételeidből lesznek a napi kiegészítőid, a receptek hozzávalói és a grammra pontos log.',
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
    // v2 (mezo-qt5q): a heti kontextus a Trendek, nem a visszavont Terv-lap. v3 (Folyadék F5): „kadencia" →
    // gyakoriság, a ciklus kapszulasor, a gombok új szavai (Gyógyszer felvétele · + Beadás).
    version: 3,
    label: 'Gyógyszer',
    cards: [
      {
        kind: 'intro', spot: 'i-injekcio', orb: 's-orb',
        title: 'Ez a gyógyszer-oldal.',
        voice: 'Ha rendszeres gyógyszert szedsz, itt fut a ciklusa és a beadásai. Ha nem, ez az oldal üresen áll — és így van rendben.',
      },
      {
        kind: 'hogyan', spot: 'i-lombik', orb: 's-orb-figyel',
        title: 'Egy ciklus, napról napra.',
        voice: 'A **Gyógyszer felvétele** nevet, adagot, beviteli módot és gyakoriságot kér. Utána a ciklus kapszulái mutatják, hányadik napnál tartasz.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A beadás napján.',
        voice: 'A **+ Beadás** rögzíti az adagot, és a ciklus onnan számol tovább. Elmaradt beadásból nem lesz riasztás.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Külön él a kiegészítőktől.',
        voice: 'A napi kiegészítők a Kiegészítők lapon laknak; a gyógyszer ciklusa és a beadásai ezen a lapon élnek.',
        links: [
          { to: '/fuel/stack', label: 'Kiegészítők', icon: 'i-stack' },
          { to: '/fuel/trendek', label: 'Trendek', icon: 'i-trend' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
        ],
      },
    ],
  },
]
