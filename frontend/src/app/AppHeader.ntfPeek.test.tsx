// ============================================================
// Mezo · AppHeader — a csengő-peek időbélyege, sorrendje és olvasottság-jelzése (mezo-tdzy).
//
// A teljes feed oldal (`/me/ertesitesek`) minden sora napcsoportot, időpontot és olvasatlan-
// pöttyöt kap; a fejléc peekje ezekből EGYET sem adott, ráadásul a nyers érkezési sorrend első
// hármát vette. A feed hookot mockoljuk (az `AppHeader.dayOrbTone.test.tsx` mintája): a mock
// seed három MAI, mind olvasatlan sora nem tudná megkülönböztetni a nap-címkéket egymástól,
// és az olvasott ág egyáltalán nem szerepelne a peekben.
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
): AppNotificationView => ({
  id, kind: 'memory_note', title: `cím ${id}`, body: `szöveg ${id}`,
  deeplink: '/insights', occurredAt: at.toISOString(), readAt,
})

// Szándékosan ÖSSZEKEVERT érkezési sorrend: a peek rendezése látszódjon, ne a `slice` szerencséje.
const hoisted = vi.hoisted(() => ({ items: [] as unknown[] }))
vi.mock('@/data/notification/feedHooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/notification/feedHooks')>()
  return { ...actual, useNotificationFeed: () => ({ items: hoisted.items, isPending: false }) }
})

beforeEach(() => {
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

test('a peek a legújabb sort viszi elöl, nem az érkezési sorrendet', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.querySelector('.nap-ntf-t')?.textContent))
    .toEqual(['cím ma', 'cím tegnap', 'cím regi'])
})

test('minden sor dátumot ÉS időpontot visel', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.querySelector('.nap-ntf-when')?.textContent))
    .toEqual(['Ma · 06:20', 'Tegnap · 21:40', 'aug. 15. · 19:05'])
})

test('az olvasatlan sor pöttyöt és felolvasható jelzést kap, az olvasott egyiket sem', async () => {
  const rows = await openPeek()
  expect(rows.map((r) => r.classList.contains('unread'))).toEqual([true, false, false])
  expect(rows[0].querySelector('.nap-ntf-dot')).not.toBeNull()
  expect(rows[0].textContent).toContain('Olvasatlan')
  expect(rows[1].querySelector('.nap-ntf-dot')).toBeNull()
  expect(rows[1].textContent).not.toContain('Olvasatlan')
})

// A régi felirat („Értesítések · ma") a tegnapi és régebbi sorokra is azt állította, maiak.
test('a menü felirata nem állítja minden sorról, hogy mai', async () => {
  await openPeek()
  expect(screen.getByRole('menu', { name: 'Legutóbbi értesítések' })).toBeInTheDocument()
})
