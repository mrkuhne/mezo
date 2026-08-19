/** A free-prose journal note (Journal, mezo-b3pp). Named `JournalNote` — NOT `JournalEntry`:
 * two unrelated `JournalEntry` types already exist in
 * `features/me/logic/growthJournal.ts` and `features/insights/logic/patternHistory.ts`. */
export interface JournalNote {
  id: string
  occurredOn: string
  text: string
  source: 'quickinput' | 'ritual'
  createdAt: string
}
