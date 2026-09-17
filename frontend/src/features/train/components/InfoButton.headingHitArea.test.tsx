// ============================================================
// Mezo · InfoButton — the heading HIT-AREA regression (mezo-b516k, Task 2).
//
// The explain button is a 22px glyph with a 44px `::after` hit box (the house touch
// rule), so the box overflows the glyph by 11px per side while `.pl-h3`/`.ld-h3` only
// put a 7px gap between the heading text and the button — the box therefore reaches
// ~4px INTO the heading text's own box. Several screens have handlers that fire on a
// tap anywhere on the page or on the heading itself (MesoTemplateStoryPage's
// „arming Törlés then tapping anything else disarms it" test taps the heading TEXT),
// and a tap that landed on the explain button instead would open the glass over them.
//
// This is the shared guard for the whole placement grammar: a click on a heading's own
// text must reach the heading and must NOT open the explain glass.
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
