import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { InfoButton, INFO_TINT } from '@/features/train/components/InfoButton'

// InfoButton (mezo-b516k, Task 1) — the Train explain layer's one primitive.
// Ports the prototype's `info()` helper + `infoGlass()` (companion-titanium:
// plan-pages.js:130-131, navigation.js:88-101) onto the shipped GlassBox.

const TITLE = 'Mit mutat a sáv?'
const COPY =
  'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon.'

function renderButton(ui = <InfoButton title={TITLE} copy={COPY} />) {
  return render(<MemoryRouter initialEntries={['/train/terheles']}>{ui}</MemoryRouter>)
}

function trigger() {
  return screen.getByRole('button', { name: `${TITLE} — mit jelent?` })
}

test('renders an icon-only button carrying the prototype aria-label verbatim', () => {
  renderButton()
  const btn = trigger()
  expect(btn).toHaveClass('pl-info')
  expect(btn).toHaveAttribute('type', 'button')
  // Icon-only: no visible text at all, only the aria-label (the prototype inlines it
  // inside an <h3>, where any rendered text would read as part of the heading).
  expect(btn.textContent).toBe('')
})

test('the glass is closed until the button is tapped', () => {
  renderButton()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText(COPY)).not.toBeInTheDocument()
})

test('tapping it opens a GlassBox whose label is the title, tinted the fixed explain-layer accent', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())

  const dialog = screen.getByRole('dialog', { name: TITLE })
  expect(dialog).toHaveClass('gl-card')
  // The prototype's infoGlass hardcodes --ex-color:#bca6f1 for EVERY info glass —
  // it is the explain layer's identity colour, never the section's own tint.
  expect(INFO_TINT).toBe('#bca6f1')
  expect(dialog.getAttribute('style')).toContain(INFO_TINT)
})

test('the open glass carries the eyebrow, the title and the copy paragraph', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('MEZO · RÉSZLET')).toBeInTheDocument()
  expect(within(dialog).getByText(TITLE, { selector: 'strong' })).toBeInTheDocument()
  const copy = within(dialog).getByText(COPY)
  expect(copy).toHaveClass('pl-info-copy')
})

test('Escape closes the glass', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a backdrop click closes the glass', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  await user.click(document.querySelector('.gl-backdrop')!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the ✕ closes the glass', async () => {
  const user = userEvent.setup()
  renderButton()
  await user.click(trigger())
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// The prototype auto-closes the info layer on `hashchange` (navigation.js:100).
// GlassBox itself listens for nothing of the sort — this primitive owns it, so a
// client-side route change leaves no orphaned glass hanging over the next screen.
test('a ROUTE CHANGE closes the glass', async () => {
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
