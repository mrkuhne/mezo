// AI-score tone ladder (mezo-zeeq) — ONE rule for the block pill, MealScoreChip and the
// score-sheet hero, so a "közepes" on the card is never a "jó" in the sheet.
export type ScoreTone = 'hi' | 'md' | 'lo'
export interface ScoreToneVM { tone: ScoreTone; cls: 's-hi' | 's-md' | 's-lo'; word: 'jó' | 'közepes' | 'gyenge' }

export function toneOf(pct: number): ScoreToneVM {
  if (pct >= 80) return { tone: 'hi', cls: 's-hi', word: 'jó' }
  if (pct >= 60) return { tone: 'md', cls: 's-md', word: 'közepes' }
  return { tone: 'lo', cls: 's-lo', word: 'gyenge' }
}
