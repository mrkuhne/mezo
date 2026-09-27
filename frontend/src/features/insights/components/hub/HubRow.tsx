import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { stripNote, VERB } from '@/features/insights/logic/hubCopy'
import { Highlight } from '@/features/insights/components/hub/HubSearch'

export interface HubRowProps {
  /** 'f:<id>' | 'p:<id>' | 'o:<patternId>' | 'e:<kind>:<key>' */
  rowKey: string
  icon: Icon3DName
  /** CSS color for --c, e.g. 'var(--dv-sky)' */
  accent: string
  text: string
  /** highlight target */
  query?: string
  sub?: ReactNode
  /** e.g. the observation status line */
  status?: ReactNode
  why?: { text: string; icon: Icon3DName } | null
  muted: boolean
  /** Javítom (facts only) */
  canEdit?: boolean
  /** default true */
  canMute?: boolean
  /** rendered only while "Honnan tudom?" is open (the lazy fetch lives inside) */
  source?: () => ReactNode
  onMute: (on: boolean) => void
  onForget: () => void
  onEdit?: (text: string) => void
  after?: ReactNode
  /** the ?fact= deep-link one-shot highlight (tud9-hl) */
  highlight?: boolean
}

type Open = null | 'acts' | 'src' | 'edit'

/**
 * S6 (mezo-d6ivw.6): the ONE row every Tudástár section uses (Rólad, Emberek, Észrevételek,
 * elhallgattatott hatások) — the prototype's `row()`/`acts()` pair. Flat, never glass (§3.4).
 * Only one of the verb strip, the source panel and the inline editor is open at a time.
 */
export function HubRow(p: HubRowProps) {
  const [open, setOpen] = useState<Open>(null)
  const [draft, setDraft] = useState(p.text)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (p.highlight) ref.current?.scrollIntoView?.({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount-centring (the T10 idiom)
  }, [])
  const toggle = (next: Exclude<Open, null>) => setOpen((cur) => (cur === next ? null : next))
  const save = () => {
    const t = draft.trim()
    if (t && t !== p.text) p.onEdit?.(t)
    setOpen(null)
  }
  return (
    <div ref={ref} data-row={p.rowKey} className={cn('th-row', p.muted && 'is-muted', p.highlight && 'tud9-hl')}
      style={{ '--c': p.accent } as CSSProperties}>
      <div className="th-rm">
        <Icon3D name={p.icon} size={26} />
        <div className="th-tx">
          {open === 'edit' ? (
            <div className="th-edit">
              <textarea aria-label="A tény szövege" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="b">
                <button type="button" className="th-pill" onClick={() => { setDraft(p.text); setOpen(null) }}>{VERB.cancel}</button>
                <button type="button" className="th-pill main" onClick={save}><Icon3D name="t-tick" size={20} />{VERB.save}</button>
              </div>
            </div>
          ) : (
            <b><Highlight text={p.text} query={p.query ?? ''} /></b>
          )}
          {p.sub && <small>{p.sub}</small>}
          {p.status}
          {p.why && <span className="th-why"><Icon3D name={p.why.icon} size={16} />{p.why.text}</span>}
        </div>
      </div>
      {open !== 'edit' && (
        <div className="th-act">
          {p.source && (
            <button type="button" className="th-link" aria-expanded={open === 'src'} onClick={() => toggle('src')}>
              <Icon3D name="t-source" size={17} />{VERB.source}
            </button>
          )}
          {p.muted && (
            <button type="button" className="th-link" onClick={() => p.onMute(false)}>
              <Icon3D name="t-repeat" size={17} />{VERB.unmute}
            </button>
          )}
          <button type="button" className="th-more" aria-label={VERB.more} aria-expanded={open === 'acts'} onClick={() => toggle('acts')}>⋯</button>
        </div>
      )}
      {open === 'acts' && (
        <div className="th-strip">
          {p.canEdit && p.onEdit && (
            <button type="button" className="th-pill" onClick={() => { setDraft(p.text); setOpen('edit') }}>
              <Icon3D name="t-pencil" size={20} />{VERB.edit}
            </button>
          )}
          {!p.muted && p.canMute !== false && (
            <button type="button" className="th-pill" onClick={() => { setOpen(null); p.onMute(true) }}>
              <Icon3D name="t-mute" size={20} />{VERB.mute}
            </button>
          )}
          <button type="button" className="th-pill warn" onClick={() => { setOpen(null); p.onForget() }}>
            <Icon3D name="t-eraser" size={20} />{VERB.forget}
          </button>
          <span className="th-strip-n">{stripNote(p.muted ? 'muted' : 'active')}</span>
        </div>
      )}
      {open === 'src' && p.source?.()}
      {p.after}
    </div>
  )
}
