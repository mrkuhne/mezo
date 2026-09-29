import type { Page } from '@playwright/test'

/**
 * Chip labels that break INSIDE a word or spill out of their box — e.g. „Gyomorront / ás" in a
 * two-column reason sheet at 320px. For every element matching `selector`, each word of its text
 * is measured with a Range: a word rendered on more than one line box (more than one distinct
 * rect top) broke mid-word. A label whose content is wider than its box overflows. Returns a
 * readable description of every offender (empty = all words whole and contained).
 */
export async function brokenChipWords(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll(sel)) as HTMLElement[]) {
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent} overflows (${el.scrollWidth} > ${el.clientWidth})`)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent ?? ''
        for (const m of text.matchAll(/\S+/g)) {
          const r = document.createRange()
          r.setStart(n, m.index!)
          r.setEnd(n, m.index! + m[0].length)
          const tops = new Set(Array.from(r.getClientRects()).filter((x) => x.width > 0).map((x) => Math.round(x.top)))
          if (tops.size > 1) out.push(`„${m[0]}" breaks across ${tops.size} lines`)
        }
      }
    }
    return out
  }, selector)
}
