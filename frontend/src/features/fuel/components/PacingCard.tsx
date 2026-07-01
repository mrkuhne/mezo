import type { Tool } from '@/shared/ui/ToolChip'
import { Icon } from '@/shared/ui/Icon'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'

const PACING_TOOLS: Tool[] = [
  { type: 'read', name: 'get_meal_pacing(d=7)' },
  { type: 'compute', name: 'predictAppetite(d=3)' },
]

export function PacingCard({ pacing }: { pacing: { eyebrow: string; msg: string } }) {
  return (
    <div
      className="card notch-4"
      style={{
        padding: 14,
        background: 'color-mix(in srgb, var(--warning) 5%, transparent)',
        borderColor: 'color-mix(in srgb, var(--warning) 20%, transparent)',
      }}
    >
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={14} color="var(--warning)" />
        <div className="col flex-1">
          <span className="eyebrow" style={{ color: 'var(--warning)' }}>Mezo · Reta-aware</span>
          <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <SafeMarkdown text={pacing.msg} />
          </p>
          <div className="mt-sm">
            <ToolChipRow tools={PACING_TOOLS} />
          </div>
        </div>
      </div>
    </div>
  )
}
