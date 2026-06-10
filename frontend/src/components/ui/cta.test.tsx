import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CtaPrimary, CtaGhost } from './Cta'

test('CtaPrimary fires onClick and carries classes', async () => {
  const onClick = vi.fn()
  render(<CtaPrimary onClick={onClick}>INDÍTÁS</CtaPrimary>)
  const btn = screen.getByRole('button', { name: 'INDÍTÁS' })
  expect(btn.className).toContain('cta-primary')
  expect(btn.className).toContain('notch-8')
  await userEvent.click(btn)
  expect(onClick).toHaveBeenCalledOnce()
})
test('CtaGhost renders', () => {
  render(<CtaGhost>MÉGSE</CtaGhost>)
  expect(screen.getByRole('button', { name: 'MÉGSE' }).className).toContain('cta-ghost')
})
