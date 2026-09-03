// ============================================================
// Mezo · routineSentence — the one renderer of a habit recipe's Hungarian sentence
// (mezo-3zue). The wizard shows it assembling blank by blank, the hub's habit page shows it
// finished; both call this, so the two can never drift. Pure: no hooks, no formatting of
// anything the caller did not pass in.
// ============================================================
import type { HabitDefInfo, HabitFramework } from '@/data/types'

export type RecipeSlot = 'anchor' | 'title' | 'celebration' | 'cue' | 'craving' | 'reward' | 'identity'

export interface RoutineRecipe {
  framework: HabitFramework | null
  title: string
  /** FOGG: the "miután …" clause, already resolved to prose (see recipeFromDef). */
  anchorLabel: string
  celebration: string
  cue: string
  craving: string
  reward: string
  identity: string
}

export interface SentencePart {
  /** The user's own words when filled, the slot's Hungarian placeholder when not. */
  text: string
  slot?: RecipeSlot
  filled: boolean
}

const PLACEHOLDER: Record<RecipeSlot, string> = {
  anchor: 'horgony',
  title: 'pici tett',
  celebration: 'shine',
  cue: 'jelzés',
  craving: 'vágy',
  reward: 'jutalom',
  identity: 'identitás',
}

const lit = (text: string): SentencePart => ({ text, filled: true })
const slot = (name: RecipeSlot, value: string): SentencePart =>
  value.trim().length > 0
    ? { text: value.trim(), slot: name, filled: true }
    : { text: PLACEHOLDER[name], slot: name, filled: false }

export function routineSentenceParts(recipe: RoutineRecipe): SentencePart[] {
  if (recipe.framework === 'FOGG') {
    return [
      lit('Miután '), slot('anchor', recipe.anchorLabel), lit(', '),
      slot('title', recipe.title), lit(' — és logolom. Ünneplésül: '),
      slot('celebration', recipe.celebration), lit('.'),
    ]
  }
  if (recipe.framework === 'CLEAR') {
    const parts: SentencePart[] = [
      slot('cue', recipe.cue), lit(' '), slot('title', recipe.title),
      lit(', mert '), slot('craving', recipe.craving), lit('. Jutalmam: '),
      slot('reward', recipe.reward), lit('.'),
    ]
    // The identity clause is optional (spec §6): it appears only once the user wrote one, so an
    // untouched field must not leave a dangling "Hogy olyan ember legyek, aki identitás."
    if (recipe.identity.trim().length > 0) {
      parts.push(lit(' Hogy olyan ember legyek, aki '), slot('identity', recipe.identity), lit('.'))
    }
    return parts
  }
  return [slot('title', recipe.title), lit('.')]
}

export function routineSentence(recipe: RoutineRecipe): string {
  return routineSentenceParts(recipe).map((p) => p.text).join('')
}

/** The FOGG placeholder differs per framework — CLEAR's response slot is not "pici tett". */
export function titlePlaceholder(framework: HabitFramework | null): string {
  return framework === 'CLEAR' ? 'tett' : PLACEHOLDER.title
}

export function recipeFromDef(
  def: HabitDefInfo,
  anchorTitleOf: (habitKey: string) => string | undefined,
): RoutineRecipe {
  const anchorTitle = def.anchorHabitKey != null ? anchorTitleOf(def.anchorHabitKey) : undefined
  return {
    framework: def.framework,
    title: def.title,
    anchorLabel: anchorTitle != null ? `kész a ${anchorTitle}` : (def.anchorCopy ?? ''),
    celebration: def.celebration ?? '',
    cue: def.cue ?? '',
    craving: def.craving ?? '',
    reward: def.reward ?? '',
    identity: def.identity ?? '',
  }
}
