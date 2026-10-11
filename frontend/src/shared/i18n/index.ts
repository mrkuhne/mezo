import { catalogs, type Messages } from './messages'
import { getLang, useLang } from './lang'

export type { Messages }
export { type Lang, LANGS, LANG_KEY, normalizeLang, deviceLang, resolveInitialLang, getLang, setLang, subscribe, useLang } from './lang'
export { plural } from './plural'
export { LanguageProvider } from './LanguageProvider'

/** The current language's catalog. Callable anywhere (also outside React); never throws. */
export function m(): Messages {
  return catalogs[getLang()] ?? catalogs.hu
}

/** The catalog, re-rendering the caller when the language changes. */
export function useM(): Messages {
  return catalogs[useLang()] ?? catalogs.hu
}
