import type { CSSProperties } from 'react'

/** Shared section-label / caption style: 11px, weight 800, .1em tracking, uppercase, --faint. */
export const SECTION_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}
