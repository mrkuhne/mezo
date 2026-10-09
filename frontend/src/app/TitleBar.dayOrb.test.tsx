// ============================================================
// Mezo · TitleBar — a nap-orb KOMPOZÍCIÓS fedezete (mezo-tzid → mezo-n4wf5.1).
//
// A régi fejléc `DayOrb`-ja két tengelyt rajzolt: a SZINTET (hány jel van meg) és a TÓNUST (a
// napi pont telítettsége). A Folyadék-keretben az orb a közös `Drop`: a jóváhagyott rajzon a
// folyadéka fix Nap-kék, tehát a tónus-tengely a címsoron már nem rajzolódik ki — ami maradt,
// az a SZINT és a szavakban kimondott állapot (`aria-label`). A régi fájl (AppHeader.dayOrbTone)
// azt a rést zárta, hogy a fejléc a hook értéke helyett konstanst adhat a rajznak, miközben a
// réteg-tesztek mind zöldek; ez a fájl UGYANAZT a rést zárja az új rajzon: a hook `pct`-je a
// csepp hullámvonaláig, a `label`-je a gomb nevéig megy el.
// A tónus-lánc rétegtesztjei (dayOrbTone / dayOrbFill / useDayOrbFill / DayOrb) érintetlenek.
// ============================================================
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { TitleBar } from '@/app/TitleBar'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

const hoisted = vi.hoisted(() => ({ fill: { pct: 0, intensity: 0.5, label: '' } }))
vi.mock('@/features/today/logic/useDayOrbFill', () => ({ useDayOrbFill: () => hoisted.fill }))

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

function renderHeader() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap']}>
        <TutorialProvider>
          <MezoThreadProvider>
            <TitleBar />
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** The liquid's surface height in the drop's 0–100 box (the wave path starts at `M-20 <y>`). */
function orbLevel(container: HTMLElement): number {
  const d = container.querySelector('.fo-day .fo-drop .liq')!.getAttribute('d')!
  return 100 - Number(d.match(/^M-20 (-?\d+(?:\.\d+)?)/)![1])
}

test.each([[72], [40], [100]])('a nap %i%%-os töltöttsége a címsor cseppjének szintje', (pct) => {
  hoisted.fill = { pct, intensity: 0.5, label: `A mai napod · ${pct}%` }
  const { container } = renderHeader()
  expect(orbLevel(container)).toBe(pct)
})

test('üres napon a csepp alján is marad egy vékony folyadékcsík (a Drop 6%-os padlója)', () => {
  hoisted.fill = { pct: 0, intensity: 0.5, label: 'A mai napod · még semmi' }
  expect(orbLevel(renderHeader().container)).toBe(6)
})

test('az orb gombja a hook kész címkéjét mondja ki, nem saját szöveget', () => {
  hoisted.fill = { pct: 57, intensity: 1, label: 'A mai napod · 4 a 7 jelből megvan' }
  renderHeader()
  expect(screen.getByRole('button', { name: 'A mai napod · 4 a 7 jelből megvan' })).toHaveClass('fo-day')
})

test('az orb a közös Drop, a jóváhagyott Nap-kék folyadékkal — minden területen ugyanaz', () => {
  hoisted.fill = { pct: 72, intensity: 0, label: 'A mai napod' }
  const { container } = renderHeader()
  const drop = container.querySelector('.fo-day .fo-drop') as HTMLElement
  expect(drop.style.getPropertyValue('--c')).toBe('#1877F2')
  expect(drop.style.getPropertyValue('--s')).toBe('30px')
  expect(drop).not.toHaveClass('alive')
  // the old sprite-era orb is gone from the bar
  expect(container.querySelector('.dayorb')).toBeNull()
})
