import { type ReactNode } from 'react'
import { renderInline } from '@/shared/lib/markdown'

/**
 * Renders a tiny markdown subset (**bold**) as React nodes. Anything else, including raw
 * HTML, is rendered as plain escaped text.
 *
 * This is the INLINE-ONLY, bold-only renderer for **curated app copy** (fuel/train/today
 * strings we write ourselves). Model prose — where `*`, backticks, bullets and blank-line
 * paragraphs all carry meaning — goes through `<Markdown>` in `@/shared/lib/markdown`
 * instead. Bold-only is deliberate here: this app's copy is full of snake_case identifiers
 * and stray asterisks that a richer inline set would misread.
 */
export function SafeMarkdown({ text }: { text: string }): ReactNode {
  return renderInline(text, { boldOnly: true })
}
