// ============================================================
// Mezo · TitleBar — a címsor NEM visel aurorát (mezo-n4wf5.1).
//
// Ez a fájl a HeaderAurora.test.tsx helyén áll. A régi fejléc mögött egy napszak-aurora ült
// (wash + két fényfolt + napszak-grafika, `data-face`); a Folyadék-keret címsora egy nyugodt,
// áttetsző világos sáv, napszaktól független. A régi tesztek alanya megszűnt, ezért itt az áll,
// ami a helyére lépett: a sávnak nincs dekorációs rétege, és ugyanaz reggel, délben, este.
// ============================================================
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TitleBar } from '@/app/TitleBar'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
import frameCss from '@/styles/folyadek-frame.css?raw'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function renderBarAt(hour: number, path = '/nap') {
  vi.setSystemTime(new Date(2026, 7, 30, hour, 0, 0))
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider><MezoThreadProvider><TitleBar /></MezoThreadProvider></TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** The bar's markup with the two things that legitimately follow the clock removed. */
function shape(container: HTMLElement): string {
  const head = container.querySelector('.fo-top')!.cloneNode(true) as HTMLElement
  head.querySelectorAll('.fo-day').forEach((n) => n.remove())          // the day orb fills with the day
  head.querySelectorAll('.fo-badge-n').forEach((n) => n.remove())      // counts
  head.querySelectorAll('[aria-label]').forEach((n) => n.removeAttribute('aria-label'))
  return head.innerHTML.replace(/id="[^"]*"|url\(#[^)]*\)|aria-describedby="[^"]*"/g, '')
}

test('nincs napszak-aurora: se háttérréteg, se data-face a címsoron', async () => {
  const { container } = renderBarAt(13)
  await screen.findByRole('button', { name: 'Beállítások' })
  expect(container.querySelector('.app-head-bg, .app-head-wash, .app-head-blob, .app-head-deco')).toBeNull()
  expect(container.querySelector('.fo-top [data-face]')).toBeNull()
  expect(container.querySelector('.fo-top')).not.toHaveAttribute('data-face')
})

test('a címsornak nincs tisztán dekoratív gyerek-rétege — minden közvetlen gyereke tartalom', async () => {
  const { container } = renderBarAt(13)
  await screen.findByRole('button', { name: 'Beállítások' })
  const kids = [...container.querySelector('.fo-top')!.children]
  expect(kids.map((k) => k.className)).toEqual(['fo-trow hub', 'fo-title'])
  for (const k of kids) expect(k).not.toHaveAttribute('aria-hidden')
})

test('a sáv reggel, délben és este ugyanaz — a napszak nem öltözteti át', async () => {
  const shapes: string[] = []
  for (const hour of [7, 13, 21]) {
    const { container, unmount } = renderBarAt(hour)
    await screen.findByRole('button', { name: 'Beállítások' })
    shapes.push(shape(container))
    unmount()
  }
  expect(shapes[1]).toBe(shapes[0])
  expect(shapes[2]).toBe(shapes[0])
})

test('a sáv háttere egyetlen áttetsző világos felület, elmosással — nem wash és fényfoltok', () => {
  const rule = frameCss.match(/\.fo-top \{[^}]+\}/)?.[0] ?? ''
  expect(rule).toContain('background: color-mix(in srgb, #F8FCFD 78%, transparent)')
  expect(rule).toContain('backdrop-filter: blur(18px) saturate(1.4)')
  expect(frameCss).not.toMatch(/app-head|data-face/)
})
