import { CtaPrimary } from '@/shared/ui/Cta'

// Clean-slate empty state (T0, design option C): a faint skeleton of the future
// layout + a one-line message + optional CTA. Train views render it in real mode
// while a section has no data yet (no active meso, write paths not shipped).
export function GhostState({ message, ctaLabel, onCta, lines = 3 }: {
  message: string
  ctaLabel?: string
  onCta?: () => void
  lines?: number
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="col gap-sm" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            style={{
              height: 10,
              borderRadius: 4,
              background: 'var(--surface-2)',
              opacity: 0.55,
              width: `${Math.max(70 - i * 15, 25)}%`,
            }}
          />
        ))}
      </div>
      <div className="col gap-sm mt-md" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{message}</p>
        {ctaLabel && onCta && <CtaPrimary onClick={onCta}>{ctaLabel}</CtaPrimary>}
      </div>
    </div>
  )
}
