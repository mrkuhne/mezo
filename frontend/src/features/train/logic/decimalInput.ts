/**
 * A typed weight → kg, accepting the HU decimal comma as well as a dot (mezo-py1i6):
 * the phone's decimal keypad in a Hungarian locale offers only the comma. Null for an
 * empty, half-typed-to-nothing or non-numeric draft — the caller keeps its last value.
 * No rounding beyond 2 places (float noise), so 101,25 stays 101.25.
 */
export function parseDecimal(text: string): number | null {
  const raw = text.trim().replace(',', '.')
  if (!/^\d*\.?\d*$/.test(raw) || !/\d/.test(raw)) return null
  return +Number(raw).toFixed(2)
}

/** A kg value as the HU keypad writes it: 97.5 → "97,5". */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',')
}
