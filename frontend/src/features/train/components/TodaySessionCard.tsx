// ============================================================
// Mezo · TodaySessionCard — one of TODAY's non-gym sessions on Mai
// (recurring sport: röpi/cross/TRX · prescribed run). Napiv `.todaycard`:
// type tag + MA/Kész state chip on top, a display title, the session's
// facts as `.metapill`s, then a full-width log CTA. The lighter sibling
// of the gym `.trainhero` — same eyebrow → title → pills → CTA rhythm,
// so the three session kinds read as one family (mezo-lruy).
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'

interface TodaySessionCardProps {
  /** Accent family — picks the `--tag-*`/`--wash-*` pair used by tag, pills and CTA. */
  tone: 'sport' | 'run'
  /** Type-tag content — emoji + short label (e.g. `🏐 RÖPI`). */
  tag: ReactNode
  /** Time-of-day of the session — sits next to the tag (the gym hero's eyebrow slot); absent = untimed. */
  time?: string | null
  title: string
  /** One pill per fact (time, duration, role, RPE…); falsy entries drop out. */
  facts: (string | null | undefined | false)[]
  /** A logged session exists for this slot ⇒ done styling + the summary CTA. */
  logged: boolean
  /** Summary of the logged session, shown inside the done CTA (e.g. `Logolva · RPE 7 · 90p`). */
  loggedLabel?: string
  /** Not-yet-logged CTA copy (e.g. `Logold a session-t`). */
  ctaLabel: string
  /** Opens the log sheet — in both states (a logged session stays editable). */
  onLog: () => void
}

export function TodaySessionCard({ tone, tag, time, title, facts, logged, loggedLabel, ctaLabel, onLog }: TodaySessionCardProps) {
  const pills = facts.filter(Boolean) as string[]
  return (
    <section className={cn('todaycard', `todaycard-${tone}`, logged && 'logged')}>
      <div className="todaycard-top">
        <span className={`typetag typetag-${tone}`}>{tag}</span>
        {time && <span className="todaycard-time">{time}</span>}
        <span className="todaycard-state">
          {logged ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
        </span>
      </div>
      <h3 className="todaycard-title">{title}</h3>
      {pills.length > 0 && (
        <div className="todaycard-pills">
          {pills.map((p) => (
            <span key={p} className="metapill">{p}</span>
          ))}
        </div>
      )}
      <button type="button" className="todaycard-cta np-press" onClick={onLog}>
        {logged ? (
          <><Icon name="check" size={12} /><span>{loggedLabel}</span></>
        ) : (
          <><Icon name="plus" size={12} /><span>{ctaLabel}</span></>
        )}
      </button>
    </section>
  )
}
