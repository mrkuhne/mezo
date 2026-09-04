import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableList, type SortableListProps } from '@/shared/ui/SortableList'

function renderList(props: Partial<SortableListProps<{ id: string; label?: string }>> = {}) {
  return render(
    <SortableList
      items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]}
      onReorder={vi.fn()}
      renderItem={(it) => <span>{it.label}</span>}
      {...props}
    />,
  )
}

test('▲▼ buttons reorder items and call onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  render(<SortableList items={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]}
    onReorder={onReorder} renderItem={(it)=> <span>{it.label}</span>} />)
  await userEvent.click(screen.getByRole('button', { name: 'B feljebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['b','a','c'])
})

test('▼ button moves an item down and calls onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  render(<SortableList items={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]}
    onReorder={onReorder} renderItem={(it)=> <span>{it.label}</span>} />)
  await userEvent.click(screen.getByRole('button', { name: 'A lejjebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['b','a','c'])
})

test('the first row ▲ and the last row ▼ are disabled (cannot move past the ends)', () => {
  render(<SortableList items={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]}
    onReorder={vi.fn()} renderItem={(it)=> <span>{it.label}</span>} />)
  expect(screen.getByRole('button', { name: 'A feljebb' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'C lejjebb' })).toBeDisabled()
})

test('disabled prop disables every reorder control', () => {
  render(<SortableList disabled items={[{id:'a',label:'A'},{id:'b',label:'B'}]}
    onReorder={vi.fn()} renderItem={(it)=> <span>{it.label}</span>} />)
  expect(screen.getByRole('button', { name: 'B feljebb' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'A lejjebb' })).toBeDisabled()
})

test('falls back to item.id for the control label when no label is given', () => {
  render(<SortableList items={[{id:'x'},{id:'y'}]}
    onReorder={vi.fn()} renderItem={(it)=> <span>{it.id}</span>} />)
  expect(screen.getByRole('button', { name: 'x lejjebb' })).toBeInTheDocument()
})

test('chevrons="focus" hides the reorder buttons visually but keeps them focusable', () => {
  const { container } = renderList({ chevrons: 'focus' })
  const chev = container.querySelector('.srt-chev') as HTMLElement
  expect(chev).toHaveClass('srt-chev-focus')
  // a gombok az a11y fában maradnak — csak CSS rejti őket
  expect(within(chev).getByRole('button', { name: /feljebb/i })).toBeInTheDocument()
})

test('the default keeps the chevrons visible', () => {
  const { container } = renderList()
  expect(container.querySelector('.srt-chev')).not.toHaveClass('srt-chev-focus')
})
