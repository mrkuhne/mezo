import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PatternFilterSheet } from '@/features/insights/components/PatternFilterSheet'

test('keeps filter changes as a draft and applies them together', () => {
  const onApply = vi.fn()
  render(
    <PatternFilterSheet
      domain={null}
      sort="progress"
      availableDomains={['sleep', 'fuel', 'other']}
      onApply={onApply}
      onClose={vi.fn()}
    />,
  )

  expect(screen.getByRole('button', { name: 'Mind' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Alvás' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Sorrend' }), { target: { value: 'domain' } })
  expect(onApply).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Alkalmazom' }))
  expect(onApply).toHaveBeenCalledWith({ domain: 'sleep', sort: 'domain' })
})

test('closing the sheet discards the draft', async () => {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(
    <PatternFilterSheet
      domain="fuel"
      sort="progress"
      availableDomains={['sleep', 'fuel']}
      onApply={onApply}
      onClose={onClose}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Alvás' }))
  fireEvent.click(screen.getByRole('button', { name: 'Szűrő bezárása' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(onApply).not.toHaveBeenCalled()
})
