import type { JournalNote } from '@/data/journal/journalTypes'

/** Mock seed: 5 free-prose Hungarian entries spanning two months (2026-07 + 2026-08), newest
 * first — so Task 7's month-grouping visibly renders two group headers in mock mode. */
export const mockJournalNotes: JournalNote[] = [
  {
    id: 'jn5',
    occurredOn: '2026-08-15',
    text: 'Ma reggel nagyon nyugodt voltam a meeting előtt — a légzőgyakorlat tényleg segít.',
    source: 'quickinput',
    createdAt: '2026-08-15T08:20:00Z',
  },
  {
    id: 'jn4',
    occurredOn: '2026-08-10',
    text: 'Este későig fent voltam telefonozva, holnap korábban le kell feküdnöm.',
    source: 'ritual',
    createdAt: '2026-08-10T22:05:00Z',
  },
  {
    id: 'jn3',
    occurredOn: '2026-08-02',
    text: 'Jó hét volt mögöttünk, az edzések is stabilak maradtak a meleg ellenére.',
    source: 'quickinput',
    createdAt: '2026-08-02T19:40:00Z',
  },
  {
    id: 'jn2',
    occurredOn: '2026-07-22',
    text: 'Kicsit stresszes volt a hét vége, de sikerült időben lezárni a projektet.',
    source: 'quickinput',
    createdAt: '2026-07-22T21:15:00Z',
  },
  {
    id: 'jn1',
    occurredOn: '2026-07-08',
    text: 'Szép nyári reggel volt, jólesett a séta munkába menet.',
    source: 'ritual',
    createdAt: '2026-07-08T07:50:00Z',
  },
]
