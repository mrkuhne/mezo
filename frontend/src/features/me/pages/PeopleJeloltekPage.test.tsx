// Emberek S4 (mezo-06o0.3) — PeopleJeloltekPage grows from S3's honest-empty-only page
// into the real candidate inbox: usePeople()'s `candidates` (status === 'candidate') render
// as gold `.ppl-candt` cards (prototype `.candt` ×1.18), each with an accept/reject pair
// wired straight to `decidePerson`. The mock seed carries exactly one candidate — Marci
// (pp-marci) — so accept/reject both collapse the inbox back to the honest empty state
// (Task 2's copy, now always-shown as the prototype's foot line, not an empty-only aside).
//
// VITE_USE_MOCK stub (PeopleKorPage.test.tsx idiom): forces mock data regardless of the
// dual-mode runner's actual env var, so both `pnpm test` invocations exercise the same
// mock-seeded candidate — the real-mode wiring itself is proven by peopleHooks'/msw's own
// tests, not re-proven here.
import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'
import { people as personSeed } from '@/data/me/people'

const marci = personSeed.find((p) => p.id === 'pp-marci')!

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/me/people/jeloltek'] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the seeded candidate renders a gold card: name, JELÖLT chip, quoted notes, accept/reject buttons', () => {
  const { container } = renderPage()
  expect(screen.getByText(`Új arc · ${marci.name}`)).toBeInTheDocument()
  expect(screen.getByText('JELÖLT')).toBeInTheDocument()
  expect(screen.getByText(marci.notes)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Felveszem' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nem ő az / nem kell' })).toBeInTheDocument()
  expect(container.querySelector('.ppl-candt')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.',
    ),
  ).toBeInTheDocument()
})

test('hero bignum equals the candidate count', () => {
  const { container } = renderPage()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('1')
})

test('accepting the candidate ("Felveszem") removes the card and shows the honest empty state', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Felveszem' }))
  expect(
    await screen.findByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(`Új arc · ${marci.name}`)).not.toBeInTheDocument()
})

test('rejecting the candidate ("Nem ő az / nem kell") removes the card and shows the honest empty state', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Nem ő az / nem kell' }))
  expect(
    await screen.findByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(`Új arc · ${marci.name}`)).not.toBeInTheDocument()
})
