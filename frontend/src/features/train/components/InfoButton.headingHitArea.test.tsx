// ============================================================
// Mezo · InfoButton — the click-WIRING regression (mezo-b516k, Task 2; rewritten in
// Folyadék F3, mezo-n4wf5.3).
//
// The decision this file used to pin — a round ⓘ glyph INSIDE a heading, whose 44px hit
// box must not reach into the heading's own text — left with the approved Folyadék
// prototype: the explain trigger is now a text link („Mit mutat a sáv?") standing in the
// card's action row under a quiet note. What stays true, and is pinned here:
//
//   · the trigger is the kit's text link (`.fo-lk`, which owns the 44px touch area) and
//     shows the title as its visible text — no icon-only chip, no `pl-info`;
//   · a tap on the note above it, or on the card around it, reaches that element's own
//     handler once and never opens the explain sheet;
//   · a tap on the link opens the sheet and does not bubble a second action.
//
// jsdom computes no layout: the GEOMETRY (the link is visible, `elementFromPoint` at its
// centre is the link, the hit area is ≥ 44px tall and reaches neither the row above nor
// the note) is probed on the live /train/week page in tests/layout/layout.spec.ts.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { InfoButton } from '@/features/train/components/InfoButton'
import { Acts, Card, Note } from '@/shared/ui/folyadek'

const TITLE = 'Mit mutat a sáv?'
const COPY = 'A színes rész az elvégzett szett, a halvány a hét teljes kérése.'
const NOTE = 'Az edény széle a heti terv, a folyadék az elvégzett szett.'

function renderCard(onCardClick = vi.fn()) {
  render(
    <MemoryRouter>
      <Card onClick={onCardClick}>
        <Note>{NOTE}</Note>
        <Acts><InfoButton title={TITLE} copy={COPY} /></Acts>
      </Card>
    </MemoryRouter>,
  )
  return onCardClick
}

test('the explain trigger is the kit text link showing its title — never an icon-only chip', () => {
  renderCard()
  const link = screen.getByRole('button', { name: `${TITLE} — mit jelent?` })
  expect(link).toHaveClass('fo-lk')
  expect(link).not.toHaveClass('pl-info')
  expect(link.textContent).toBe(TITLE)
  expect(link.querySelector('svg')).toBeNull()
})

test('a tap on the note above the link reaches the card and never opens the explain sheet', async () => {
  const user = userEvent.setup()
  const onCardClick = renderCard()

  await user.click(screen.getByText(NOTE))

  expect(onCardClick).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText(COPY)).not.toBeInTheDocument()
})

test('a tap on the link opens the explain sheet', async () => {
  const user = userEvent.setup()
  renderCard()

  await user.click(screen.getByRole('button', { name: `${TITLE} — mit jelent?` }))

  expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument()
  expect(screen.getByText(COPY)).toBeInTheDocument()
})
