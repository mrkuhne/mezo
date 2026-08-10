import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoneWindowsCapsule, type DoneCapsuleRow } from '@/features/fuel/components/DoneWindowsCapsule'

const row = (over: Partial<DoneCapsuleRow> = {}): DoneCapsuleRow => ({
  mealId: 'm1', name: 'Zabkása', time: '07:40', kcal: 580, proteinG: 42,
  role: 'standard', scorePct: 92, clickable: true, ...over,
})

test('the collapsed capsule shows the merged summary line, avg segment included when scored', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 2, kcal: 1240, avgScore: 90 }}
      rows={[row()]}
      open={false}
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.getByText('2 kész ablak · 1 240 kcal · AI-átlag 90 p')).toBeInTheDocument()
})

test('the avg segment is omitted when no done meal is scored', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: null }}
      rows={[row({ scorePct: null })]}
      open={false}
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.getByText('1 kész ablak · 420 kcal')).toBeInTheDocument()
})

test('closed by default — the row list is not rendered until toggled open', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: 92 }}
      rows={[row()]}
      open={false}
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.queryByText('Zabkása')).toBeNull()
})

test('open renders each done row with its role tag and meta line', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: 92 }}
      rows={[row({ role: 'pre' })]}
      open
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.getByText('Zabkása')).toBeInTheDocument()
  expect(screen.getByText('EDZÉS ELŐTTI')).toBeInTheDocument()
  expect(screen.getByText('07:40 · 580 kcal · 42 g P')).toBeInTheDocument()
})

test('a scored row (≥90) shows a ✨ score chip with success tone', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: 92 }}
      rows={[row({ scorePct: 92 })]}
      open
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  const chip = screen.getByText('✨ 92')
  expect(chip.className).toContain('kdone-chip')
  expect(chip.className).not.toContain('kdone-chip-mid')
})

test('a scored row below 90 shows the chip in amber (mid) tone', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: 80 }}
      rows={[row({ scorePct: 80 })]}
      open
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.getByText('✨ 80').className).toContain('kdone-chip-mid')
})

test('a row with no score renders no chip at all — never a fabricated one', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: null }}
      rows={[row({ scorePct: null })]}
      open
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.queryByText(/✨/)).toBeNull()
})

test('clicking a clickable row calls onRowSelect with its mealId', async () => {
  const onRowSelect = vi.fn()
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: 92 }}
      rows={[row({ mealId: 'm42' })]}
      open
      onToggle={() => {}}
      onRowSelect={onRowSelect}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Zabkása/ }))
  expect(onRowSelect).toHaveBeenCalledWith('m42')
})

test('a row without a breakdown (clickable: false) is inert — no button, no click affordance', () => {
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: null }}
      rows={[row({ clickable: false, scorePct: null })]}
      open
      onToggle={() => {}}
      onRowSelect={() => {}}
    />,
  )
  expect(screen.queryByRole('button', { name: /Zabkása/ })).toBeNull()
  expect(screen.getByText('Zabkása')).toBeInTheDocument()
})

test('clicking the capsule header calls onToggle', async () => {
  const onToggle = vi.fn()
  render(
    <DoneWindowsCapsule
      group={{ count: 1, kcal: 420, avgScore: null }}
      rows={[row()]}
      open={false}
      onToggle={onToggle}
      onRowSelect={() => {}}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /kész ablak/ }))
  expect(onToggle).toHaveBeenCalled()
})
