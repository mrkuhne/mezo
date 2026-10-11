import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { InfoButton } from '@/features/train/components/InfoButton'

// InfoButton (mezo-b516k, Task 1) — the Train explain layer's one primitive.
// Since Folyadék F3 (mezo-n4wf5.3) it is the prototype's `info()` + `tinfo` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): a text link showing the title, opening the kit's light InfoSheet.

const TITLE = 'Mit mutat a sáv?'
const COPY =
  'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon.'

function renderButton(ui = <InfoButton title={TITLE} copy={COPY} />) {
  return render(<MemoryRouter initialEntries={['/train/terheles']}>{ui}</MemoryRouter>)
}

function trigger() {
  return screen.getByRole('button', { name: `${TITLE} — mit jelent?` })
}

test('renders the kit text link showing the title, with the aria-label verbatim', () => {
  renderButton()
  const btn = trigger()
  expect(btn).toHaveClass('fo-lk', 'ex-info-lk')
  // the round ⓘ chip and its legacy class left with the approved prototype
  expect(btn).not.toHaveClass('pl-info')
  expect(btn).toHaveAttribute('type', 'button')
  expect(btn.textContent).toBe(TITLE)
  expect(btn.querySelector('svg')).toBeNull()
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

test('`eyebrow` puts the context line above the title; `icon` changes the sheet bubble', async () => {
  const user = userEvent.setup()
  renderButton(<InfoButton title={TITLE} copy={COPY} eyebrow="Izomcsoportok" icon="t-peak" />)
  await user.click(trigger())
  const dialog = screen.getByRole('dialog', { name: TITLE })
  expect(dialog.querySelector('.fo-she span')?.textContent).toBe('Izomcsoportok')
  expect(dialog.querySelector('.fo-shh .fo-bub use')?.getAttribute('href')).toBe('#t-peak')
})

test('`children` are drawn in the sheet under the copy', async () => {
  const user = userEvent.setup()
  renderButton(<InfoButton title={TITLE} copy={COPY}><p data-testid="drawn">12 szett megvan</p></InfoButton>)
  expect(screen.queryByTestId('drawn')).not.toBeInTheDocument()
  await user.click(trigger())
  const dialog = screen.getByRole('dialog', { name: TITLE })
  expect(within(dialog).getByText(COPY).nextElementSibling).toBe(within(dialog).getByTestId('drawn'))
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
