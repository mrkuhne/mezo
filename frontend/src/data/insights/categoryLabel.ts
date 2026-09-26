/**
 * A minta-kategória címkéje a felhasználónak. A már elmentett sorok és a régi katalógus
 * angol „Trigger” szót hordoz — a határon egyszer fordítjuk (a backend ma már „Kiváltó ok”-ot ír).
 */
const HU: Record<string, string> = { Trigger: 'Kiváltó ok' }

export function categoryLabelHu(label: string): string {
  return HU[label] ?? label
}
