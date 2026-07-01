import { Icon } from '@/shared/ui/Icon'
import type { IconName } from '@/shared/ui/Icon'
import { affectColor } from '@/data/me/people'
import type { Mention, MentionSource, PersonEntry } from '@/data/types'

function sourceIconFor(source: MentionSource): IconName {
  switch (source) {
    case 'voice':
      return 'mic'
    case 'camera':
      return 'camera'
    case 'chip':
      return 'check'
    case 'text':
      return 'send'
    default:
      return 'anchor'
  }
}

export function MentionRow({ mention, person }: { mention: Mention; person?: PersonEntry }) {
  const tone = affectColor(mention.tone)
  const sourceIcon = sourceIconFor(mention.source)

  return (
    <div className="card notch-4" style={{ padding: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: tone }} />
      <div className="row gap-sm" style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
        {/* Time gutter */}
        <div className="col" style={{ alignItems: 'flex-start', width: 60, flexShrink: 0, paddingTop: 1 }}>
          <span className="label-mono" style={{ fontSize: 9, color: tone, lineHeight: 1.1 }}>{mention.timeLabel}</span>
          <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>{mention.dayLabel}</span>
        </div>

        {/* Body */}
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--surface-2)',
                border: '1px solid ' + tone,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--ff-display)',
                fontSize: 9,
                fontWeight: 600,
                color: tone,
              }}
            >
              {person?.initial || '?'}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{mention.personName}</span>
            <div className="row gap-xs" style={{ alignItems: 'center', marginLeft: 6 }}>
              <Icon name={sourceIcon} size={10} color="var(--text-tertiary)" />
              <span
                className="text-tertiary"
                style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {mention.source}{mention.duration_s ? ` · ${mention.duration_s}s` : ''}
              </span>
            </div>
            {mention.flagged && (
              <span
                className="label-mono"
                style={{
                  fontSize: 8,
                  color: 'var(--warning)',
                  marginLeft: 'auto',
                  background: 'rgba(245, 158, 11, 0.08)',
                  padding: '2px 5px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                FIGYELEM
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>
            "{mention.excerpt}"
          </p>
          {mention.tiedTo && (
            <div className="row gap-xs mt-sm" style={{ alignItems: 'center' }}>
              <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>kapcsolódik</span>
              <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>{mention.tiedTo.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
