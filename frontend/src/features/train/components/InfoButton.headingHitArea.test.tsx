// ============================================================
// Mezo · InfoButton — the heading click-WIRING regression (mezo-b516k, Task 2).
//
// This guards the WIRING, not the geometry: jsdom computes no layout, so it cannot
// tell whether the `::after` hit box's 44px box actually overlaps the heading text on
// screen — that is a real geometric probe, in the Playwright layout suite
// (frontend/tests/layout/layout.spec.ts, `.pl-info` heading hit-box probe), against a
// live page. What IS assertable here, in jsdom, is the EVENT WIRING: a click that
// lands on the heading's own text must reach the heading's own handler once — not be
// swallowed by an intervening element, and not emitted as a click on the explain
// button (which would open the glass). Several screens have handlers that fire on a
// tap anywhere on the page or on the heading itself (MesoTemplateStoryPage's
// „arming Törlés then tapping anything else disarms it" test taps the heading TEXT),
// so a misrouted click here would open the glass over them.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { InfoButton } from '@/features/train/components/InfoButton'

const TITLE = 'Mit jelent a szám?'
const COPY = 'Ennyi munkaszettet kap az izom egy héten, ha ebből a sablonból indítasz.'

test.each(['pl-h3', 'ld-h3'])(
  'a tap on a %s heading’s own text reaches the heading and never opens the explain glass',
  async (headingClass) => {
    const user = userEvent.setup()
    const onHeadingClick = vi.fn()
    render(
      <MemoryRouter>
        <h3 className={headingClass} onClick={onHeadingClick}>
          Heti szettek izmonként
          <InfoButton title={TITLE} copy={COPY} />
        </h3>
      </MemoryRouter>,
    )

    await user.click(screen.getByText('Heti szettek izmonként'))

    expect(onHeadingClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(COPY)).not.toBeInTheDocument()
  },
)
