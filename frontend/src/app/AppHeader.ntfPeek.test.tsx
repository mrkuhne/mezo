// ============================================================
// Mezo · AppHeader — az értesítés-panel sorrendje, időbélyege és olvasottság-jelzése
// (mezo-tdzy), majd a görgethető, teljes szélességű panel szűrői és korlátja (mezo-g9fz).
//
// A teljes feed oldal (`/me/ertesitesek`) minden sora napcsoportot, időpontot és olvasatlan-
// pöttyöt kap; a fejléc peekje ezekből EGYET sem adott, ráadásul a nyers érkezési sorrend első
// hármát vette. A feed hookot mockoljuk (az `AppHeader.dayOrbTone.test.tsx` mintája): a mock
// seed három MAI, mind olvasatlan sora nem tudná megkülönböztetni a nap-címkéket egymástól,
// és az olvasott ág egyáltalán nem szerepelne a panelben.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AppHeader } from '@/app/AppHeader'
import type { AppNotificationView } from '@/data/types'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

const row = (
  id: string, at: Date, readAt: string | null,
  kind: AppNotificationView['kind'] = 'memory_note',
): AppNotificationView => ({
  id, kind, title: `cím ${id}`, body: `szöveg ${id}`,
  deeplink: '/insights', occurredAt: at.toISOString(), readAt,
})

// Szándékosan ÖSSZEKEVERT érkezési sorrend: a peek rendezése látszódjon, ne a `slice` szerencséje.
const hoisted = vi.hoisted(() => ({ items: [] as unknown[] }))
const markAllRead = vi.fn(() => Promise.resolve())
vi.mock('@/data/notification/feedHooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/notification/feedHooks')>()
  return {
    ...actual,
    useNotificationFeed: () => ({ items: hoisted.items, isPending: false }),
    useNotificationFeedActions: () => ({ markAllRead }),
  }
})

beforeEach(() => {
  markAllRead.mockClear()
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // Ugyanaz a fagyasztott pillanat, mint az `AppHeader.test.tsx`-ben: 13:00 → `nowFace === 'nap'`.
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0))
  hoisted.items = [
    row('regi', new Date(2026, 7, 15, 19, 5), '2026-08-15T20:00:00.000Z'),
    row('ma', new Date(2026, 7, 30, 6, 20), null),
    row('tegnap', new Date(2026, 7, 29, 21, 40), '2026-08-29T22:00:00.000Z'),
  ]
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function openPeek() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap']}>
        <TutorialProvider>
          <MezoThreadProvider>
            <AppHeader />
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  return [...container.querySelectorAll<HTMLElement>('.nap-ntfrow')]
}

function rows() {
  return [...document.querySelectorAll<HTMLElement>('.nap-ntfrow')]
}
function titles() {
  return rows().map((r) => r.querySelector('.nap-ntf-t')?.textContent)
}
/** A chip-sor egy gombja a CÍMKÉJE szerint (az elérhető név a címke + darabszám span-ekből
 *  tapad össze, tehát `getByRole(name)` itt megbízhatatlan). */
function chip(label: string) {
  const found = [...document.querySelectorAll<HTMLElement>('.nap-ntftabs button')]
    .find((b) => b.querySelector('span')?.textContent === label)
  if (!found) throw new Error(`nincs ilyen chip: ${label}`)
  return found
}
function chips() {
  return [...document.querySelectorAll<HTMLElement>('.nap-ntftabs button')]
    .map((b) => [...b.querySelectorAll('span')].map((x) => x.textContent).join(' '))
}

test('a panel a legújabb sort viszi elöl, nem az érkezési sorrendet', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.querySelector('.nap-ntf-t')?.textContent))
    .toEqual(['cím ma', 'cím tegnap', 'cím regi'])
})

// A dátumot a nap-csoportcímke hordozza (a teljes feed oldal idiómája), a sor csak az órát —
// a `notificationStamp` napelőtagja duplázna a fölötte álló címkével (mezo-g9fz).
test('a napot csoportcímke viszi, a sor a puszta órát', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.querySelector('.nap-ntf-when')?.textContent))
    .toEqual(['06:20', '21:40', '19:05'])
  expect([...document.querySelectorAll('.nap-ntfday')].map((d) => d.textContent))
    .toEqual(['Ma', 'Tegnap', 'aug. 15.'])
})

test('az olvasatlan sor pöttyöt és felolvasható jelzést kap, az olvasott egyiket sem', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.classList.contains('unread'))).toEqual([true, false, false])
  expect(rows[0].querySelector('.nap-ntf-dot')).not.toBeNull()
  expect(rows[0].textContent).toContain('Olvasatlan')
  expect(rows[1].querySelector('.nap-ntf-dot')).toBeNull()
  expect(rows[1].textContent).not.toContain('Olvasatlan')
})

