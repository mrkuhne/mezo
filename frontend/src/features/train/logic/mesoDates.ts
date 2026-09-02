// ============================================================
// Mezo · mesoDates — HU month date helpers used by the mesocycle wizard.
// Moved verbatim out of the retired planner.ts (wizard v2, mezo-d20.14):
// the 5-step AI planner is gone, but addWeeks/getSeason are still consumed
// by mesoPlan.ts / mesoPlanMock.ts for wizard-generated program dates.
//   - addWeeks (HU month math), getSeason (Tavasz/Nyár/Ősz/Tél)
// ============================================================

// --- HU month helpers (meso-planner.jsx:883-902) ---
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Adds whole weeks to a "<Mon> <day>" HU date string, rolling over month
 *  boundaries. e.g. addWeeks('Jún 16', 6) → 'Júl 28'. */
export function addWeeks(startDate: string, weeks: number): string {
  const parts = startDate.split(' ')
  let m = HU_MONTHS.indexOf(parts[0])
  let d = parseInt(parts[1], 10) + weeks * 7
  while (m >= 0 && d > HU_MONTH_DAYS[m]) {
    d -= HU_MONTH_DAYS[m]
    m = (m + 1) % 12
  }
  return `${HU_MONTHS[m]} ${d}`
}

/** Maps a "<Mon> <day>" HU date string to its season label. */
export function getSeason(startDate: string): string {
  const m = startDate.split(' ')[0]
  if (['Már', 'Ápr', 'Máj'].includes(m)) return 'Tavasz'
  if (['Jún', 'Júl', 'Aug'].includes(m)) return 'Nyár'
  if (['Szep', 'Okt', 'Nov'].includes(m)) return 'Ősz'
  return 'Tél'
}
