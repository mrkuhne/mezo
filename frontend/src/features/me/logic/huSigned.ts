import { hu1 } from '@/shared/lib/huNum'

/** Signed one-decimal Hungarian numeral with U+2212; a value that rounds to zero carries no sign. */
export const huSigned = (n: number): string => {
  const r = Math.round(n * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${hu1(Math.abs(r))}`
}
