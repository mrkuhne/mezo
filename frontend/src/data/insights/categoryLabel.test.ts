import { categoryLabelHu } from './categoryLabel'

test('a régi angol „Trigger”/„Response” címke magyarul látszik, a többi változatlan', () => {
  expect(categoryLabelHu('Trigger')).toBe('Kiváltó ok')
  expect(categoryLabelHu('Response')).toBe('Reakció')
  expect(categoryLabelHu('Fiziológia')).toBe('Fiziológia')
})
