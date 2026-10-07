// ============================================================
// Mezo · az Én hub kalauza (mezo-gb1s.3; „Hol tartok" — mezo-lhqw7).
// A hub-tile-reorg elve (docs/features/insights.md §2.0): „Mezo = minden AI-származtatott,
// Én = a személyes adat". A kalauz ezt mondja ki laikusul. A fogalom-kártya a `szint` marad:
// a felső sáv első adata a szint és az XP — és mert az ADR 0010 szerint az XP visszajelzés,
// nem fizetség; ezt ki kell mondani, mielőtt a user pontvadászatnak nézi.
// mezo-lhqw7: a hub új felépítését írja le (a `version` nem változott — a már látott kalauz nem
// nyílik újra magától; ha az kell, az külön döntés) — felső sáv → A heted → Életvonal → Célok
// állása → Fejlődés · Emberek. A Súly/Alvás a Test fülre, a Célok és a Napló saját fülre került.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const ME_KALAUZ: KalauzEntry[] = [
  {
    id: 'me',
    route: '/me',
    tier: 'T1',
    version: 1,
    label: 'Én',
    cards: [
      {
        kind: 'intro', spot: 'i-emberek', orb: 's-orb',
        title: 'Ez az Én: hol tartasz.',
        voice: 'Itt egy pillantásra látod, hol tartasz: a lezárt heted, a súlyod tizenkét hete és a céljaid állása. Minden, ami rólad szól, és nem a mai napról.',
      },
      {
        kind: 'fogalom', spot: 'i-growth', orb: 's-orb',
        title: 'A felső sáv a szintedet mutatja.',
        voice: 'Minden logolás ad egy kis XP-t, ebből lesz a szinted. Mellette a sorozatod és az érméid — semmi nem áll meg attól, ha egy nap kimarad.',
        ...fogalom('szint'),
      },
      {
        kind: 'hogyan', spot: 'i-erme', orb: 's-orb-figyel', anchor: 'me-idhero',
        title: 'A tetején te vagy.',
        voice: 'A felső sávban a neved, a szinted, az XP-d, a sorozatod és az érméid — egy koppintás, és a Fejlődés nyílik. Alatta „A heted": az utolsó lezárt hét pontszáma, mi ment jól és mire figyelj, onnan a heti elemzés.',
      },
      {
        kind: 'hogyan', spot: 'i-suly', orb: 's-orb',
        title: 'Lejjebb az életvonalad.',
        voice: 'Az Életvonal a súlyod tizenkét hete: az arany pontokra koppintva megtudod, mi történt ott, a szaggatott vonal a célod felé mutat, alatta az alvásod sávja. Utána a Célok állása: a súlycélod és az életcéljaid, mindegyik az irányával.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Ritkán, de megéri.',
        voice: 'Hetente egyszer bőven elég — hétfő reggel új heted érkezik. A súly és az alvás a Test fülön, a Célok és a Napló a saját fülén vár.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen tanul a többi oldal.',
        voice: 'A célod és az alvásod a Nap és a Fuel számításaiba is beleszól. Amit itt beállítasz, ott lesz látható.',
        links: [
          { to: '/me/weight', label: 'Test · Súly', icon: 'i-suly' },
          { to: '/me/sleep', label: 'Test · Alvás', icon: 'i-alvas', effect: 'a napszakok horgonya' },
          { to: '/me/goals', label: 'Célok', icon: 'i-cel' },
          { to: '/me/growth', label: 'Fejlődés', icon: 'i-growth' },
          { to: '/me/people', label: 'Emberek', icon: 'i-emberek' },
          { to: '/settings', label: 'Beállítások', icon: 'i-beallitas' },
        ],
      },
    ],
  },
]
