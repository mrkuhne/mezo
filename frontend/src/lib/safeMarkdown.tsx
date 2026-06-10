import { Fragment, type ReactNode } from 'react'

/** Renders a tiny markdown subset (**bold**) as React nodes. Anything else,
 *  including raw HTML, is rendered as plain escaped text. */
export function SafeMarkdown({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part)
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
