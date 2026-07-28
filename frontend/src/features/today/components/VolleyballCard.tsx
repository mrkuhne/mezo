import { Icon } from '@/shared/ui/Icon'
import type { VolleyballSession } from '@/data/types'
import { sportOf, SPORT_TAGS, SPORT_TITLES } from '@/features/train/logic/sportKinds'

export function VolleyballCard({
  session,
  note,
}: {
  session?: VolleyballSession
  /** Demo "Stacked day" AI note (mock mode); null/absent hides the row — real prose is proactive-epic work. */
  note?: string | null
}) {
  if (!session) return null
  // The card names the session by its sport identity (volleyball|cross|trx) so cross/TRX don't
  // render as 'Röplabda' (mezo-rhe5). sportOf defaults an unmarked session to volleyball; the
  // volleyball title stays the Hungarian 'Röplabda' this card has always shown.
  const kind = sportOf(session)
  const title = kind === 'volleyball' ? 'Röplabda' : SPORT_TITLES[kind]
  return (
    <div style={{ padding: '8px 24px 16px' }}>
      <div className="col gap-sm">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>Sport · {session.time}</span>
          <span className="eyebrow text-tertiary">{session.duration} perc</span>
        </div>
        <div className="np-eventrow">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col">
              <div className="np-eventrow-head">
                <span className="typetag typetag-sport">{SPORT_TAGS[kind]}</span>
                <div className="h-display size-sm" style={{ lineHeight: 1.15 }}>{title}</div>
              </div>
              <span className="text-tertiary" style={{ fontSize: 11, marginTop: 4 }}>{session.court} · {session.role}</span>
            </div>
            <Icon name="chevron-right" size={18} color="var(--sub)" />
          </div>

          {note && (
            <div className="row gap-sm mt-md" style={{
              paddingTop: 10, borderTop: '1px solid var(--line)',
              alignItems: 'flex-start',
            }}>
              <Icon name="sparkle" size={11} color="var(--coral)" />
              <span style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5, flex: 1 }}>
                <strong style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>Stacked day</strong> — {note}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
