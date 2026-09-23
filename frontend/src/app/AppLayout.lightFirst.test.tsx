// ============================================================
// Mezo · AppLayout — a shell világos-első alapállapota (mezo-ju4j6.3, visszaöltöztetés).
//
// Ez a fájl az elődje (`AppLayout.titanDark.test.tsx`) INVERZE. A Titán korszakban a `/nap`,
// a teljes Fuel és a teljes Train domén két rétegben viselte a hideg grafit bőrt: az
// AppLayout a ház dark témáját kényszerítette rájuk (`useForceTheme('dark')`), a
// `.titan-dark` osztály pedig a shell burkára tette a prototípus palettáját. Mindkettőt a
// shell-strip törölte — és pont ez a két fél az, amit egy későbbi visszacsúszás
// (egy régi ág merge-e, egy „állítsuk vissza a sötétet ezen az egy oldalon" fix) újra
// behozna. A csapda az, hogy a FÉLIG levett bőr — kényszerített sötét téma, scope nélkül —
// meleg grafitban rendereli az oldalt, ami nem néz ki elrontottnak, csak épp nem a
// visszaállított alapállapot. Ezért mindkét felét külön állítjuk.
// ============================================================
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppLayout } from '@/app/AppLayout'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => {
  vi.unstubAllEnvs()
  document.documentElement.removeAttribute('data-theme')
})

function renderAt(path: string, lock: 'dark' | null = null) {
  return render(
    <QueryWrapper>
      {/* `lock={null}`: the parked light path — AppLayout itself must never force a theme. */}
      <ThemeProvider lock={lock}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<div>oldal</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

/** A Titán hatókör teljes egykori listája — minden útvonal, amit vissza kellett öltöztetni. */
const FORMERLY_TITAN = [
  '/nap', '/nap/gyors',
  '/fuel', '/fuel/stack', '/fuel/trendek', '/fuel/konyha', '/fuel/log/uj',
  '/train', '/train/mai', '/train/mesocycles', '/train/session',
]

test.each(FORMERLY_TITAN)('%s NEM visel semmilyen megjelenés-hatókört a shell burkán', path => {
  const { container } = renderAt(path)
  const screen = container.querySelector('.phone-screen')
  expect(screen).not.toBeNull()
  expect(screen!.className).not.toContain('titan-dark')
  // A burok osztálylistája a shell sajátja: `phone-screen` + legfeljebb az `anchor`.
  for (const cls of screen!.classList) {
    expect(['phone-screen', 'anchor']).toContain(cls)
  }
})

// FIGYELEM (a törölt teszt tanulsága, mezo-mhum javítóhullám): a tárolt beállítást KI KELL
// PECKELNI `light`-ra. Üres localStorage-dzsal a mód `auto`, és a cirkadián feloldó este
// magától sötétet ad — a teszt akkor is zöld lenne, ha a kényszerítés visszakerülne.
test.each(FORMERLY_TITAN)('%s a felhasználó világos beállítását tartja, nem kényszerít sötétet', path => {
  localStorage.setItem('mezo-theme', 'light')
  renderAt(path)
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
})

// Üvegesítés (mezo-me75u.1): a sötét zár az app ALAPÁLLAPOTA — a tárolt világos beállítás
// megmarad, de nem érvényesül. A zár a téma-szolgáltatóé, nem a shellé (a fenti teszt).
test.each(FORMERLY_TITAN)('%s a sötét zár alatt sötét, világos beállítás mellett is', path => {
  localStorage.setItem('mezo-theme', 'light')
  renderAt(path, 'dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

// A chrome-kapuk (hideChrome/hideFab) FÜGGETLENEK a bőrtől, és a keep-listán vannak —
// a strip nem nyúlhatott hozzájuk.
test('a /train/session továbbra is chrome nélkül fut', () => {
  const { container } = renderAt('/train/session')
  expect(container.querySelector('.tab-bar')).toBeNull()
  expect(container.querySelector('.app-head')).toBeNull()
})
