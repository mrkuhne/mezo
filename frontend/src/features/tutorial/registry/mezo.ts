// ============================================================
// Mezo · a Mezo hub kalauza (mezo-gb1s.3).
// A tab a társ „agya": chat, minták, memoár, tudástár, előrejelzések, kísérletek,
// diagnózis, memória (docs/features/insights.md). A laikusnak a legfontosabb üzenet,
// hogy Mezo nem a semmiből tanácsol — a saját adataiból olvas; ezért a fogalom-kártya
// a `minta`, és a hogyan-kártya a chat-nyitóra mutat, ami feltétel nélkül renderel.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const MEZO_KALAUZ: KalauzEntry[] = [
  {
    id: 'mezo',
    route: '/mezo',
    tier: 'T1',
    version: 1,
    label: 'Mezo',
    cards: [
      {
        kind: 'intro', spot: 's-orb', orb: 's-orb',
        title: 'Ez Mezo.',
        voice: 'Itt lakik a társad: amit megtanult rólad, és amit ebből gondol. Beszélgethetsz vele, vagy csak elolvashatod, mit vett észre.',
      },
      {
        kind: 'fogalom', spot: 'i-minta', orb: 's-orb',
        title: 'Amit észrevesz.',
        voice: 'Mezo nem a semmiből tanácsol — a saját napjaidból olvas ki ismétlődő összefüggéseket, és megmutatja őket.',
        ...fogalom('minta'),
      },
      {
        kind: 'hogyan', spot: 'i-mezo', orb: 's-orb-figyel', anchor: 'mezo-chat',
        title: 'Kérdezz, ahogy egy embertől.',
        voice: 'A felső sáv egy sima beszélgetés-indító: írd be, ami eszedbe jut, vagy mondd fel hangosan. Mezo ismeri a mai napodat, nem a nulláról indul.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor elakadsz, vagy csak kíváncsi vagy.',
        voice: 'Nincs napi adag belőle. Hetente egyszer viszont megéri ránézni a mintákra és a memoárra — abból látszik a nagyobb ív.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Egy agy, sok szoba.',
        voice: 'A mintáktól a memoárig ugyanaz a tudás jelenik meg más formában. Válaszd azt, ami épp érdekel.',
        links: [
          { to: '/mezo/chat', label: 'Chat', icon: 'i-mezo' },
          { to: '/mezo/patterns', label: 'Minták', icon: 'i-minta', effect: 'amit észrevett' },
          { to: '/mezo/memoir', label: 'Memoár', icon: 'i-memoar', effect: 'a heted, elmesélve' },
          { to: '/mezo/knowledge', label: 'Tudástár', icon: 'i-tudas', effect: 'amit rólad megjegyzett' },
        ],
      },
    ],
  },
]
