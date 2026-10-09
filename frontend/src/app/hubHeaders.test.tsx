import { render, screen, within } from '@testing-library/react'
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
// öt másolat, eltérő tartalommal. mezo-atry ezt megfordította: a fejléc a SHELL-é (AppLayout),
// tehát egyetlen példány van belőle. A Folyadék-keret (mezo-n4wf5.1) ezt a szerződést viszi
// tovább az új címsoron (`.fo-top`, TitleBar): egy példány, minden hubon ugyanaz a sorrend.
//   /nap — mezo-d20.2.1  /train — mezo-d20.3.1  /fuel — mezo-d20.4.1
//   /mezo — mezo-d20.5.1 (a /insights route ide irányít át)   /me — mezo-d20.6.1
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('a %s tab-gyökéren PONTOSAN egy címsor van', (path) => {
  renderAt(path)
  expect(document.querySelectorAll('.fo-top')).toHaveLength(1)
  // a régi fejléc egyik másolata sem maradt
  expect(document.querySelector('.nap-head, .app-head')).toBeNull()
})

const barLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('.fo-top button')].map((b) => b.getAttribute('aria-label'))

// A hub öt kerek gombja, a jóváhagyott sorrendben (Folyadék-keret, owner 2026-10-09).
const HUB_CONTROLS = [
  'Minden oldal',
  expect.stringMatching(/^Mezo üzenetei/),
  expect.stringMatching(/^Értesítések/),
  'Beállítások',
  // mezo-idz2: a jobb szélső gomb nem a profilra visz (azt az alsó „Én" csepp adja),
  // hanem a mai nap-oldalra, és a napi töltöttséget is kimondja.
  expect.stringMatching(/^A mai napod/),
]
// Az aloldal sávja: vissza · (kalauz) · csengő.
const SUB_CONTROLS = ['Vissza', expect.stringMatching(/^Értesítések/)]

// mezo-gb1s.1/.3: a „?" csak ott áll, ahol van registry-találat — az új keretben a cím UTÁN.
// Az elvárás KÉZZEL írt tábla, nem a registryből származtatott: az utóbbi akkor is zöld
// maradna, ha egy kalauz kiesne a registryből (a teszt a kód alól kérdezné az igazságot).
// A teljes gomblistát nézzük, nem prefixet — így egy oda nem illő extra gomb is kibukik.
test.each([
  ['/nap', 'nap'],
  // /train nincs többé saját arca (Train Titanium T4, mezo-88iwa.5): a bejegyzés a
  // valódi tab-otthonra, /train/mai-re költözött (id: train-mai) — a redirect maga a
  // router.trainIndexRedirect.test.tsx dolga.
  ['/train/mai', 'train-mai'],
  ['/fuel', 'fuel'],
  ['/me', 'me'],
])('a %s címsora az öt alap-kontrollt + a kalauz-gombot (%s) viseli', (path, id) => {
  expect(findKalauz(path)?.id).toBe(id)
  const { container } = renderAt(path)
  expect(barLabels(container)).toEqual([...HUB_CONTROLS, 'Kalauz ehhez az oldalhoz'])
})

// A /mezo kalauza kivezetve (mezo-a9bo7.10): a csapat-üzenőfal posztokban mutatkozik be.
test('a /mezo címsorán nincs „?" gomb — a fal maga mutatkozik be', () => {
  expect(findKalauz('/mezo')).toBeNull()
  const { container } = renderAt('/mezo')
  expect(barLabels(container)).toEqual(HUB_CONTROLS)
})

// A kalauz nélküli route-on nincs „?". A fixture egy T3-váró heti alnézet — aloldal, tehát a
// sávja a vissza és a csengő (a hub öt gombja az aloldalon nincs ott).
test('a kalauz nélküli aloldal címsorán nincs „?" gomb — vissza és csengő', () => {
  expect(findKalauz('/me/week/napok')).toBeNull()
  const { container } = renderAt('/me/week/napok')
  expect(barLabels(container)).toEqual(SUB_CONTROLS)
})

test('a kalauzos aloldal címsorán a „?" a vissza és a csengő között áll', () => {
  expect(findKalauz('/nap/checkin')).not.toBeNull()
  const { container } = renderAt('/nap/checkin')
  expect(barLabels(container)).toEqual(['Vissza', 'Kalauz ehhez az oldalhoz', expect.stringMatching(/^Értesítések/)])
})

// A címsor nem áll meg a tab-gyökereknél — a többi fülön és az aloldalakon is ott van (D1).
test.each(['/nap/rutin', '/nap/checkin', '/fuel/recipes', '/settings', '/minden'])('a %s oldalon is ott a címsor', (path) => {
  renderAt(path)
  expect(document.querySelectorAll('.fo-top')).toHaveLength(1)
})

// A fülsor a hubé: a terület négy oldala a cím alatt. Aloldalon nincs fülsor.
test.each([
  ['/nap', 'Nap'], ['/nap/rutin', 'Nap'], ['/train/mai', 'Edzés'], ['/fuel/stack', 'Fuel'], ['/mezo', 'Mezo'], ['/me', 'Én'],
])('a %s hub címsorában ott a(z) %s terület négy füle', (path, name) => {
  renderAt(path)
  const strip = screen.getByRole('navigation', { name: `${name} oldalai` })
  expect(strip.closest('header')).toHaveClass('fo-top')
  expect(within(strip).getAllByRole('link')).toHaveLength(4)
  expect(document.querySelector('.fo-top')).not.toHaveClass('sub')
})

test.each(['/nap/checkin', '/fuel/recipes', '/me/week/napok', '/settings', '/minden'])('a %s aloldalon nincs fülsor', (path) => {
  renderAt(path)
  expect(document.querySelector('.fo-top')).toHaveClass('sub')
  expect(document.querySelector('.fo-tabs')).toBeNull()
})

// A chrome-mentes teljes képernyős flow-k: ahol az alsó sáv sem látszik, a címsor sem.
test.each(['/train/session', '/train/sport/log', '/me/sleep/night', '/ritual'])('a %s chrome-mentes felületen nincs címsor', (path) => {
  renderAt(path)
  expect(document.querySelector('.fo-top')).not.toBeInTheDocument()
  expect(document.querySelector('.fo-nav')).not.toBeInTheDocument()
})

// A Nap hub fejlécéből az ✨ Insights link már a Design 2.0 körben eltűnt (a Mezo első-
// osztályú terület, B döntés) — ez a pin marad.
test('a Nap címsora nem visz ✨ Insights linket', () => {
  renderAt('/nap')
  expect(document.querySelector('a[aria-label="Insights"]')).not.toBeInTheDocument()
})
