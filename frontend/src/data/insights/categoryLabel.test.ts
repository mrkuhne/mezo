import { categoryLabelHu } from './categoryLabel'

test('a régi angol „Trigger” címke magyarul látszik, a többi változatlan', () => {
  expect(categoryLabelHu('Trigger')).toBe('Kiváltó ok')
  expect(categoryLabelHu('Fiziológia')).toBe('Fiziológia')
})
