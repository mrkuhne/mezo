import { describe, expect, it } from 'vitest'
import { routineSentence, routineSentenceParts, recipeFromDef, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import type { HabitDefInfo } from '@/data/types'

const empty: RoutineRecipe = {
  framework: null, title: '', anchorLabel: '', celebration: '',
  cue: '', craving: '', reward: '', identity: '',
}

describe('routineSentence', () => {
  it('renders the Fogg recipe', () => {
    expect(routineSentence({
      ...empty, framework: 'FOGG', anchorLabel: 'kitöltöttem a reggeli kávét',
      title: 'leírok egy mondatot', celebration: 'ökölrázás',
    })).toBe('Miután kitöltöttem a reggeli kávét, leírok egy mondatot — és logolom. Ünneplésül: ökölrázás.')
  })

  it('renders the Clear recipe with the identity clause', () => {
    expect(routineSentence({
      ...empty, framework: 'CLEAR', cue: '7:10-kor a konyhában', title: 'leírom a napi szándékot',
      craving: 'tisztább a fejem', reward: 'a pipa maga', identity: 'figyel a gondolataira',
    })).toBe('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga. Hogy olyan ember legyek, aki figyel a gondolataira.')
  })

  it('omits the identity clause when identity is empty', () => {
    const s = routineSentence({
      ...empty, framework: 'CLEAR', cue: '21:55', title: 'leteszem a telefont',
      craving: 'reggel nem vagyok szétesve', reward: 'egy fejezet könyv',
    })
    expect(s).toBe('21:55 leteszem a telefont, mert reggel nem vagyok szétesve. Jutalmam: egy fejezet könyv.')
    expect(s).not.toContain('Hogy olyan ember')
  })

  it('falls back to the bare title for a framework-less def', () => {
    expect(routineSentence({ ...empty, title: 'Magnézium' })).toBe('Magnézium.')
  })
})

describe('routineSentenceParts', () => {
  it('marks unfilled slots so the wizard can render dashed blanks', () => {
    const parts = routineSentenceParts({ ...empty, framework: 'FOGG', anchorLabel: 'kávé után' })
    const anchor = parts.find((p) => p.slot === 'anchor')
    const title = parts.find((p) => p.slot === 'title')
    expect(anchor).toEqual({ text: 'kávé után', slot: 'anchor', filled: true })
    expect(title).toEqual({ text: 'pici tett', slot: 'title', filled: false })
  })
})

describe('recipeFromDef', () => {
  it('resolves a stacked anchor key to the anchor habit title', () => {
    const def = {
      id: 'd1', habitKey: 'custom_1', chainKey: 'MORNING', position: 1, title: 'Napi mondat',
      why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
      xp: 10, linkUrl: null, isActive: true, framework: 'FOGG',
      anchorHabitKey: 'morning_sunlight', cue: null, craving: null, reward: null,
      celebration: 'ökölrázás', identity: null,
    } satisfies HabitDefInfo

    const recipe = recipeFromDef(def, (key) => (key === 'morning_sunlight' ? 'Reggeli fény' : undefined))
    expect(recipe.anchorLabel).toBe('kész a Reggeli fény')
  })
})
