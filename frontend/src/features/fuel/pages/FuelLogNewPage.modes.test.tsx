// ============================================================
// Mezo · FuelLogNewPage — a kamera-első héj BEKÖTÉSE (Fuel Titanium S1c, mezo-33k6;
// manifeszt A4 · A5 · A7). A héj saját szerződéseit a FuelLogModes.test.tsx őrzi; ITT az a
// kérdés, hogy a héj karjai a composer MEGLÉVŐ AI-ágába futnak-e:
//   • a lap a kamerán nyit, `?ai=1` a gépelésen (a deep link ígérete változatlan),
//   • a héjban választott fotó a composer egyetlen AI-hívóhelyén fut le (resizeImage → draft),
//   • a felismerés kudarca a héj ŐSZINTE állapotát nyitja, nem hibatoastot,
//   • egy „szokásos" sor a NEVÉVEL indít piszkozatot — kitalált makrók nélkül.
//
// A resizeImage mock kötelező: jsdom-ban nincs canvas-alapú átméretezés.
// ============================================================
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'

const resizeSpy = vi.hoisted(() => vi.fn((f: Blob) => Promise.resolve(f)))
vi.mock('@/shared/lib/resizeImage', () => ({ resizeImage: resizeSpy }))

const hoisted = vi.hoisted(() => ({ draftFails: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => ({
      ...actual.useMealActions(date),
      ...(hoisted.draftFails ? { draftMealFromAi: () => Promise.reject(new Error('nope')) } : {}),
    }),
  }
})

import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  URL.createObjectURL = vi.fn(() => 'blob:thumb') as never
  URL.revokeObjectURL = vi.fn() as never
})
afterEach(() => {
  hoisted.draftFails = false
  resizeSpy.mockClear()
  vi.unstubAllEnvs()
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>

function renderAt(entry: string) {
  const router = createMemoryRouter(
    [
      { path: '/fuel/log/uj', element: <FuelLogNewPage /> },
      { path: '/fuel', element: <div>LOG PAGE PROBE</div> },
    ],
    { initialEntries: [entry] },
  )
  return render(<RouterProvider router={router} />, { wrapper })
}

const activeMode = (container: HTMLElement) => container.querySelector('.fmx-mode.is-active')!.textContent

test('A4: a lap a kamerán nyit', async () => {
  const { container } = renderAt('/fuel/log/uj')
  await screen.findByText('Ablakon kívül')
  expect(activeMode(container)).toMatch(/Fotó/)
})

test('ai=1 a gépelésen nyit, az AI-panel nyitva — a deep link ígérete változatlan', async () => {
  const { container } = renderAt('/fuel/log/uj?ai=1')
  expect(await screen.findByLabelText('Mit ettél?')).toBeInTheDocument()
  expect(activeMode(container)).toMatch(/Gépelés/)
})

test('a héjban választott fotó a composer MEGLÉVŐ fotó-ágán fut le, nem egy második hívóhelyen', async () => {
  renderAt('/fuel/log/uj')
  const file = new File(['x'], 'tanyer.jpg', { type: 'image/jpeg' })
  await userEvent.upload(await screen.findByLabelText('Étel fotó · kamera'), file)
  // A MOCK AI-piszkozat sorai a tételek közé kerülnek — a felismerés a composerben futott.
  expect(await screen.findByText('Csirkés wrap')).toBeInTheDocument()
  expect(resizeSpy).toHaveBeenCalledWith(file)
})

test('A4: a felismerés kudarca a héj őszinte állapotát nyitja, nem hibatoastot', async () => {
  hoisted.draftFails = true
  renderAt('/fuel/log/uj')
  await userEvent.upload(
    await screen.findByLabelText('Étel fotó · kamera'),
    new File(['x'], 'tanyer.jpg', { type: 'image/jpeg' }),
  )
  expect(await screen.findByText(/nem ismertem fel/i)).toBeInTheDocument()
  // És a másik három út ott van, a kamerával együtt.
  expect(screen.getByRole('button', { name: /Leírom szöveggel/ })).toBeInTheDocument()
})

test('A7: egy szokásos sor a nevével indít piszkozatot — kitalált makrók nélkül', async () => {
  renderAt('/fuel/log/uj')
  await userEvent.click(await screen.findByRole('tab', { name: /Szokásosak/ }))
  const rows = screen.getAllByRole('button', { name: /logoltad/ })
  await userEvent.click(rows[0])
  expect(await screen.findByText('Csirkés wrap')).toBeInTheDocument()
})

// ── A8: `?edit=` — egy logolt étkezés javítása (mezo-33k6). A mock-nap első étkezése a
// fixture: a lap abból indul, és a négy rögzítő út ilyenkor NEM jelenik meg. ────────────────

test('A8: ?edit= a javítás módjában nyit, a rögzítő utak nélkül', async () => {
  const { container } = renderAt('/fuel/log/uj?edit=m1')
  expect(await screen.findByText('Javítás')).toBeInTheDocument()
  // A fejlécben ÉS a „ez az étkezés" kártyán is a logolt étkezés saját címe áll — a javítás nem
  // nevezi át csendben egy derivált névre.
  expect(screen.getAllByText('Túrós zabkása · áfonyával').length).toBeGreaterThanOrEqual(2)
  expect(container.querySelector('.fmx-mode')).toBeNull()
  // A9: a két lépéses törlés ajtaja itt él.
  expect(screen.getByRole('button', { name: 'Törlöm' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mentem a javítást/ })).toBeInTheDocument()
})

test('ismeretlen edit-azonosítónál nem omlik össze, és nem fabrikál étkezést', async () => {
  renderAt('/fuel/log/uj?edit=nincs-ilyen')
  expect(await screen.findByText('Javítás')).toBeInTheDocument()
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
})
