import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'

// GlassBox (mezo-88iwa.13, T12 Task 2): the shared 3D glass modal — portals into the
// phone-frame host exactly like Sheet.tsx, ported visual is the Titanium companion
// prototype's `.wo-glass`/`.wo-glass-card`. Generic (open/onClose/label/tint/children)
// so the T6 active-workout slice can reuse it unchanged.

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

afterEach(() => vi.unstubAllGlobals())

test('renders nothing when closed', () => {
  const { container } = render(
    <GlassBox open={false} onClose={() => {}} label="Kar">tartalom</GlassBox>,
  )
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('opens with role="dialog" and the label, carrying children', () => {
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  const dialog = screen.getByRole('dialog', { name: 'Kar' })
  expect(dialog).toBeInTheDocument()
  expect(screen.getByText('tartalom')).toBeInTheDocument()
})

test('backdrop click calls onClose', async () => {
  const onClose = vi.fn()
  render(<GlassBox open onClose={onClose} label="Kar">tartalom</GlassBox>)
  await userEvent.click(document.querySelector('.gl-backdrop')!)
  expect(onClose).toHaveBeenCalledOnce()
})

test('the × button calls onClose', async () => {
  const onClose = vi.fn()
  render(<GlassBox open onClose={onClose} label="Kar">tartalom</GlassBox>)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(onClose).toHaveBeenCalledOnce()
})

test('clicking inside the card does not call onClose', async () => {
  const onClose = vi.fn()
  render(<GlassBox open onClose={onClose} label="Kar">tartalom</GlassBox>)
  await userEvent.click(screen.getByText('tartalom'))
  expect(onClose).not.toHaveBeenCalled()
})

test('Escape calls onClose', async () => {
  const onClose = vi.fn()
  render(<GlassBox open onClose={onClose} label="Kar">tartalom</GlassBox>)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})

test('Escape does nothing while closed', async () => {
  const onClose = vi.fn()
  render(<GlassBox open={false} onClose={onClose} label="Kar">tartalom</GlassBox>)
  await userEvent.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
})

test('tint lands as the --gl-tint custom property on the card', () => {
  render(<GlassBox open onClose={() => {}} label="Kar" tint="#ff6b4a">tartalom</GlassBox>)
  const card = document.querySelector<HTMLElement>('.gl-card')!
  expect(card.style.getPropertyValue('--gl-tint')).toBe('#ff6b4a')
})

test('no tint prop leaves --gl-tint unset on the card (CSS default takes over)', () => {
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  const card = document.querySelector<HTMLElement>('.gl-card')!
  expect(card.style.getPropertyValue('--gl-tint')).toBe('')
})

// mezo-88iwa.7 fix wave I4: the glass PORTALS out of the `.wo-card` subtree that sets
// `--ex-color`, so every ported `.gl-card .wo-…` rule reading it rendered untinted
// (measured white) inside the glass. The tint is published under BOTH names.
test('tint also lands as --ex-color so the ported wo- rules inside the glass stay tinted', () => {
  render(<GlassBox open onClose={() => {}} label="Kar" tint="#ff6b4a">tartalom</GlassBox>)
  const card = document.querySelector<HTMLElement>('.gl-card')!
  expect(card.style.getPropertyValue('--ex-color')).toBe('#ff6b4a')
})

test('no tint prop leaves --ex-color unset too', () => {
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  const card = document.querySelector<HTMLElement>('.gl-card')!
  expect(card.style.getPropertyValue('--ex-color')).toBe('')
})

// mezo-88iwa.7 fix wave I3: prototype.css ships `.gl-card.is-menu` / `.gl-card.is-confirm`
// rules that never applied, because GlassBox emitted no modifier class at all.
test.each(['menu', 'confirm'] as const)('variant="%s" appends is-%s to the card', (variant) => {
  render(<GlassBox open onClose={() => {}} label="Kar" variant={variant}>tartalom</GlassBox>)
  expect(document.querySelector('.gl-card')).toHaveClass(`is-${variant}`)
})

test('no variant prop leaves the card unmodified (TrainWeekPage’s usage)', () => {
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  const card = document.querySelector('.gl-card')!
  expect(card.className).not.toMatch(/\bis-(menu|confirm)\b/)
})

test('animates in by default — the backdrop and card carry the gl-anim class', () => {
  stubReducedMotion(false)
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  expect(document.querySelector('.gl-backdrop.gl-anim')).toBeTruthy()
  expect(document.querySelector('.gl-card.gl-anim')).toBeTruthy()
})

test('reduced motion renders the final state — no gl-anim class', () => {
  stubReducedMotion(true)
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  expect(document.querySelector('.gl-backdrop.gl-anim')).toBeFalsy()
  expect(document.querySelector('.gl-card.gl-anim')).toBeFalsy()
  // still rendered, just without the entrance keyframe
  expect(document.querySelector('.gl-card')).toBeTruthy()
})

test('portals into .phone-screen when present (Sheet.tsx idiom)', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  expect(document.querySelector('.gl-card')?.closest('.phone-screen')).toBeTruthy()
  document.querySelector('.phone-screen')!.remove()
})

// mezo-88iwa.13 fix round 2: GlassBox is a Sheet-SIBLING dialog, not a true
// overlay — the backdrop was `position: fixed` (frosts the whole browser
// window, not the phone frame) and the card was `position: relative` (joins
// normal flow and SHRINKS `.screen-content` by its own height on open). The
// fix mirrors Sheet.tsx's proven structure exactly: backdrop and card are
// SIBLINGS under the same portal target (`.phone-screen` here, `.sheet-backdrop`
// + `.sheet` there), both taken out of flow via CSS position (`.gl-backdrop`
// `absolute; inset: 0`, `.gl-card` `absolute; left/right/bottom: 0` in
// prototype.css). jsdom computes no layout, so geometry itself (does the card
// actually sit at the bottom, does opening it leave `.screen-content`'s height
// untouched) is NOT assertable here — that needs a live/manual check. What IS
// assertable, and asserted below, is the DOM-structure invariant the CSS fix
// depends on: card and backdrop are siblings (not nested) directly under the
// portal host, matching Sheet's shape one-for-one.
test('backdrop and card are siblings directly under the portal host (Sheet.tsx shape)', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  const host = document.querySelector('.phone-screen')!
  const backdrop = document.querySelector('.gl-backdrop')!
  const card = document.querySelector('.gl-card')!
  expect(backdrop.parentElement).toBe(host)
  expect(card.parentElement).toBe(host)
  expect(card.previousElementSibling).toBe(backdrop)
  // Neither is nested inside the other — the CSS ports Sheet's sibling
  // pattern rather than nesting the card inside the backdrop.
  expect(backdrop.contains(card)).toBe(false)
  expect(card.contains(backdrop)).toBe(false)
  document.querySelector('.phone-screen')!.remove()
})

