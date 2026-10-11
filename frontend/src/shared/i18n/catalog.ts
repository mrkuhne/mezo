import { catalogs, type Messages } from './messages'
import { getLang, useLang } from './lang'

export type { Messages }

/** The current language's catalog. Callable anywhere (also outside React); never throws. */
export function m(): Messages {
  return catalogs[getLang()] ?? catalogs.hu
}

/** The catalog, re-rendering the caller when the language changes. */
export function useM(): Messages {
  return catalogs[useLang()] ?? catalogs.hu
}
