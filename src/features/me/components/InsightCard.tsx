import type { TrendInsight } from '@/data/types'
import { Icon, type IconName } from '@/components/ui/Icon'
import { SafeMarkdown } from '@/lib/safeMarkdown'

const TYPE_ICON: Record<TrendInsight['type'], IconName> = {
  milestone: 'sparkle',
  warning: 'warning',
  pattern: 'insights',
}

export function InsightCard({ insight, accentColor = 'var(--cat-physiology)' }: { insight: TrendInsight; accentColor?: string }) {
  const TYPE_COLOR: Record<TrendInsight['type'], string> = {
    milestone: 'var(--brand-glow)',
    warning: 'var(--warning)',
    pattern: accentColor,
  }
  const color = TYPE_COLOR[insight.type]
  const icon = TYPE_ICON[insight.type]
  return (
    <div
      className="card notch-4"
      style={{
        padding: 12,
        background: insight.type === 'warning' ? 'rgba(245, 158, 11, 0.04)' : 'var(--surface-1)',
        borderColor: insight.type === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div className="row gap-sm" style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
        <Icon name={icon} size={12} color={color} />
        <p
          className="briefing-body"
          style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.55, flex: 1 }}
        >
          <SafeMarkdown text={insight.text} />
        </p>
      </div>
    </div>
  )
}
