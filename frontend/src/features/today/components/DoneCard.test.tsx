import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DoneCard, type DoneFact } from '@/features/today/components/DoneCard'

const facts: DoneFact[] = [
  { value: '32', label: 'SZETT' },
  { value: '6', label: 'GYAKORLAT' },
  { value: '4 320', label: 'KG' },
]

const cells = (c: HTMLElement) =>
  [...c.querySelectorAll('.td-dcard-cell')].map((el) => [
    el.querySelector('.td-dcard-v')?.textContent,
    el.querySelector('.td-dcard-l')?.textContent,
  ])

describe('DoneCard', () => {
  test('renders the Kész head and every fact cell', () => {
    const { container } = render(<DoneCard facts={facts} />)
    expect(screen.getByText('Kész')).toBeInTheDocument()
    expect(cells(container)).toEqual([['32', 'SZETT'], ['6', 'GYAKORLAT'], ['4 320', 'KG']])
  })

  // The tappable variant is a <button>; without a handler it must NOT be one — a button that
  // does nothing is the dead control this screen's whole test suite exists to prevent.
  test('is a plain block with no chevron when it has nowhere to go', () => {
    const { container } = render(<DoneCard facts={[{ value: '90', label: 'PERC' }]} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.td-dcard')?.tagName).toBe('DIV')
    expect(container.querySelector('.td-dcard-chev')).toBeNull()
  })

  test('becomes a labelled button with a chevron when it can open something', async () => {
    const onOpen = vi.fn()
    const { container } = render(
      <DoneCard facts={facts} detail="Megnézem az összegzést" onOpen={onOpen} ariaLabel="Befejezett edzés áttekintése" />,
    )
    expect(container.querySelector('.td-dcard-chev')).toBeInTheDocument()
    expect(screen.getByText('Megnézem az összegzést')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Befejezett edzés áttekintése' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  // The caller drops empty facts (Today's strip rule), but a factless card must still stand —
  // a finish with nothing logged is a finish.
  test('survives with no facts at all — the head alone, no empty cell rail', () => {
    const { container } = render(<DoneCard facts={[]} />)
    expect(screen.getByText('Kész')).toBeInTheDocument()
    expect(container.querySelector('.td-dcard-cells')).toBeNull()
  })
})
