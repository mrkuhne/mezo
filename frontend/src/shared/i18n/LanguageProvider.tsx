import { useEffect, useRef, type ReactNode } from 'react'
import { useMe } from '@/data/auth/authHooks'
import { alignLang, announceLang, useLang } from './lang'

/**
 * Keeps the language store in step with the account (account -> device cache -> device language).
 * It never remounts anything: it sits at the app root, above the splash, the router and the shell,
 * and those must live through a language switch. The remount that refreshes code reading the
 * catalog with the non-hook `m()` is `LanguageBoundary`, placed inside each shell.
 *
 * An account language known at render time is written to the store BEFORE the children render, so
 * the first paint is already right and nothing flips a moment later. Signing out keeps the last
 * language, so the login screen stays in the language last used. The device cache is written
 * whenever the account language is known, also when it already equals the store.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const accountLang = useMe().data?.language
  const handled = useRef<typeof accountLang>(undefined)
  if (handled.current !== accountLang) {
    handled.current = accountLang
    if (accountLang) alignLang(accountLang)
  }
  const lang = useLang()
  useEffect(() => {
    announceLang(accountLang !== undefined)
  }, [lang, accountLang])
  return <>{children}</>
}
