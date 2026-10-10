import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { InfoButton } from '@/features/train/components/InfoButton'

// InfoButton (mezo-b516k, Task 1) — the Train explain layer's one primitive.
// Since Folyadék F3 (mezo-n4wf5.3) it is the prototype's `info()` + `tinfo` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): a flat round ⓘ opening the kit's light InfoSheet.

const TITLE = 'Mit mutat a sáv?'
const COPY =
  'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon.'

function renderButton(ui = <InfoButton title={TITLE} copy={COPY} />) {
  return render(<MemoryRouter initialEntries={['/train/terheles']}>{ui}</MemoryRouter>)
}

function trigger() {
  return screen.getByRole('button', { name: `${TITLE} — mit jelent?` })
}

test('renders an icon-only button carrying the aria-label verbatim', () => {
  renderButton()
  const btn = trigger()
  // `pl-info` stays for the layout probe's hit-box check; `ex-info` is the Folyadék chip
  expect(btn).toHaveClass('pl-info', 'ex-info')
  expect(btn).toHaveAttribute('type', 'button')
  // Icon-only: no visible text at all, only the aria-label (it sits inside an <h3>, where
  // any rendered text would read as part of the heading).
  expect(btn.textContent).toBe('')
  expect(btn.querySelector('use')?.getAttribute('href')).toBe('#t-info')
})

test('the sheet is closed until the button is tapped', () => {
  renderButton()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText(COPY)).not.toBeInTheDocument()
})

test('tapping it opens the light info sheet named by the title — no glass, no tint', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())

  const dialog = screen.getByRole('dialog', { name: TITLE })
  expect(dialog).toHaveClass('sheet', 'fo-sheet')
  expect(dialog).not.toHaveClass('gl-card')
  expect(dialog).not.toHaveClass('glass')
  expect(document.querySelector('.gl-backdrop')).not.toBeInTheDocument()
})

test('the open sheet carries the info bubble, the title and the copy paragraph', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())

  const dialog = screen.getByRole('dialog')
  const head = dialog.querySelector('.fo-shh')!
  expect(head.querySelector('.fo-bub use')?.getAttribute('href')).toBe('#t-info')
  expect(within(dialog).getByRole('heading', { name: TITLE })).toBeInTheDocument()
  expect(within(dialog).queryByText('MEZO · RÉSZLET')).not.toBeInTheDocument()
  expect(within(dialog).getByText(COPY)).toHaveClass('fo-txt')
})

test('`eyebrow` puts the context line above the title; `link` shows the title as a text link with the same name', async () => {
  const user = userEvent.setup()
  renderButton(<InfoButton title={TITLE} copy={COPY} eyebrow="Izomcsoportok" link />)
  const btn = trigger()
  expect(btn).toHaveClass('fo-lk')
  expect(btn).not.toHaveClass('pl-info')
  expect(btn.textContent).toBe(TITLE)
  await user.click(btn)
  expect(screen.getByRole('dialog', { name: TITLE }).querySelector('.fo-she span')?.textContent).toBe('Izomcsoportok')
})

test('Escape closes the sheet', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('a backdrop click closes the sheet', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  await user.click(document.querySelector('.sheet-backdrop')!)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('the × closes the sheet', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

// The sheet itself listens for Escape / backdrop / × only — this primitive owns the
// route-change close, so a client-side navigation leaves no orphaned sheet over the next screen.
test('a ROUTE CHANGE closes the sheet', async () => {
  function Harness() {
    const navigate = useNavigate()
    return (
      <>
        <button type="button" onClick={() => navigate('/train/terv')}>tovább</button>
        <InfoButton title={TITLE} copy={COPY} />
      </>
    )
  }
  const user = userEvent.setup()
  renderButton(<Harness />)

  await user.click(trigger())
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'tovább' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('an interpolated copy string ships through untouched (the #3 MEV case)', async () => {
  const mev = 8
  const interpolated = `A ${mev} alatt nincs elég inger ahhoz, hogy ez az izom fejlődjön.`
  const user = userEvent.setup()
  renderButton(<InfoButton title="Mit jelentenek a jelölések?" copy={interpolated} />)
  await user.click(screen.getByRole('button', { name: 'Mit jelentenek a jelölések? — mit jelent?' }))
  expect(screen.getByText(interpolated)).toBeInTheDocument()
})
