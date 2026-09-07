import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ConferenceArchiveSheet } from './ConferenceArchiveSheet'
import { MOCK_CONFERENCES } from '@/data/character/characterMock'

function renderSheet(overrides: Partial<Parameters<typeof ConferenceArchiveSheet>[0]> = {}) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <ConferenceArchiveSheet
      conferences={MOCK_CONFERENCES}
      currentId="w2"
      onPick={onPick}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { ...utils, onPick, onClose }
}

describe('ConferenceArchiveSheet', () => {
  test('a sorok hónapok szerint csoportosulnak', () => {
    renderSheet()
    expect(screen.getByText('2026 · augusztus')).toBeInTheDocument()
    expect(screen.getByText('2026 · július')).toBeInTheDocument()
    expect(screen.getByText('2025 · december')).toBeInTheDocument()
  })

  test('évváltásnál év-elválasztó jelenik meg', () => {
    // Sheet portals its content to document.body (no `.phone-screen` in this test), so a
    // sibling of RTL's own `container` div — query the document, not `container` (repo
    // convention for portaled content, see src/app/AppHeader.test.tsx and friends).
    renderSheet()
    const years = Array.from(document.querySelectorAll('.kr-arcyr')).map((el) => el.textContent)
    expect(years).toEqual(['2025'])
  })

  test('a nyitott konzílium sora kiemelt', () => {
    renderSheet()
    const on = document.querySelectorAll('.kr-arcrow.on')
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toContain('augusztus 30.')
  })

  test('a sor a nem nulla kimenetet mutatja', () => {
    renderSheet()
    const row = screen.getByRole('button', { name: /augusztus 30/ })
    expect(within(row).getByText('2 bekerült · 1 nyugdíjazva · 1 portré átírva')).toBeInTheDocument()
  })

  test('a csupa nulla kimenetű sor nem ír ki nullát', () => {
    renderSheet()
    const row = screen.getByRole('button', { name: /augusztus 16/ })
    expect(within(row).queryByText(/0 /)).toBeNull()
    expect(row.textContent).not.toContain('bekerült')
  })

  test('az egyéb változás a megnevezett tételek után jelenik meg', () => {
    const conferences = [
      { id: 'x2', kind: 'WEEKLY' as const, weekStart: '2026-08-24', generatedAt: '2026-08-30T07:00:00Z',
        outcome: { accepted: 2, retired: 1, portraitRewritten: 1, other: 3 } },
    ]
    renderSheet({ conferences, currentId: null })
    const row = screen.getByRole('button', { name: /augusztus 30/ })
    // The "egyéb" fragment renders in its own styled span (nested inside .kr-arcout), so it is
    // not part of the outer span's own text nodes — assert on the row's full text instead.
    expect(row.textContent).toContain('2 bekerült · 1 nyugdíjazva · 1 portré átírva')
    expect(within(row).getByText('3 egyéb változás')).toBeInTheDocument()
    expect(row.textContent!.indexOf('1 portré átírva')).toBeLessThan(row.textContent!.indexOf('3 egyéb változás'))
  })

  test('a csak egyéb változást hozó konzílium sora nem üres', () => {
    const conferences = [
      { id: 'x1', kind: 'WEEKLY' as const, weekStart: '2026-08-17', generatedAt: '2026-08-23T07:00:00Z',
        outcome: { accepted: 0, retired: 0, portraitRewritten: 0, other: 2 } },
    ]
    renderSheet({ conferences, currentId: null })
    const row = screen.getByRole('button', { name: /augusztus 23/ })
    expect(within(row).getByText('2 egyéb változás')).toBeInTheDocument()
    expect(row.textContent).not.toContain('bekerült')
  })

  test('választáskor a lap bezáródik és jelzi a választott konzíliumot', async () => {
    const { onPick } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /augusztus 23/ }))
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('w1'))
  })
})