// Üvegesítés U10 (mezo-me75u.10): the glass material is the default of the primitive, not an
// opt-in — every caller wears it (bible U8 rule 61). Sheen off (`is-still`), kit hook `uv-gb`.
test('the card wears the glass by default, with no sheen', () => {
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  expect(screen.getByRole('dialog', { name: 'Kar' })).toHaveClass('gl-card', 'glass', 'is-still', 'uv-gb')
})

// mezo-8vfr2: a caller scopes its own dialog through a class, not a `:has()` on its body.
test('className lands on the card, next to the glass classes', () => {
  render(<GlassBox open onClose={() => {}} label="Kar" className="wos-gbx wos-gbx-recs">tartalom</GlassBox>)
  expect(screen.getByRole('dialog', { name: 'Kar' })).toHaveClass('gl-card', 'glass', 'wos-gbx', 'wos-gbx-recs')
})

test('art sits in a lit well in the header; no art, no well', () => {
  const { unmount } = render(
    <GlassBox open onClose={() => {}} label="Kar" art={<svg data-testid="art" />}>tartalom</GlassBox>,
  )
  const well = document.querySelector('.gl-head > .gl-art.uv-well')
  expect(well).toBeTruthy()
  expect(well!.querySelector('[data-testid="art"]')).toBeTruthy()
  unmount()
  render(<GlassBox open onClose={() => {}} label="Kar">tartalom</GlassBox>)
  expect(document.querySelector('.gl-art')).toBeNull()
})
