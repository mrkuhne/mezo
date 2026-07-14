/** Rest Live-Activity timing (spec §4.5). No rest field exists in the data model:
    150s matches the mockup's compound rest (2:30), 90s the legacy timer chip. */
export function restSecondsFor(type: string): number {
  return type === 'compound' ? 150 : 90
}

export function fmtMMSS(s: number): string {
  const c = Math.max(0, s)
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`
}
