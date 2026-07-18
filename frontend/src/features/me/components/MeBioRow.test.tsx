import { render, waitFor } from '@testing-library/react'
import { MeBioRow } from '@/features/me/components/MeBioRow'
import { QueryWrapper } from '@/test/queryWrapper'

test('renders the one-line biometrics once the profile resolves', async () => {
  const { container } = render(
    <QueryWrapper>
      <MeBioRow />
    </QueryWrapper>,
  )
  await waitFor(() => expect(container.querySelector('.me-biorow')).toHaveTextContent('cm'))
})
