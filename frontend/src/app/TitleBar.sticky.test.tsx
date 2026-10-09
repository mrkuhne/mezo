// ============================================================
// Mezo · TitleBar — a címsor kitapad, és NEM húzódik össze (mezo-n4wf5.1).
//
// Ez a fájl a useCondensedHeader.test.ts helyén áll. A régi fejléc görgetésre kompakt módba
// váltott (`is-cond`, 14px-es küszöb); a Folyadék-keret címsora egy darabban kitapad és a
// magassága NEM függ a görgetéstől. A hook megszűnt, ezért itt az áll, ami a helyére lépett:
//   · a sáv a görgetésre nem vált állapotot (nincs kompakt osztály, nincs scroll-figyelő);
//   · a sáv a SAJÁT magasságát közli a görgetővel (`--fo-top-h`), hogy a lapok tapadó chrome-ja
//     (`.sticky-top`) alá tapadhasson — ez váltja a kézzel tartott `--mzh-head-cond-h` tokent.
// ============================================================
import { act, render, screen } from '@testing-library/react'
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
})
afterEach(() => vi.unstubAllEnvs())

/** The bar inside the shell's one scroller (`.screen-content`), or bare. */
function renderBar({ scroller = true, path = '/fuel' } = {}) {
  const bar = (
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider><MezoThreadProvider><TitleBar /></MezoThreadProvider></TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>
  )
  return render(scroller ? <div className="screen-content">{bar}</div> : bar)
}

test('scroller nélkül nem borul el', async () => {
  expect(() => renderBar({ scroller: false })).not.toThrow()
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
})

test('görgetésre nem vált állapotot: a küszöb fölött és alatt ugyanaz a sáv', async () => {
  const { container } = renderBar()
  await screen.findByRole('button', { name: 'Beállítások' })
  const el = container.querySelector('.screen-content') as HTMLElement
  const head = container.querySelector('.fo-top')!
  const before = head.className
  for (const top of [14, 15, 40, 400, 0]) {
    act(() => { el.scrollTop = top; el.dispatchEvent(new Event('scroll')) })
    expect(head.className).toBe(before)
    expect(head).not.toHaveClass('is-cond')
  }
})

test('nem iratkozik fel a görgetésre', async () => {
  const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
  const { container } = renderBar()
  await screen.findByRole('button', { name: 'Beállítások' })
  const el = container.querySelector('.screen-content')
  expect(add.mock.contexts.some((ctx, i) => ctx === el && add.mock.calls[i][0] === 'scroll')).toBe(false)
  add.mockRestore()
})

test('a sáv a saját magasságát közli a görgetővel, leszereléskor pedig visszaveszi', async () => {
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      return { x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 159.6, width: 390, height: this.classList.contains('fo-top') ? 159.6 : 0, toJSON() {} } as DOMRect
    })
  const { container, unmount } = renderBar()
  await screen.findByRole('button', { name: 'Beállítások' })
  const el = container.querySelector('.screen-content') as HTMLElement
  expect(el.style.getPropertyValue('--fo-top-h')).toBe('160px')
  unmount()
  expect(el.style.getPropertyValue('--fo-top-h')).toBe('')
  rect.mockRestore()
})

test('a sáv kitapad a görgetőport tetejére, a lapok tapadó chrome-ja pedig alá', () => {
  const rule = frameCss.match(/\.fo-top \{[^}]+\}/)?.[0] ?? ''
  expect(rule).toContain('position: sticky; top: 0')
  expect(rule).toContain('z-index: 46')
  expect(frameCss).toContain('.screen-content:has(.fo-top) .sticky-top { top: var(--fo-top-h, 74px); }')
  expect(frameCss).not.toContain('is-cond')
})
