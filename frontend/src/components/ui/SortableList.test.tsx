import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableList } from './SortableList'

test('▲▼ buttons reorder items and call onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  render(<SortableList items={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]}
    onReorder={onReorder} renderItem={(it)=> <span>{it.label}</span>} />)
  await userEvent.click(screen.getByRole('button', { name: 'B feljebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['b','a','c'])
})
