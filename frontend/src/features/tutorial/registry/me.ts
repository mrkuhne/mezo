// ============================================================
// Mezo · az Én hub kalauza (mezo-gb1s.3).
// A hub-tile-reorg elve (docs/features/insights.md §2.0): „Mezo = minden AI-származtatott,
// Én = a személyes adat". A kalauz ezt mondja ki laikusul. A fogalom-kártya a `szint`,
// mert az identitás-hős legfeltűnőbb eleme az XP-gyűrű — és mert az ADR 0010 szerint az
// XP visszajelzés, nem fizetség; ezt ki kell mondani, mielőtt a user pontvadászatnak nézi.
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
        title: 'Ez az Én.',
        voice: 'Itt vagy te: a szinted, a céljaid, a súlyod, az alvásod és a beállítások. Minden, ami rólad szól, és nem a mai napról.',
      },
      {
        kind: 'fogalom', spot: 'i-growth', orb: 's-orb',
        title: 'A gyűrű a szintedet mutatja.',
        voice: 'Minden logolás ad egy kis XP-t, és a gyűrű ebből telik meg. Semmi nem áll meg attól, ha egy nap kimarad.',
        ...fogalom('szint'),
      },
      {
        kind: 'hogyan', spot: 'i-erme', orb: 's-orb-figyel', anchor: 'me-idhero',
        title: 'A tetején te vagy.',
        voice: 'A felső blokkban a szinted, a címed és a sorozatod látszik — alatta a céljaid, még lejjebb a súly, az alvás és a napló csempéi.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Ritkán, de megéri.',
        voice: 'Hetente egyszer bőven elég. Ha valami változik — új cél, más ébresztő —, itt állítjuk be.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen tanul a többi oldal.',
        voice: 'A célod és az alvásod a Nap és a Fuel számításaiba is beleszól. Amit itt beállítasz, ott lesz látható.',
        links: [
          { to: '/me/weight', label: 'Súly', icon: 'i-suly' },
          { to: '/me/sleep', label: 'Alvás', icon: 'i-alvas', effect: 'a napszakok horgonya' },
          { to: '/me/growth', label: 'Growth', icon: 'i-growth' },
          { to: '/me/beallitasok', label: 'Beállítások', icon: 'i-beallitas' },
        ],
      },
    ],
  },
]
