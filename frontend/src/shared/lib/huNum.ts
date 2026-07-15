/** Hungarian 1-decimal number: comma separator, trailing ",0" stripped (78.6 → "78,6", 73 → "73"). */
export const hu1 = (v: number): string => v.toFixed(1).replace(/\.0$/, '').replace('.', ',')
