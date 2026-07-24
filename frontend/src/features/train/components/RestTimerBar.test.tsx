import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { RestTimerBar } from '@/features/train/components/RestTimerBar'

const noop = () => {}

test('running: shows the Pihenő eyebrow, mm:ss and a proportional fill', () => {
  const { container } = render(
    <RestTimerBar remaining={90} total={150} paused={false} onPause={noop} onResume={noop} onSkip={noop} />,
  )
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
  expect(screen.getByText('1:30')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő szüneteltetése' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő kihagyása' })).toBeInTheDocument()
  expect((container.querySelector('.restbar .fill') as HTMLElement).style.width).toBe('60%')
})

test('paused: shows Szünetel + the resume button instead of pause', () => {
  render(<RestTimerBar remaining={80} total={150} paused onPause={noop} onResume={noop} onSkip={noop} />)
  expect(screen.getByText('Szünetel')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő folytatása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Pihenő szüneteltetése' })).toBeNull()
})

test('buttons fire their callbacks; the bar body does nothing (accidental-skip guard)', async () => {
  const user = userEvent.setup()
  const onPause = vi.fn()
  const onSkip = vi.fn()
  const { container } = render(
    <RestTimerBar remaining={90} total={150} paused={false} onPause={onPause} onResume={noop} onSkip={onSkip} />,
  )
  await user.click(screen.getByRole('button', { name: 'Pihenő szüneteltetése' }))
  expect(onPause).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  expect(onSkip).toHaveBeenCalledOnce()
  await user.click(container.querySelector('.restbar .lay') as HTMLElement)
  expect(onPause).toHaveBeenCalledOnce() // unchanged — body click is inert
  expect(onSkip).toHaveBeenCalledOnce()
})
