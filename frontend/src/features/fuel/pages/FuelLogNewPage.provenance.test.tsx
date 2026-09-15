// ============================================================
// Fuel Titanium S5 (mezo-qt5q) — manifest E9 · E10, ÚJ teszt a REBUILT naplózó ÚTJÁN.
//
// A két szerződés eddig CSAK a `LogFlowPage` héján volt kikötve (`LogFlowPage.outcome.test.tsx`,
// `LogFlowPage.test.tsx`) — az a héj viszont már nem route: overlayként él (kamra/recept
// részletlap), a lapot a `/fuel/log/uj` `FuelLogNewPage` viszi. Ugyanaz a `MealComposer` ül
// mindkettő alatt, tehát a viselkedés elvileg közös — de „elvileg közös" pont az a feltevés, amit
// egy UI-átépítés csendben megtörhet, ezért a rebuild SAJÁT útján is ki van kötve:
//
//   • E9 — az AI-piszkozat EREDMÉNYJELZÉSE (draftId → accepted / edited / discarded). Ez tisztán
//     telemetria: ha elnémul, a felhasználó soha nem veszi észre, a modell-minőség visszacsatolása
//     viszont elhallgat.
//   • E10 — az étkezés PROVENANCE-a (manual / ai-text / ai-photo). A backend tárolja, a felület
//     sosem mutatja (owner-döntés) — tehát szintén láthatatlanul tűnhet el.
//
// A `reportDraftOutcome` itt mockolt (a saját szerződését az `outcomeClient.test.ts` őrzi); a
// `resizeImage` mock kötelező, mert jsdom-ban nincs canvas-átméretezés.
// ============================================================
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'

const reportDraftOutcome = vi.hoisted(() => vi.fn())
vi.mock('@/data/aidraft/outcomeClient', () => ({ reportDraftOutcome }))

const resizeSpy = vi.hoisted(() => vi.fn((f: Blob) => Promise.resolve(f)))
vi.mock('@/shared/lib/resizeImage', () => ({ resizeImage: resizeSpy }))

// A mentés hívásának ARGUMENTUMÁT kell látnunk — a provenance-envelope ott utazik.
const logged = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => {
      const real = actual.useMealActions(date)
      return {
        ...real,
        // MINDEN argumentumot továbbadunk: a második az `onSuccess`, amiben az E9
        // eredményjelzés fut — egy „csak az elsőt adom tovább" csonkítás itt HAMIS piros.
        logMeal: (...args: Parameters<typeof real.logMeal>) => {
          logged.calls.push(args[0])
          return real.logMeal(...args)
        },
        // Az AI-ág `logMealAsync`-et hív (mezo-qt5q, E9): a per-call onSuccess elveszne, amikor a
        // lap mentés után azonnal továbblép. A mentett input MINDKÉT úton ide kell.
        logMealAsync: (...args: Parameters<typeof real.logMealAsync>) => {
          logged.calls.push(args[0])
          return real.logMealAsync(...args)
        },
      }
    },
  }
})

import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  URL.createObjectURL = vi.fn(() => 'blob:thumb') as never
  URL.revokeObjectURL = vi.fn() as never
})
afterEach(() => {
  logged.calls = []
  reportDraftOutcome.mockClear()
  resizeSpy.mockClear()
  vi.unstubAllEnvs()
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>

function renderAt(entry: string) {
  const router = createMemoryRouter(
    [
      { path: '/fuel/log/uj', element: <FuelLogNewPage /> },
      { path: '/fuel', element: <div>MAI PROBE</div> },
    ],
    { initialEntries: [entry] },
  )
  return render(<RouterProvider router={router} />, { wrapper })
}

const save = () => userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
const lastInput = () => logged.calls[logged.calls.length - 1] as { provenance?: unknown }

// ── E10: a provenance a rebuild útján is kiíródik ───────────────────────────────────────────

test('E10: a fotós út `ai-photo` provenance-szal mentődik a /fuel/log/uj lapról', async () => {
  renderAt('/fuel/log/uj')
  const file = new File(['x'], 'tanyer.jpg', { type: 'image/jpeg' })
  await userEvent.upload(await screen.findByLabelText('Étel fotó · kamera'), file)
  await screen.findByText('Csirkés wrap')
  await save()
  await vi.waitFor(() => expect(logged.calls.length).toBe(1))
  expect(lastInput().provenance).toMatchObject({ origin: 'ai-photo' })
})

test('E10: a gépelt AI-út `ai-text` provenance-szal mentődik, a nyers szöveggel', async () => {
  renderAt('/fuel/log/uj?ai=1')
  await userEvent.type(await screen.findByLabelText('Mit ettél?'), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  await save()
  await vi.waitFor(() => expect(logged.calls.length).toBe(1))
  expect(lastInput().provenance).toMatchObject({ origin: 'ai-text', rawText: 'csirkés wrap' })
})

// ── E9: az eredményjelzés a rebuild útján is elmegy ─────────────────────────────────────────

test('E9: az érintetlen AI-piszkozat mentése `accepted`-et jelent a saját draftId-jével', async () => {
  renderAt('/fuel/log/uj?ai=1')
  await userEvent.type(await screen.findByLabelText('Mit ettél?'), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  await save()
  await vi.waitFor(() => expect(reportDraftOutcome)
    .toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'accepted'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})

test('E9: a piszkozat megpiszkálása után `edited` megy el, nem `accepted`', async () => {
  renderAt('/fuel/log/uj?ai=1')
  await userEvent.type(await screen.findByLabelText('Mit ettél?'), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: 'Csirkés wrap növelés' }))
  await save()
  await vi.waitFor(() => expect(reportDraftOutcome)
    .toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'edited'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})

// A lap elhagyása (unmount) az az ÚT, amibe a Mégse, a ‹ Vissza és az Escape is befut.
test('E9: mentés nélkül elhagyott piszkozat `discarded`-ot jelent', async () => {
  const view = renderAt('/fuel/log/uj?ai=1')
  await userEvent.type(await screen.findByLabelText('Mit ettél?'), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  view.unmount()
  await vi.waitFor(() => expect(reportDraftOutcome)
    .toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'discarded'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})
