import type { Shape } from '../shape'
import type { fuelKozosHu } from './fuel-kozos.hu'

export const fuelKozosEn: Shape<typeof fuelKozosHu> = {
  macro: { protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fibre', water: 'Water' },
  macroLower: { protein: 'protein', carbs: 'carbs', fat: 'fat', fiber: 'fibre' },
  macroShort: { protein: 'prot.', carbs: 'carbs', fat: 'fat', fiber: 'fibre' },
  facts: { fiber: 'fibre', sugar: 'sugar', salt: 'salt', satFat: 'sat. fat' },
  factsLong: { fiber: 'Fibre', sugar: 'Sugar', salt: 'Salt', satFat: 'Saturated fat' },
  unit: { serving: 'serving', item: 'item' },
  noData: 'no data',
  budget: 'budget',
  bowl: {
    eaten: 'kcal eaten',
    budgetLine: (kcal) => `budget ${kcal} kcal`,
    empty: 'Empty bowl',
    aria: (eaten, target) => `${eaten} / ${target} kcal`,
    ariaSkipped: (eaten, target, skipped) => `${eaten} / ${target} kcal, ${skipped} kcal of it skipped`,
  },
  cup: {
    logged: (kcal, budget) => `Logged: ${kcal} / ${budget} kcal`,
    loggedPct: (kcal, budget, pct) => `Logged: ${kcal} / ${budget} kcal (${pct}%)`,
    budget: (budget) => `Budget: ${budget} kcal`,
  },
  vials: {
    share: (pct) => `${pct}% of energy`,
    aria: (name, grams, pct) => `${name}: ${grams} g · ${pct}% of the energy`,
  },
  cells: {
    aria: (p, ps, c, cs, f, fs, fiber) =>
      `protein ${p} g, ${ps}% of the meal’s energy; carbs ${c} g, ${cs}%; fat ${f} g, ${fs}%; fibre ${fiber}`,
    fiber: (grams, pct) => `${grams} g, ${pct}% of the daily amount`,
    known: (name, grams) => `${name} ${grams} g`,
    none: (name) => `${name} no data`,
  },
  score: {
    pending: 'in progress',
    aria: (score) => `Mezo’s rating: ${score}`,
  },
  gly: {
    level: { low: 'low', mid: 'medium', high: 'high' },
    levelCap: { low: 'Low', mid: 'Medium', high: 'High' },
    chipAria: (word) => `Blood sugar response: ${word}`,
    bandAria: (word) => `Blood sugar response band: ${word}`,
  },
  source: { pantry: 'pantry', recipe: 'recipe', estimate: 'estimate', ai: 'AI', review: 'check it' },
  nova: { n1: 'Whole food', n2: 'Kitchen ingredient', n3: 'Processed', n4: 'Ultra-processed' },
  line: {
    remove: (name) => `Remove ${name}`,
    amount: (name) => `Amount of ${name}`,
  },
  gentle: 'Gentle mode',
}
