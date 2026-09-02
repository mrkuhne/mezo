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
        voice: 'A felső csempe mindig a soron következő dolgot mutatja — alatta a küldetések, a rutin és a check-in várnak egy koppintásra.',
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
]
