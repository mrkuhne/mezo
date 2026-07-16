import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Chip } from '@/shared/ui/Chip'
import { KIND_META } from '@/data/kindMeta'
import { useFuelPreview } from '@/data/hooks'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'

export function FuelTimelinePreview() {
  const { visible, nextStack } = useFuelPreview()
  const [logOpen, setLogOpen] = useState(false)

  return (
    <div style={{ padding: '8px 24px 16px' }}>
      <div className="col gap-sm">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>Mai fuel · timeline</Eyebrow>
          <button type="button" onClick={() => setLogOpen(true)} className="chip brand" aria-label="Logolás" style={{ fontSize: 9, padding: '4px 8px' }}>
            <Icon name="plus" size={11} /> Log
          </button>
        </div>
        <div className="card" style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--coral)' }} />
          <div className="col gap-sm" style={{ paddingLeft: 6 }}>
            {visible.map((s, i) => {
              const meta = KIND_META[s.kind]
              const isNow = s.state === 'now'
              return (
                <div key={i} className="row gap-sm" style={{ alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600,
                    color: isNow ? 'var(--coral)' : 'var(--text-tertiary)',
                    width: 44, flexShrink: 0,
                  }}>{s.time}</span>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isNow ? meta.color : 'var(--surface-2)',
                    border: '1.5px solid ' + meta.color,
                    boxShadow: isNow ? '0 0 8px ' + meta.color : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 12, color: isNow ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}>
                    {s.mealName || s.label}
                  </span>
                  {isNow && <Chip variant="brand" style={{ fontSize: 8, padding: '1px 5px', marginLeft: 'auto' }}>MOST</Chip>}
                </div>
              )
            })}
          </div>

          {nextStack && nextStack.mezoNote && (
            <div className="row gap-sm mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', alignItems: 'flex-start' }}>
              <Icon name="sparkle" size={11} color="var(--coral)" />
              <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                <strong style={{ color: 'var(--coral)', fontWeight: 500 }}>{nextStack.time}</strong> · {nextStack.mezoNote.split('.')[0]}.
              </span>
            </div>
          )}
        </div>
      </div>
      {logOpen && <LogMealSheet onClose={() => setLogOpen(false)} />}
    </div>
  )
}
