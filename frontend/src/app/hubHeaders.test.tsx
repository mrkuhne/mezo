import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { writeLocalProgress } from '@/shared/lib/tutorialSeen'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-08-30T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
})
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

// Design 2.0 endgame (mezo-d20.9.1) óta minden tab-gyökér SAJÁT `.nap-head` blokkot vitt —
// öt másolat, eltérő tartalommal. mezo-atry ezt megfordítja: a fejléc a SHELL-é (AppLayout),
// tehát egyetlen példány van belőle, minden oldalon ugyanaz, ugyanabban a sorrendben.
//   /nap — mezo-d20.2.1  /train — mezo-d20.3.1  /fuel — mezo-d20.4.1
//   /mezo — mezo-d20.5.1 (a /insights route ide irányít át)   /me — mezo-d20.6.1
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('a %s tab-gyökéren PONTOSAN egy .nap-head van', (path) => {
  renderAt(path)
  expect(document.querySelectorAll('.nap-head')).toHaveLength(1)
})

test.each(['/nap', '/train', '/mezo', '/me'])('a %s tab-gyökér fejléce a négy alap-kontrollt viseli', (path) => {
  const { container } = renderAt(path)
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

// mezo-gb1s.1: a kalauzos oldalon a „?" a gombsor elején — a többi négy változatlan sorrendben utána.
test('a /fuel fejléce elöl a Kalauz gombot viseli, utána a négy alap-kontrollt', () => {
  const { container } = renderAt('/fuel')
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Kalauz ehhez az oldalhoz')
  expect(labels.slice(1, 5)).toEqual([
    'Napszak váltása', expect.stringMatching(/^Mezo üzenetei/), expect.stringMatching(/^Értesítések/), 'Profil',
  ])
})

// A fejléc nem áll meg a tab-gyökereknél — az aloldalakon is ott van (D1).
test('az aloldalakon is ott a fejléc', () => {
  renderAt('/nap/rutin')
  expect(document.querySelectorAll('.nap-head')).toHaveLength(1)
})

// A chrome-mentes teljes képernyős flow-k: ahol a TabBar sem látszik, a fejléc sem.
test.each(['/train/session', '/me/sleep/night', '/ritual'])('a %s chrome-mentes felületen nincs fejléc', (path) => {
  renderAt(path)
  expect(document.querySelector('.nap-head')).not.toBeInTheDocument()
})

// A Nap hub fejlécéből az ✨ Insights link már a Design 2.0 körben eltűnt (a Mezo első-
// osztályú tab, B döntés) — ez a pin marad.
test('a Nap fejléce nem visz ✨ Insights linket', () => {
  renderAt('/nap')
  expect(document.querySelector('a[aria-label="Insights"]')).not.toBeInTheDocument()
})
