import { Fragment, type ReactNode } from 'react'
import { useLang } from './lang'

/** Remounts everything beneath it when the language changes, so no screen keeps stale words. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useLang()
  return <Fragment key={lang}>{children}</Fragment>
}
