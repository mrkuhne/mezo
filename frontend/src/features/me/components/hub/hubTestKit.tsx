// Shared render wrapper for the Én hub units' tests (mezo-lhqw7): the repo's standard
// QueryWrapper + ThemeProvider + MemoryRouter, plus a probe that prints the full location.
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{pathname + search}</div>
}

export function renderUnit(ui: ReactNode) {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me']}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}
