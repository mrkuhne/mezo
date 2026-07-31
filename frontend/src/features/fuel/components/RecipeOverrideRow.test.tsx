import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'

function row(over: Partial<React.ComponentProps<typeof RecipeOverrideRow>> = {}) {
  const onChange = vi.fn()
  const onReset = vi.fn()
  render(
    <RecipeOverrideRow
      name="Banán" unit="db" originalAmount={1} amount={1} kcal={105}
      onChange={onChange} onReset={onReset} {...over}
    />,
  )
  return { onChange, onReset }
}

describe('RecipeOverrideRow', () => {
  it('steps by 0.5 for a discrete unit', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán csökkentés/i }))
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('steps by 10 for a gram unit', () => {
    const { onChange } = row({ unit: 'g', originalAmount: 60, amount: 60 })
    fireEvent.click(screen.getByRole('button', { name: /banán növelés/i }))
    expect(onChange).toHaveBeenCalledWith(70)
  })

  it('never steps below zero', () => {
    const { onChange } = row({ amount: 0.5 })
    fireEvent.click(screen.getByRole('button', { name: /banán csökkentés/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('accepts a typed decimal with a Hungarian comma', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: '0,25' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(0.25)
  })

  it('ignores an unparseable entry and keeps the current amount', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: 'kb. egy' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores a negative entry', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: '-2' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks a changed line and offers a reset', () => {
    const { onReset } = row({ amount: 0.5 })
    expect(screen.getByText(/mód/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /banán visszaállítás/i }))
    expect(onReset).toHaveBeenCalled()
  })

  it('shows no MÓD chip when the amount is unchanged', () => {
    row()
    expect(screen.queryByText(/mód/i)).not.toBeInTheDocument()
  })
})
