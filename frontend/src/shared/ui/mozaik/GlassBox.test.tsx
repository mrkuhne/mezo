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
