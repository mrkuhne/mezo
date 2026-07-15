import { hu1 } from '@/shared/lib/huNum'

test('formats one decimal with a comma', () => expect(hu1(78.6)).toBe('78,6'))
test('strips a trailing ,0 for whole numbers', () => expect(hu1(73)).toBe('73'))
test('rounds to one decimal', () => expect(hu1(5.649)).toBe('5,6'))
