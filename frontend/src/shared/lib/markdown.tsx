import { Fragment, type ReactNode } from 'react'

/**
 * A tiny, dependency-free markdown subset for **LLM prose** (the companion's chat answers,
 * mezo-at8x.1). The model writes ordinary markdown — `**bold**`, `- ` bullets, `1.` lists,
 * `##` headings, blank-line paragraphs — and rendering it as one raw string is what put the
 * literal `**` marks and the wall-of-text into the chat bubble.
 *
 * Deliberately NOT a full markdown parser: no links, images, tables, or HTML. Everything that
 * is not one of the recognized markers is rendered as escaped text (React text nodes), so a
 * model answer can never inject markup.
 *
 * `_underscore_` italics are NOT supported on purpose: this app's prose is full of snake_case
 * tool names (`get_recent_workouts`) that would turn into accidental italics.
 */

/** `**bold**` only — the legacy inline set the curated app copy relies on (see safeMarkdown). */
const BOLD_ONLY = /(\*\*[^*]+\*\*)/g
/** bold + `*italic*` + `` `code` `` — the LLM-prose set. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g

export interface InlineOptions {
  /** Restrict the inline set to `**bold**` (the SafeMarkdown behavior). */
  boldOnly?: boolean
}

/** Renders the inline markers of one line as React nodes. */
export function renderInline(text: string, options: InlineOptions = {}): ReactNode {
  const parts = text.split(options.boldOnly ? BOLD_ONLY : INLINE)
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        if (bold) return <strong key={i}>{bold[1]}</strong>
        if (options.boldOnly) return <Fragment key={i}>{part}</Fragment>
        const code = /^`([^`]+)`$/.exec(part)
        if (code) return <code key={i} className="md-code">{code[1]}</code>
        const italic = /^\*([^*]+)\*$/.exec(part)
        if (italic) return <em key={i}>{italic[1]}</em>
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

const HEADING = /^(#{1,4})\s+(.*)$/
// A bullet marker REQUIRES the space after it, which is what keeps a `**bold**` lead-in
// (`**Fontos**: …`) out of the list parser.
const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export interface Block {
  kind: 'p' | 'ul' | 'ol' | 'h'
  lines: string[]
}

/** Groups the lines into paragraph / list / heading blocks. Exported for tests. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  // The kind still accepting lines; a blank line (or a heading) closes it.
  let open: Block['kind'] | null = null

  const add = (kind: Block['kind'], line: string) => {
    if (open === kind && blocks.length) blocks[blocks.length - 1].lines.push(line)
    else blocks.push({ kind, lines: [line] })
    open = kind
  }

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      open = null
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', lines: [heading[2]] })
      open = null
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet) {
      add('ul', bullet[1])
      continue
    }
    const numbered = NUMBERED.exec(line)
    if (numbered) {
      add('ol', numbered[1])
      continue
    }
    add('p', line)
  }
  return blocks
}

/**
 * Block-level renderer for model prose. A paragraph keeps its single newlines (`white-space:
 * pre-line` via `.md-p`) — the model uses them for line breaks inside one thought.
 */
export function Markdown({ text }: { text: string }): ReactNode {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === 'h') {
          return <p key={i} className="md-h">{renderInline(block.lines[0])}</p>
        }
        if (block.kind === 'p') {
          return <p key={i} className="md-p">{renderInline(block.lines.join('\n'))}</p>
        }
        const items = block.lines.map((line, j) => <li key={j}>{renderInline(line)}</li>)
        return block.kind === 'ul'
          ? <ul key={i} className="md-list">{items}</ul>
          : <ol key={i} className="md-list">{items}</ol>
      })}
    </>
  )
}
