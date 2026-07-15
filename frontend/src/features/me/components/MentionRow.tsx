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

/** Napiv row card (mezo-8141 Task 7) — no left accent bar; the affect tone color
 * still rings the mini-avatar and tints the time label. */
export function MentionRow({ mention, person }: { mention: Mention; person?: PersonEntry }) {
  const tone = affectColor(mention.tone)
  const sourceIcon = sourceIconFor(mention.source)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--np-shadow-row)', padding: 12 }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        {/* Time gutter */}
        <div className="col" style={{ alignItems: 'flex-start', width: 60, flexShrink: 0, paddingTop: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: tone, lineHeight: 1.1 }}>{mention.timeLabel}</span>
          <span className="text-tertiary" style={{ fontSize: 9, marginTop: 2 }}>{mention.dayLabel}</span>
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
                style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {mention.source}{mention.duration_s ? ` · ${mention.duration_s}s` : ''}
              </span>
            </div>
            {mention.flagged && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: 'var(--warning)',
                  marginLeft: 'auto',
                  background: 'var(--wash-amber)',
                  padding: '2px 5px',
                  borderRadius: 4,
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
              <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-tertiary)' }}>kapcsolódik</span>
              <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>{mention.tiedTo.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
