// ============================================================
// Mezo · az Edzés hub kalauza (mezo-gb1s.3).
// A hős hat számított variánst vehet fel (terv nélküli szellem, gym, sport, futás, saját,
// pihenőnap — EdzesHubPage.tsx:109-235), ezért a „hogyan" kártya arról beszél, hogy a
// felső csempe MINDIG a mai napot mutatja, nem arról, hogy MI van benne.
// A fogalom-kártya a mezociklus, mert a terv nélküli új user első akadálya pont ez a szó:
// a hős szellem-variánsa azt mondja neki, hogy „tervezz egy mesociklust".
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const TRAIN_KALAUZ: KalauzEntry[] = [
  {
    id: 'train',
    route: '/train',
    tier: 'T1',
    version: 1,
    label: 'Edzés',
    cards: [
      {
        kind: 'intro', spot: 's-edzes', orb: 's-orb',
        title: 'Ez az Edzés.',
        voice: 'Itt él a mai edzésed, a heti terved és minden, amit eddig megemeltél. A tervezéstől a sorozat lelogolásáig egy hely.',
      },
      {
        kind: 'fogalom', spot: 'i-meso', orb: 's-orb',
        title: 'A terv több hétre szól.',
        voice: 'Az edzés nem napról napra születik: egy mezociklus előre kiosztja a heteket, és Mezo ebből rakja ki a mai napodat.',
        ...fogalom('mezociklus'),
      },
      {
        kind: 'hogyan', spot: 's-hajtas', orb: 's-orb-figyel', anchor: 'train-hero',
        title: 'A hős mindig a mai nap.',
        voice: 'A legfelső csempe azt mutatja, mi van ma — edzés, sport, futás vagy pihenő —, és egy koppintással indul. Terv nélkül itt ajánlunk egyet.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés előtt és közben.',
        voice: 'Indulás előtt megnézed, mi jön; közben a sorozatokat itt vezetjük. Utána a Heti és a Medálok mutatják, mi gyűlt össze.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Az edzés máshol is látszik.',
        voice: 'Egy edzésnapon több energia jár, és a súlyod is másképp mozog. Mezo ezeket összeköti.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'a hét ritmusa' },
          { to: '/train/mesocycles', label: 'Mezociklus', icon: 'i-meso', effect: 'a többhetes terv' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'edzésnap → +keret' },
          { to: '/train/medals', label: 'Medálok', icon: 'i-erme' },
        ],
      },
    ],
  },
]
