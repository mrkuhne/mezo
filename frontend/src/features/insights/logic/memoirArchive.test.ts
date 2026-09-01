import { groupByMonth } from '@/features/insights/logic/memoirArchive'
import type { MemoirEntry } from '@/data/types'

const entry = (weekStart: string): MemoirEntry => ({
  id: `m-${weekStart}`, weekStart, week: 'x', title: 't', body: 'b\n\nc', anchors: [],
})

describe('groupByMonth (F7.5)', () => {
  it('groups desc-ordered entries under hu-HU month heads, order preserved', () => {
    const groups = groupByMonth([
      entry('2026-05-11'), entry('2026-05-04'), entry('2026-04-20'), entry('2026-03-30'),
    ])
    expect(groups.map((g) => g.label)).toEqual(['Május', 'Április', 'Március'])
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[0].entries[0].weekStart).toBe('2026-05-11')
  })

  it('appends the year when the archive spans multiple years', () => {
    const groups = groupByMonth([entry('2026-01-05'), entry('2025-12-29')])
    expect(groups.map((g) => g.label)).toEqual(['Január 2026', 'December 2025'])
  })

  it('returns no groups for an empty archive', () => {
    expect(groupByMonth([])).toEqual([])
  })
})
