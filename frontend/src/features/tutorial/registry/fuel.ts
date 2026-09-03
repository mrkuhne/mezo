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
]
