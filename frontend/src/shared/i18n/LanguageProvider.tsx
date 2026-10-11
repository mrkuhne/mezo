import { Fragment, useEffect, type ReactNode } from 'react'
import { useMe } from '@/data/auth/authHooks'
import { getLang, setLang, useLang } from './lang'

/**
 * Remounts everything beneath it when the language changes, so no screen keeps stale words.
 * Once the account is known its language wins over the device cache (account -> cache -> device);
 * signing out keeps the last language, so the login screen stays in the language last used.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useLang()
  const accountLang = useMe().data?.language
  useEffect(() => {
    if (accountLang && accountLang !== getLang()) setLang(accountLang)
  }, [accountLang])
  return <Fragment key={lang}>{children}</Fragment>
}