// `dialog`, nem `menu`: a panel szűrő-chipeket és egy „Mind olvasott" gombot is tartalmaz,
// amik nem `menuitem`-ek — egy `role="menu"` alattuk hazug kisegítő fát adna (mezo-g9fz).
test('a panel dialógus, nem menü', async () => {
  await openPeek()
  expect(screen.getByRole('dialog', { name: 'Értesítések' })).toBeInTheDocument()
})

// ── mezo-g9fz: görgethető, teljes szélességű panel — szűrők, korlát, „Mind olvasott" ──

test('a panel a LEGÚJABB 30 sort viszi, nem az egész feedet', async () => {
  // 42 sor, növekvő időrendben — a korlátnak a rendezés UTÁN kell vágnia, különben a
  // legrégebbi 30-at mutatná (a `slice(0, 3)` régi hibájának nagyobb kiadása).
  hoisted.items = Array.from({ length: 42 }, (_, i) =>
    row(`n${String(i).padStart(2, '0')}`, new Date(2026, 7, 30, 1, i), null))
  await openPeek()
  expect(rows()).toHaveLength(30)
  expect(titles()[0]).toBe('cím n41')
  expect(titles().at(-1)).toBe('cím n12')
})

test('a chip-sor csak a jelenlévő kategóriákat rajzolja, darabszámmal', async () => {
  hoisted.items = [
    row('a', new Date(2026, 7, 30, 9, 0), null, 'pattern_signal'),
    row('b', new Date(2026, 7, 30, 8, 0), null, 'hypothesis_new'),
    row('c', new Date(2026, 7, 30, 7, 0), '2026-08-30T08:00:00.000Z', 'goal_suggestion'),
  ]
  await openPeek()
  // Nincs `Tudás`/`Kísérletek`/`Jóslatok`/`Összegzés` chip: egy üres kategória-chip olyan
  // szűrőt ígérne, ami nulla találatot ad.
  expect(chips()).toEqual(['Mind 3', 'Olvasatlan 2', 'Minták 2', 'Célok 1'])
})

test('a kategória-chip a saját fajtáira szűkít', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  hoisted.items = [
    row('minta', new Date(2026, 7, 30, 9, 0), null, 'pattern_signal'),
    row('cel', new Date(2026, 7, 30, 8, 0), null, 'goal_suggestion'),
  ]
  await openPeek()
  await user.click(chip('Célok'))
  expect(titles()).toEqual(['cím cel'])
  // A chipek közül név szerint keresni csapda: a `Mind` chip elérhető neve a szomszédos
  // span-ekből tapad össze (`Mind2`), és a `/^Mind/` a „Mind olvasott" gombra is illeszkedne.
  await user.click(chip('Mind'))
  expect(titles()).toEqual(['cím minta', 'cím cel'])
})

test('az Olvasatlan chip a valóban olvasatlan sorokra szűkít', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await openPeek()
  await user.click(chip('Olvasatlan'))
  expect(titles()).toEqual(['cím ma'])
})

// Ez a gomb korábban SEHOL nem létezett a fejlécben: olvasottá tenni csak a teljes feed oldalra
// navigálva lehetett, tehát a badge minden más képernyőn égve maradt (mezo-61w0 rokona).
test('a „Mind olvasott" a feed markAllRead-jét hívja', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await openPeek()
  await user.click(screen.getByRole('button', { name: 'Mind olvasott' }))
  expect(markAllRead).toHaveBeenCalledTimes(1)
})

test('csupa olvasott feedben nincs Olvasatlan chip és nincs „Mind olvasott" gomb', async () => {
  hoisted.items = [row('a', new Date(2026, 7, 30, 9, 0), '2026-08-30T10:00:00.000Z')]
  await openPeek()
  expect(chips()).toEqual(['Mind 1', 'Tudás 1'])
  expect(screen.queryByRole('button', { name: 'Mind olvasott' })).toBeNull()
  // A fejrész számlálója sem hazudik „0 új"-t, hanem kimondja, hogy nincs.
  expect(document.querySelector('.nap-ntfcnt')?.textContent).toBe('nincs új')
})

test('a chipek elérhető neve kimondja a darabszámot', async () => {
  await openPeek()
  expect(screen.getByRole('button', { name: 'Mind, 3 értesítés' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Olvasatlan, 1 értesítés' })).toHaveAttribute('aria-pressed', 'false')
})

test('a panel a fejléc közvetlen gyereke — a teljes szélesség ezen múlik', async () => {
  await openPeek()
  const panel = document.querySelector('.nap-ntfpanel')
  expect(panel?.parentElement?.tagName).toBe('HEADER')
})
