import { mergeProgress, readLocalProgress, writeLocalProgress, TUTORIAL_SEEN_KEY } from '@/shared/lib/tutorialSeen'

const e = (seenAt: string, version = 1) => ({ version, seenAt, completedAt: null, dismissedAtStep: null })

beforeEach(() => localStorage.clear())

test('üres tárból üres map, hibás JSON-ból is üres map', () => {
  expect(readLocalProgress()).toEqual({})
  localStorage.setItem(TUTORIAL_SEEN_KEY, '{nem json')
  expect(readLocalProgress()).toEqual({})
})

test('write → read körbeér', () => {
  writeLocalProgress({ fuel: e('2026-09-02T12:00:00.000Z') })
  expect(readLocalProgress()).toEqual({ fuel: e('2026-09-02T12:00:00.000Z') })
})

test('merge: unió, kulcsonként a későbbi seenAt nyer, döntetlennél a lokális', () => {
  const server = { fuel: e('2026-09-02T12:00:00.000Z', 1), nap: e('2026-09-01T08:00:00.000Z') }
  const local = { fuel: e('2026-09-02T12:00:00.000Z', 2), me: e('2026-09-02T13:00:00.000Z') }
  expect(mergeProgress(server, local)).toEqual({
    fuel: e('2026-09-02T12:00:00.000Z', 2),
    nap: e('2026-09-01T08:00:00.000Z'),
    me: e('2026-09-02T13:00:00.000Z'),
  })
  const newerServer = { fuel: e('2026-09-03T12:00:00.000Z', 3) }
  expect(mergeProgress(newerServer, local).fuel.version).toBe(3)
})
