import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useMe } from '@/data/auth/authHooks'
import { alignLang, announceLang, useLang } from './lang'

/**
 * Remounts everything beneath it when the language changes, so no screen keeps stale words.
 * Once the account is known its language wins over the device cache (account -> cache -> device);
 * signing out keeps the last language, so the login screen stays in the language last used.
 *
 * Two traps this shape avoids:
 * - An account language known at render time is written to the store BEFORE the children render,
 *   so the first paint is already right and nothing flips (and remounts) a moment later.
 * - A change after mount remounts in two phases: first commit the children as unmounted (`null`),
 *   then mount the new tree from a layout effect (no painted blank frame). The new tree's first
 *   render therefore runs against a DOM that no longer holds the old tree, exactly like a cold
 *   start; code that resolves a portal target during render (`document.querySelector('.phone-screen')`)
 *   would otherwise pick the old, about-to-be-removed node and land in a detached subtree.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const accountLang = useMe().data?.language
  const handled = useRef<typeof accountLang>(undefined)
  if (handled.current !== accountLang) {
    handled.current = accountLang
    if (accountLang) alignLang(accountLang)
  }
  const lang = useLang()
  const [mounted, setMounted] = useState(lang)
  useLayoutEffect(() => {
    if (mounted !== lang) setMounted(lang)
  }, [mounted, lang])
  useEffect(() => {
    announceLang()
  }, [lang])
  if (mounted !== lang) return null
  return <Fragment key={lang}>{children}</Fragment>
}
