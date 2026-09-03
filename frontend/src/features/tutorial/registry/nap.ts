// ============================================================
// Mezo · a Nap hub kalauza (mezo-gb1s.3).
// ARC-SEMLEGES: a NapHubPage napszaktól függően három különböző hőst és csempe-készletet
// rendel (:272 reggel, :321 nap, :385 este) + egy anchor-mód variánst (:220). Egyetlen
// kártya sem állít olyat, ami csak EGY arcban igaz — az Életjel-gyűrű például csak a
// „nap" arcban létezik, ezért az a kapcsolat-chipek közé került, nem a törzsszövegbe.
// A fogalom-kártya témája maga a napszakosság: egyszerre igaz és a Mezo egyik legsajátabb
// fogalma (spec S2a-5).
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const NAP_KALAUZ: KalauzEntry[] = [
  {
    id: 'nap',
    route: '/nap',
    tier: 'T1',
    version: 1,
    label: 'Nap',
    cards: [
      {
        kind: 'intro', spot: 'i-nap', orb: 's-orb',
        title: 'Ez a Nap.',
        voice: 'Itt fut össze a mai napod: mit csináltál, mi van hátra, hogy vagy. Ide térünk vissza reggel, délben és este.',
      },
      {
        kind: 'fogalom', spot: 's-reggel', orb: 's-orb',
        title: 'Az oldal veled együtt változik.',
        voice: 'Reggel az éjszakádat mutatja, napközben a keretet és a teendőket, este a lezárást. Ugyanaz a hely, más arc.',
        ...fogalom('napszak'),
      },
      {
        kind: 'hogyan', spot: 'i-checkin', orb: 's-orb-figyel', anchor: 'nap-hero',
        title: 'Fentről lefelé.',
        voice: 'A felső csempe mindig a soron következő dolgot mutatja — alatta a küldetések és a check-in várnak egy koppintásra.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Reggel és este, egy percre.',
        voice: 'Reggel megnézed, mi vár rád; este lezárod, ami volt. Napközben úgyis ide dob vissza minden.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul minden.',
        voice: 'A Nap csak összefoglal — a részletek a saját oldalaikon élnek. Egy koppintás, és ott vagy.',
        links: [
          { to: '/nap/eletjel', label: 'Életjel', icon: 'i-eletjel', effect: 'hogy vagy ma' },
          { to: '/nap/kuldetesek', label: 'Küldetések', icon: 'i-kihivas', effect: 'a nap három ajánlata' },
          { to: '/nap/rutin', label: 'Rutin', icon: 'i-rend' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'a keret innen jön' },
        ],
      },
    ],
  },
  // ── T2 aloldalak (mezo-gb1s.5) ──────────────────────────────────────────────
  // Címke = az oldal saját megjelenített neve, szó szerint. A horgony-nevek az
  // anchors.test.tsx-szel közösek; a /nap/kuldetesek szándékosan horgony nélkül él
  // (a küldetés-kártyák adat-feltételesek, üres nap is létezik).
  {
    id: 'nap-uzenetek',
    route: '/nap/uzenetek',
    tier: 'T2',
    version: 1,
    label: 'Üzenetek',
    cards: [
      {
        kind: 'intro', spot: 'i-level', orb: 's-orb',
        title: 'Ez Mezo üzenőfala.',
        voice: 'Napközben ide írok neked: reggeli briefing, észrevételek, Életjel-jelzések. Egy szálban, időrendben — semmi nem vész el.',
      },
      {
        kind: 'hogyan', spot: 'i-minta', orb: 's-orb-figyel', anchor: 'uzenetek-tabs',
        title: 'Két fül, egy szál.',
        voice: 'Az **Üzenetek** a napod fonala, az **Életjelek** a gyűrűk jelzései. A régebbi kártyák összecsukva várnak — koppintásra nyílnak.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor a fejléc jelez.',
        voice: 'Ha az üzenet-gombon szám világít, itt vár valami. Reggel úgyis erre visz az út — a briefing ide érkezik.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A szál két irányba nyílik.',
        voice: 'Ami itt csak jelzés, a chatben beszélgetéssé válik — és a gyűrűk, amikről szó esik, egy koppintásra vannak.',
        links: [
          { to: '/mezo/chat', label: 'Mezo chat', icon: 'i-mezo', effect: 'kérdezz vissza bármire' },
          { to: '/nap/eletjel', label: 'Életjel', icon: 'i-eletjel' },
          { to: '/nap', label: 'Nap', icon: 'i-nap' },
        ],
      },
    ],
  },
  {
    id: 'nap-rutin',
    route: '/nap/rutin',
    tier: 'T2',
    version: 1,
    label: 'Rutin',
    cards: [
      {
        kind: 'intro', spot: 's-reggel', orb: 's-orb',
        title: 'Ez a Rutin.',
        voice: 'A reggeli és az esti szokásaid laknak itt, pipálható sorokban. A nap két horgonya — indítás és lezárás.',
      },
      {
        kind: 'hogyan', spot: 'i-rend', orb: 's-orb-figyel', anchor: 'rutin-lista',
        title: 'Pipa vagy log — a sor tudja.',
        voice: 'A kézi szokást a pipával jelölöd; ami logból származik — víz, étkezés, alvás —, magától záródik, a sora a logolójába visz.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'A nap két szélén.',
        voice: 'Reggel ébredés után, este lefekvés előtt. A lánc ereje a visszatérésből épül — pár pillanat, nem szertartás.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Itt pipálsz, máshol épül.',
        voice: 'A szokásaidat a Rutin-műhelyben rakod össze — itt csak éled őket. A pipák XP-ként is visszaköszönnek.',
        links: [
          { to: '/me/rutin', label: 'Rutin-műhely', icon: 'i-rend', effect: 'itt építed a szokásaid' },
          { to: '/me/growth', label: 'Growth', icon: 'i-growth', effect: 'a pipák XP-t érnek' },
          { to: '/nap', label: 'Nap', icon: 'i-nap' },
        ],
      },
    ],
  },
  {
    id: 'nap-kuldetesek',
    route: '/nap/kuldetesek',
    tier: 'T2',
    version: 1,
    label: 'Napi küldetések',
    cards: [
      {
        kind: 'intro', spot: 's-hajtas', orb: 's-orb',
        title: 'Ezek a napi küldetések.',
        voice: 'Mezo minden nap három ajánlatot sorsol a napodhoz — apró lökések, XP-vel a végén.',
      },
      {
        kind: 'fogalom', spot: 'i-kihivas', orb: 's-orb',
        title: 'A jutalom visszajelzés.',
        voice: 'A teljesült küldetés XP-t ír jóvá, az XP a szintedet építi. Ennyi — se bolt, se határidő-pánik.',
        ...fogalom('szint'),
      },
      {
        kind: 'hogyan', spot: 'i-lang', orb: 's-orb-figyel',
        title: 'Magától záródik.',
        voice: 'A küldetés a logjaidból teljesül — edzel, logolsz, és a pipa megérkezik. Naponta egy Csere jár, ha egy ajánlat ma nem passzol.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Reggel egy pillantás.',
        voice: 'Reggel megnézed a mai hármat, este látod, mi zárult. Ami kimaradt, csendben lejár — bukás nincs.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A küldetés csak ajtó.',
        voice: 'Amit ajánl, az edzésben és a logolásban történik meg — az XP pedig a Growth-ban gyűlik.',
        links: [
          { to: '/train', label: 'Edzés', icon: 'i-edzes' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel' },
          { to: '/me/growth', label: 'Growth', icon: 'i-growth', effect: 'ide folyik az XP' },
        ],
      },
    ],
  },
  {
    id: 'nap-checkin',
    route: '/nap/checkin',
    tier: 'T2',
    version: 1,
    label: 'Check-in',
    cards: [
      {
        kind: 'intro', spot: 'i-checkin', orb: 's-orb',
        title: 'Ez a check-in.',
        voice: 'Napi négy pillanatkép arról, hogy vagy: energia, stressz, testi és mentális állapot — egy-egy gyors skálán.',
      },
      {
        kind: 'hogyan', spot: 'i-eletjel', orb: 's-orb-figyel', anchor: 'checkin-sor',
        title: 'A forró sor a tiéd.',
        voice: 'A soron következő slot kiemelve vár, a **Kitöltöm** nyitja a mérőt. A kész sorok a mért értékeiket mutatják.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Négyszer, fél percre.',
        voice: 'Reggel, délelőtt, délután, este — a slot jelzi, mikor esedékes. A kimaradt pótolható, a nap ettől még egész.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Ebből tanul a társ.',
        voice: 'A pillanatképeidből állnak össze a minták — és az Életjel is innen kapja a hangulat-jeleit.',
        links: [
          { to: '/nap/eletjel', label: 'Életjel', icon: 'i-eletjel' },
          { to: '/mezo/patterns', label: 'Minták', icon: 'i-minta', effect: 'innen is táplálkoznak' },
          { to: '/nap', label: 'Nap', icon: 'i-nap' },
        ],
      },
    ],
  },
  {
    id: 'nap-eletjel',
    route: '/nap/eletjel',
    tier: 'T2',
    version: 1,
    label: 'Életjel',
    cards: [
      {
        kind: 'intro', spot: 'i-eletjel', orb: 's-orb',
        title: 'Ez az Életjel.',
        voice: 'Hat gyűrű, hat alapszükséglet — együtt egy kép arról, hogy vagy ma.',
      },
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'Hat gyűrű, egy állapot.',
        voice: 'A gyűrűk napközben telnek, ahogy logolsz és élsz. Nem pontszám — jelzés, mi kér ma figyelmet.',
        ...fogalom('eletjel'),
      },
      {
        kind: 'hogyan', spot: 'i-viz', orb: 's-orb-figyel', anchor: 'eletjel-gyuru',
        title: 'Koppints a jelre.',
        voice: 'A víz helyben logol egy adagot, a többi csempe a saját mérőjét nyitja. A nagy gyűrű a hat jel átlaga.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor megtorpansz.',
        voice: 'Napközben, ha elbizonytalanodsz: mi hiányzik éppen? A gyűrűk jeleznek — sürgetni nem fognak.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'A jelek tovább utaznak.',
        voice: 'Amikor egy gyűrű figyelmet kér, Mezo üzen róla — a táplálás pedig a Fuelből érkezik.',
        links: [
          { to: '/nap/uzenetek', label: 'Üzenetek', icon: 'i-level', effect: 'ide jönnek a jelzések' },
          { to: '/nap/checkin', label: 'Check-in', icon: 'i-checkin' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel' },
        ],
      },
    ],
  },
]
