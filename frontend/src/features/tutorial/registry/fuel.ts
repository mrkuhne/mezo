import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const FUEL_KALAUZ: KalauzEntry[] = [
  {
    id: 'fuel',
    route: '/fuel',
    tier: 'T1',
    version: 1,
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
        voice: 'A tested minden nap kap egy **keretet** — ennyi energia fér bele. A gyűrű fent mutatja, hol tartunk.',
        ...fogalom('makro'),
      },
      {
        kind: 'hogyan', spot: 'i-reggeli', orb: 's-orb-figyel', anchor: 'fuel-log',
        title: 'Logolni egy koppintás.',
        voice: 'A **+** gombbal vagy a Logolás-csempéből. Elég egy fotó vagy egy mondat — „egy tál zabkása banánnal" — a többit Mezo kitalálja.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Evés után, pár másodperc.',
        voice: 'Nem szükséges tökéletesnek lennie. Ha kimaradt egy étkezés, később is **pótoljuk** — a nap ettől nem lesz kevesebb.',
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
  // ── T2 aloldalak (mezo-gb1s.6) ──────────────────────────────────────────────
  // Címke = a hub-csempe saját szava (FuelMaiPage.tsx:150-160), szó szerint. A `/fuel/plan`
  // és a `/fuel/gyogyszer` szándékosan horgony nélkül él: az előbbi beszélő kártyái
  // adat-feltételesek, az utóbbinak két külön arca van (üres vs. követett ciklus) —
  // a „Mutasd meg a képernyőn" ott némán degradál (KalauzSheet.tsx:64).
  // A spec §10 T2-listájának „Gyors logolás sheet" (`quickinput`) tétele NEM ide tartozik:
  // nem route, tehát a Provider route-effektje nem tudja triggerelni — komponens-esemény
  // seam kellene hozzá, ami motor-munka; az S4-be csúszott (epic-komment).
  {
    id: 'fuel-log',
    route: '/fuel/log',
    tier: 'T2',
    version: 1,
    label: 'Logolás',
    cards: [
      {
        kind: 'intro', spot: 'i-fuel', orb: 's-orb',
        title: 'Ez a napi logolás.',
        voice: 'A napod étkezési ablakai egymás alatt, blokkonként. Fent a keret: mennyi energia ment be eddig, és mennyi fér még.',
      },
      {
        kind: 'fogalom', spot: 'i-reggeli', orb: 's-orb',
        title: 'Az ablak a nap ritmusa.',
        voice: 'Az ablakok a napod típusából jönnek — edzésnapon máshol vannak, mint pihenőn. Ha kimarad egy, a nap attól még egész.',
        ...fogalom('ablak'),
      },
      {
        kind: 'hogyan', spot: 's-energia', orb: 's-orb-figyel', anchor: 'log-napvalto',
        title: 'A nap tetején lépkedsz.',
        voice: 'A dátum nyilai hét napot visznek vissza, és a régebbi nap **Pótlás** módban nyílik. Alatta ablakonként egy blokk: a gombja átvisz a logolóra.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Evés után, amíg friss.',
        voice: 'Pár másodperc a legjobb pillanatban. Ha kimaradt, a Pótlás egy hétig nyitva áll — visszamenőleg is pontozódik.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul a tétel.',
        voice: 'A blokk átvisz a logoló oldalra, ahol a tételek összeállnak — a keretet pedig a Terv és az edzésnapod alakítja.',
        links: [
          { to: '/fuel/log/uj', label: 'Új tétel', icon: 'i-fuel', effect: 'itt áll össze az étkezés' },
          { to: '/fuel/plan', label: 'Terv', icon: 'i-rend' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    id: 'fuel-log-uj',
    route: '/fuel/log/uj',
    tier: 'T2',
    version: 1,
    label: 'Új tétel',
    cards: [
      {
        kind: 'intro', spot: 'i-ebed', orb: 's-orb',
        title: 'Itt áll össze egy étkezés.',
        voice: 'Tételenként rakod hozzá, amit ettél. A fejléc mutatja, melyik ablakba és melyik napra könyvelődik.',
      },
      {
        kind: 'hogyan', spot: 'i-kamra', orb: 's-orb-figyel', anchor: 'log-forrasok',
        title: 'Három forrás, egy tányér.',
        voice: '**Kamra** grammra, **Recept** adagra, **✨ AI** fotóból vagy egy mondatból. Keverheted őket ugyanabban az étkezésben.',
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
          { to: '/fuel/log', label: 'Logolás', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    id: 'fuel-terv',
    route: '/fuel/plan',
    tier: 'T2',
    version: 1,
    label: 'Terv',
    cards: [
      {
        kind: 'intro', spot: 'i-rend', orb: 's-orb',
        title: 'Ez a heti terv.',
        voice: 'Egy képernyő a hetedről: kalória-átlag, protein-napok, stack-adherencia, edzés- és sportnapok.',
      },
      {
        kind: 'hogyan', spot: 'i-heti', orb: 's-orb-figyel',
        title: 'A számsor a heti valóság.',
        voice: 'Minden szám a tényleges logjaidból jön. Ami még nincs mérve, gondolatjelet kap — sose kitalált értéket.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Hét végén, egyszer.',
        voice: 'Vasárnap este vagy hétfő reggel: egy pillantás arra, merre ment a hét. Napi döntéshez a Logolás a hely.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A hét két oldalról áll össze.',
        voice: 'Az étkezés-oldalt a Napló és a Stack tölti, az edzés-oldalt a heti edzésterved.',
        links: [
          { to: '/fuel/naplo', label: 'Napló', icon: 'i-naplo' },
          { to: '/fuel/stack', label: 'Stack', icon: 'i-stack' },
          { to: '/train/week', label: 'Heti terv', icon: 'i-edzes', effect: 'edzésnap → +keret' },
        ],
      },
    ],
  },
  {
    id: 'fuel-stack',
    route: '/fuel/stack',
    tier: 'T2',
    version: 1,
    label: 'Stack',
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
        voice: 'A tételeket a Kamrából adod hozzá, az adherencia pedig a heti Tervben köszön vissza.',
        links: [
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra', effect: 'innen adsz hozzá' },
          { to: '/fuel/plan', label: 'Terv', icon: 'i-rend', effect: 'heti adherencia' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    id: 'fuel-receptek',
    route: '/fuel/recipes',
    tier: 'T2',
    version: 1,
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
        voice: '**Mind · Reggeli · Ebéd · Vacsi · ★** — minden szegmens a saját darabszámát viseli. Fent a **✨ Műhely** beszélgetve rak össze újat, a **＋ Új** kézzel.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor másodszor főznéd.',
        voice: 'Ha egy étel visszatér, mentsd receptként. Utána a logolása pár másodperc, a fit-jelvény pedig magától megjön.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A recept tovább él.',
        voice: 'A hozzávalók a polcodról jönnek, a kész recept pedig a logolóban vár egy adagra.',
        links: [
          { to: '/fuel/recipes/muhely', label: 'Műhely', icon: 'i-muhely', effect: 'AI-val összerakva' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
          { to: '/fuel/log/uj', label: 'Új tétel', icon: 'i-fuel', effect: 'adagra logolva' },
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
        kind: 'hogyan', spot: 'i-polc', orb: 's-orb-figyel', anchor: 'kamra-hero',
        title: 'Fent a leltár mérete.',
        voice: 'A hős a tételek számát viseli, alatta típusra váltasz és keresel. A **⚙ Szűrők** a kategóriákat szűkíti, a kártya pedig a tétel saját oldalára visz.',
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
          { to: '/fuel/stack', label: 'Stack', icon: 'i-stack' },
          { to: '/fuel/recipes', label: 'Receptek', icon: 'i-recept' },
          { to: '/fuel/log/uj', label: 'Új tétel', icon: 'i-fuel' },
        ],
      },
    ],
  },
  {
    id: 'fuel-gyogyszer',
    route: '/fuel/gyogyszer',
    tier: 'T2',
    version: 1,
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
        voice: 'A napi kiegészítők a Stackben laknak; a heti Terv csak akkor mutat gyógyszer-csíkot, ha van élő ciklus.',
        links: [
          { to: '/fuel/stack', label: 'Stack', icon: 'i-stack' },
          { to: '/fuel/plan', label: 'Terv', icon: 'i-rend' },
          { to: '/fuel/kamra', label: 'Kamra', icon: 'i-kamra' },
        ],
      },
    ],
  },
  {
    id: 'fuel-naplo',
    route: '/fuel/naplo',
    tier: 'T2',
    version: 1,
    label: 'Napló',
    cards: [
      {
        kind: 'intro', spot: 'i-naplo', orb: 's-orb',
        title: 'Ez a fuel-napló.',
        voice: 'A mai étkezéseid egymás alatt, mindegyik a saját pontszámával. Fent a napi átlag.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A pontszám nem osztályzat.',
        voice: 'Azt méri, mennyire illett az étkezés a mai napodhoz — a keretedhez és a makróidhoz. A bontás a számra koppintva nyílik.',
        ...fogalom('pontszam'),
      },
      {
        kind: 'hogyan', spot: 'i-minta', orb: 's-orb-figyel', anchor: 'naplo-hero',
        title: 'Ha nincs mit mutatni, gondolatjel áll.',
        voice: 'A hős az AI-átlagot viseli, de pontozatlan napon **—** kerül oda. Kitalált nulla sose.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A pontokból minta lesz.',
        voice: 'Ami itt naponta összeáll, a heti Tervben és Mezo mintáiban köszön vissza.',
        links: [
          { to: '/fuel/log', label: 'Logolás', icon: 'i-fuel', effect: 'innen jön az adat' },
          { to: '/fuel/plan', label: 'Terv', icon: 'i-rend' },
          { to: '/mezo/patterns', label: 'Minták', icon: 'i-minta' },
        ],
      },
    ],
  },
]
