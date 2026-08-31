import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LIFE_SKILLS, skillDisplay } from '@/features/progression/logic/levelUpMeta'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'

// F7.4 (mezo-d20.8.4.1): the LIFE emoji set retired from the React surfaces — every
// life-area render goes through the clay symbol. The guard's SUBJECT is the FORBIDDEN
// VALUE (the 8 emojis), not a usage count; the meta table keeps `icon` as a plain-text
// fallback only, so the table itself is allowed to carry them.
const LIFE_EMOJIS = ['🧘', '🌱', '🍳', '💰', '🎯', '📚', '🤝', '🛌']

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('LIFE clay iconography guard', () => {
  it('every LIFE skill carries a clay symbol from the i-life-* family', () => {
    for (const s of LIFE_SKILLS) {
      expect(s.clayIcon, s.key).toMatch(/^i-life-/)
    }
    // and skillDisplay surfaces it for the LIFE kind
    expect(skillDisplay('cooking', 'LIFE').clayIcon).toBe('i-life-konyha')
    expect(skillDisplay('bench', 'MUSCLE').clayIcon).toBeUndefined()
  })

  it('GratitudeRows renders clay <use> refs and NO life emoji', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <GratitudeRows rows={['']} onRowsChange={() => {}} lifeArea={null} onLifeAreaChange={() => {}} />
      </QueryClientProvider>,
    )
    const uses = [...container.querySelectorAll('use')].map(u => u.getAttribute('href'))
    expect(uses.filter(h => h?.startsWith('#i-life-')).length).toBe(LIFE_SKILLS.length)
    // the forbidden values: none of the 8 emojis may appear in the rendered output
    for (const e of LIFE_EMOJIS) {
      expect(container.textContent, `emoji ${e} leaked`).not.toContain(e)
    }
  })
})
