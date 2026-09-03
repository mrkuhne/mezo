import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
import { findKalauz } from '@/features/tutorial/registry'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  // mezo-gb1s.3: minden kalauz látottnak seedelve — a fejléc-tesztek a fejlécet nézik.
  seedAllKalauzSeen()
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

const BASE_CONTROLS = [
  'Napszak váltása',
  expect.stringMatching(/^Mezo üzenetei/),
  expect.stringMatching(/^Értesítések/),
  // mezo-idz2: a jobb szélső gomb már nem a profilra visz (azt az alsó „Én" fül adja),
  // hanem a mai nap-oldalra, és a napi töltöttséget is kimondja.
  expect.stringMatching(/^A mai napod/),
]

// mezo-gb1s.1/.3: a „?" a gombsor ELEJÉN áll, de csak ott, ahol van registry-találat.
// Az elvárás KÉZZEL írt tábla, nem a registryből származtatott: az utóbbi akkor is zöld
// maradna, ha egy kalauz kiesne a registryből (a teszt a kód alól kérdezné az igazságot).
// A teljes gomblistát nézzük, nem prefixet — így egy oda nem illő extra gomb is kibukik.
test.each([
  ['/nap', 'nap'],
  ['/train', 'train'],
  ['/fuel', 'fuel'],
  ['/mezo', 'mezo'],
  ['/me', 'me'],
])('a %s fejléce a kalauz-gombot (%s) + a négy alap-kontrollt viseli', (path, id) => {
  expect(findKalauz(path)?.id).toBe(id)
  const { container } = renderAt(path)
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels).toEqual(['Kalauz ehhez az oldalhoz', ...BASE_CONTROLS])
})

// A kalauz nélküli route-on nincs „?" — a négy alap-kontroll marad.
test('a kalauz nélküli aloldal fejlécén nincs „?" gomb', () => {
  expect(findKalauz('/nap/rutin')).toBeNull()
  const { container } = renderAt('/nap/rutin')
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels).toEqual(BASE_CONTROLS)
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
