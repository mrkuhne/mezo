import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MeHead } from '@/features/me/components/MeHead'
import { QueryWrapper } from '@/test/queryWrapper'

function renderHead(onOpenSettings = () => {}) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me']}>
        <MeHead onOpenSettings={onOpenSettings} />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the identity name from the profile statics', () => {
  renderHead()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(document.querySelector('.avatar')).toHaveTextContent('D')
})

test('gear button calls onOpenSettings', async () => {
  const onOpenSettings = vi.fn()
  renderHead(onOpenSettings)
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  expect(onOpenSettings).toHaveBeenCalledTimes(1)
})

test('renders the one-line biometrics once the profile resolves', async () => {
  renderHead()
  // age/height/body-fat from the biometric profile, latest kg from the weight log
  await waitFor(() => expect(document.querySelector('.mehead .t2')).toHaveTextContent('cm'))
})
