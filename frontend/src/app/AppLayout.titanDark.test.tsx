// ============================================================
// Mezo · AppLayout — a Titán Nap SÖTÉT hatóköre (mezo-mhum, Task 7).
//
// A `/nap` és a `/nap/gyors` a prototípus grafit bőrét viseli. Mivel a fejléc és a TabBar
// a shellé (nem az oldalé), a scope-osztály a shell burkára (`.phone-screen`) kerül — és
// EGYETLEN más útvonalra sem szabad átszivárognia, amíg azok a saját szeletüket meg nem
// kapják. A blokk másik fele az alap: a két útvonal a ház dark témáját kényszeríti.
// Spec: .superpowers/sdd/2026-09-10-nap-mai-titanium/task-7-brief.md
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

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <ThemeProvider>
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

test.each(['/nap', '/nap/gyors'])('a %s a titan-dark hatókört viseli', (path) => {
  const { container } = renderAt(path)
  expect(container.querySelector('.phone-screen.titan-dark')).not.toBeNull()
})

test.each(['/train', '/fuel', '/me', '/nap/eletjel'])('a %s NEM kap titan-dark hatókört', (path) => {
  const { container } = renderAt(path)
  expect(container.querySelector('.phone-screen')).not.toBeNull()
  expect(container.querySelector('.titan-dark')).toBeNull()
})

// FIGYELEM (mezo-mhum javítóhullám): a tárolt beállítást KI KELL PECKELNI `light`-ra. Üres
// localStorage-dzsal a mód `auto`, és a cirkadián feloldó este magától sötétet ad — a teszt
// akkor is zöld lenne, ha ezt a mechanizmust teljesen kitörölnénk.
test('a Titán Nap a ház dark témáját kényszeríti a világos beállítás fölött is', () => {
  localStorage.setItem('mezo-theme', 'light')
  renderAt('/nap')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('világos beállítású felhasználónál más útvonal NEM lesz sötét', () => {
  localStorage.setItem('mezo-theme', 'light')
  renderAt('/train')
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
})
