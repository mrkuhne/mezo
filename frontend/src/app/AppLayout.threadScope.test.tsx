// ============================================================
// Mezo · AppLayout — a mezo-szál provider HATÓKÖRE (mezo-eekm).
//
// Két strukturális állítás, amit eddig semmi nem őrzött:
//
// 1. A `MezoThreadProvider` a `hideChrome` kapun BELÜL van. A három szándékosan
//    chrome-mentes útvonalon (/train/session, /me/sleep/night, /ritual) nincs fejléc és
//    nincs TabBar, tehát a szálnak sincs fogyasztója — a provider ~15 `useNeeds`-olvasása
//    ott tiszta pazarlás volt.
// 2. A szál-hookok dobása NEM szalad ki az AppLayout-ból az app-szintű main.tsx
//    fallbackre, hanem egy ErrorBoundary kártyán áll meg, a TabBar-t használhatóan hagyva.
//
// A provider EGYÜTTES őse marad a fejlécnek és az Outlet-nek (mezo-atry: a két fogyasztó
// csak közös ősként osztozhat a szálon, különben a badge vízjele sosem talál) — ezt a
// meglévő AppHeader.test.tsx badge-életciklus tesztje őrzi, ezért itt nem ismételjük.
// Spec: bd mezo-eekm
// ============================================================
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AppLayout } from '@/app/AppLayout'
import { ThemeProvider } from '@/app/ThemeProvider'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => { vi.unstubAllEnvs() })

/** Kiírja, hogy erre az útvonalra jut-e szál-provider. A `useMezoThread` provider híján
 *  dob — a próba ezt fordítja le megfigyelhető szöveggé. */
function ThreadProbe() {
  let present = true
  try { useMezoThread() } catch { present = false }
  return <div data-testid="thread">{present ? 'van' : 'nincs'}</div>
}

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<ThreadProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test.each(['/train/session', '/me/sleep/night', '/ritual'])(
  'a chrome-mentes %s útvonalon NEM mountol a szál-provider',
  (path) => {
    renderAt(path)
    expect(screen.getByTestId('thread')).toHaveTextContent('nincs')
  },
)

test.each(['/nap', '/fuel', '/me'])('a chrome-os %s útvonalon mountol a szál-provider', (path) => {
  renderAt(path)
  expect(screen.getByTestId('thread')).toHaveTextContent('van')
})
