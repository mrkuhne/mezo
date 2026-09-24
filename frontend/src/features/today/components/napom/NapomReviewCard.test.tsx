import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NapomReviewCard } from '@/features/today/components/napom/NapomReviewCard'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import type { NormalizedDayEvaluation } from '@/data/me/dayEvaluation'

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

const evaluation: Pick<NormalizedDayEvaluation, 'narrative' | 'highlights' | 'reviewId'> = {
  narrative: ['Első bekezdés.', 'Második bekezdés.'],
  // wire order is win-first; the card reads key → pattern → win
  highlights: [
    { kind: 'win', label: 'Teljes napi logolás' },
    { kind: 'pattern', label: 'Edzésnapon jobb az alvásod' },
    { kind: 'key', label: 'A fehérjecél tartása' },
  ],
  reviewId: '4c9e6b1a-9f2d-4b7e-8a3c-1d2e3f4a5b6c',
}

function renderCard(ev = evaluation) {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter initialEntries={['/nap/napom/2026-05-18']}>
          <NapomReviewCard evaluation={ev} date="2026-05-18" i={3} />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('NapomReviewCard', () => {
  test('narrative paragraphs, flat highlight cells in key → pattern → win order', () => {
    const { container } = renderCard()
    expect(screen.getByText('MEZO · A NAPODRÓL')).toBeInTheDocument()
    expect(container.querySelectorAll('.napom-note p')).toHaveLength(2)
    expect([...container.querySelectorAll('.napom-hl')].map((h) => h.querySelector('.uv-eyebrow')?.textContent))
      .toEqual(['A NAP KULCSA', 'FELISMERT MINTA', 'JÓ IRÁNY'])
    expect(container.querySelector('.napom-note')).toHaveClass('glass')
    expect(container.querySelector('.napom-hl.glass')).toBeNull()
  })

  test('feedback chips mount only with a reviewId', () => {
    const { unmount } = renderCard()
    expect(screen.getByRole('button', { name: /Segített/ })).toBeInTheDocument()
    unmount()
    renderCard({ ...evaluation, reviewId: null })
    expect(screen.queryByRole('button', { name: /Segített/ })).toBeNull()
  })

  test('the chat button opens a day conversation', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole('button', { name: /Beszélgess a napról/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/mezo/chat')
  })
})
