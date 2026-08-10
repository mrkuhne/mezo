import { hu1, huInt } from '@/shared/lib/huNum'

test('formats one decimal with a comma', () => expect(hu1(78.6)).toBe('78,6'))
test('strips a trailing ,0 for whole numbers', () => expect(hu1(73)).toBe('73'))
test('rounds to one decimal', () => expect(hu1(5.649)).toBe('5,6'))

test('huInt groups thousands with a regular space', () => expect(huInt(1300)).toBe('1 300'))
test('huInt leaves sub-1000 values ungrouped', () => expect(huInt(420)).toBe('420'))
test('huInt uses the Unicode minus for negative values', () => expect(huInt(-1300)).toBe('−1 300'))
test('huInt rounds to the nearest integer', () => expect(huInt(1299.6)).toBe('1 300'))
