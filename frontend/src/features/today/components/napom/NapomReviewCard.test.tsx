import { render, screen } from '@testing-library/react'
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
          <NapomReviewCard evaluation={ev} n={1} />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('NapomReviewCard', () => {
  test('the Mezo message with the narrative paragraphs, highlight rows in key → pattern → win order', () => {
    const { container } = renderCard()
    expect(screen.getByRole('heading', { name: /Mezo a napodról/ })).toBeInTheDocument()
    // a team message: the Mezo badge, the name and the quiet meta
    expect(container.querySelector('.fo-card .fo-msg .fo-badge')).not.toBeNull()
    expect(container.querySelector('.fo-msg .nm')).toHaveTextContent('Mezoa napodról')
    expect(container.querySelectorAll('.fo-msg .fo-txt p')).toHaveLength(2)
    const rows = [...container.querySelectorAll('.nn-hls .fo-row')]
    expect(rows.map((r) => r.querySelector('small')?.textContent)).toEqual(['A nap kulcsa', 'Felismert minta', 'Jó irány'])
    expect(rows.map((r) => r.querySelector('strong')?.textContent))
      .toEqual(['A fehérjecél tartása', 'Edzésnapon jobb az alvásod', 'Teljes napi logolás'])
    expect(rows.map((r) => r.querySelector('use')?.getAttribute('href'))).toEqual(['#t-key', '#t-pattern', '#t-up'])
    expect(container.querySelector('.glass, [class*="uv-"], [class*="napom-"]')).toBeNull()
  })

  test('feedback chips mount only with a reviewId', () => {
    const { unmount } = renderCard()
    expect(screen.getByRole('button', { name: /Segített/ })).toBeInTheDocument()
    unmount()
    renderCard({ ...evaluation, reviewId: null })
    expect(screen.queryByRole('button', { name: /Segített/ })).toBeNull()
  })

  // The day chat hand-off is the hero tank's CTA on the page (NapomPage.test.tsx asserts it opens
  // the conversation) — the card must not draw a second one.
  test('the card draws no chat button of its own', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: /Beszélgess a napról/ })).toBeNull()
    expect(screen.getByTestId('loc')).toHaveTextContent('/nap/napom/2026-05-18')
  })
})
