import type { Reasoning } from '@/data/types'

// fuel-stack.jsx ReasoningRow (282–297)
export function ReasoningRow({ reason }: { reason: Reasoning }) {
  const glyphColor =
    reason.kind === 'physiology'
      ? 'var(--cat-physiology)'
      : reason.kind === 'timing'
        ? 'var(--sage-deep)'
        : reason.kind === 'interaction'
          ? 'var(--warning)'
          : 'var(--cat-preference)'
  const glyph =
    reason.kind === 'physiology' ? 'P' : reason.kind === 'timing' ? 'T' : reason.kind === 'interaction' ? 'I' : 'S'
  return (
    <div className="row gap-sm" style={{ alignItems: 'flex-start', padding: '4px 0' }}>
      <span
        style={{
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--ff-mono)',
          fontSize: 9,
          color: glyphColor,
          background: 'var(--surface-2)',
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <div className="col flex-1">
        <span style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{reason.text}</span>
        {reason.evidence && (
          <span className="text-tertiary mt-xs" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>
            {reason.evidence}
          </span>
        )}
      </div>
    </div>
  )
}
