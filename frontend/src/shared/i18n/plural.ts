import { getLang } from './lang'

/** Picks the form for n by the current language's plural rule (hu and en: 1 → one, else other). */
export function plural(n: number, forms: { one: string; other: string }): string {
  const rule = new Intl.PluralRules(getLang() === 'hu' ? 'hu-HU' : 'en-GB').select(n)
  return rule === 'one' ? forms.one : forms.other
}
