import type { JournalNote } from '@/data/journal/journalTypes'
import { localDateString } from '@/shared/lib/dates'

/** Mock seed: 5 fixed free-prose Hungarian entries spanning two months (2026-07 + 2026-08)
 * — so Task 7's month-grouping visibly renders two group headers in mock mode — plus one
 * date-relative "today" entry (jn-today, mezo-idz2) appended below when the date doesn't
 * already collide with a fixed row; it forms its own (floating) third month group whenever
 * the suite runs outside July/August. */
const mockJournalNotesFixed: JournalNote[] = [
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

// mezo-idz2: dátum-relatív mai bejegyzés — a DayOrb napló-jele mock módban is jelen van.
// Egy befagyasztott órájú vizuális futásban a „ma" egybeeshet egy meglévő fix sorral,
// ezért a beszúrás idempotens: csak akkor adjuk hozzá, ha erre a napra még nincs sor,
// majd a csökkenő („newest first") dátumsorrendet a beszúrás helyétől függetlenül
// explicit rendezéssel biztosítjuk.
// A skip-ág is MÁSOLATOT ad vissza: a `.sort()` helyben rendez, tehát a nyers ternary
// magát a modul-szintű `*Fixed` konstanst mutálná (mezo-tzid).
const todayIsoJournal = localDateString()
export const mockJournalNotes: JournalNote[] = (
  mockJournalNotesFixed.some((n) => n.occurredOn === todayIsoJournal)
    ? [...mockJournalNotesFixed]
    : [...mockJournalNotesFixed, {
        id: 'jn-today',
        occurredOn: todayIsoJournal,
        text: 'Ma jólesett a délutáni séta — utána sokkal tisztább fejjel ültem vissza dolgozni.',
        source: 'quickinput' as const,
        createdAt: `${todayIsoJournal}T18:40:00Z`,
      }]
).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
