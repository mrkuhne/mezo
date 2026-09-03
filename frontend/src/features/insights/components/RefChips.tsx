import { useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { chatRefDisplay } from '@/features/insights/logic/chatRefs'
import { refDomain } from '@/features/insights/logic/toolDomains'

/** A ref item this component can render. A superset of both provenance shapes in the app:
 *  `ChatRef` (id required, label optional/nullable) and `BriefingRef` (id optional, label a
 *  plain string) both satisfy it. */
export interface RefChipItem {
  kind: string
  id?: string
  label?: string | null
}

// mezo-z4h4: lifted VERBATIM from ChatMessage's local RefsFooter (mezo-vdf4) so the messages
// page (NapMezoPage) gets the same chat-quality provenance chips — domain clay icons, human
// Hungarian kind labels, wash colors, and the >3-refs grouping that expands one kind at a time.
// The eyebrow text is now a prop: ChatMessage passes "Amire épült · L3" (pixel-identical to
// before), NapMezoPage passes "Amire épült", and omitting it renders no eyebrow span at all.
export function RefChips({ refs, eyebrow }: { refs: RefChipItem[]; eyebrow?: string }) {
  const [openKind, setOpenKind] = useState<string | null>(null)
  const grouped = refs.length > 3
  const kinds = grouped
    ? [...new Map(refs.map((r) => [r.kind, r] as const)).keys()]
    : []
  const fullChips = (list: RefChipItem[]) =>
    list.map((r, i) => {
      const d = chatRefDisplay({ kind: r.kind, id: r.id ?? '', label: r.label })
      const dm = refDomain(r.kind)
      return (
        <span key={i} className={`mzc-refch dm-${dm.wash}`}>
          <span className="mzc-refic"><ClayIcon name={dm.icon} size={11} /></span>
          <b className="mzc-refk">{d.kind}</b>
          {d.label}
        </span>
      )
    })
  return (
    <div className="mzc-reffoot">
      {eyebrow && <span className="mzc-refeb">{eyebrow}</span>}
      {grouped ? (
        <>
          <div className="mzc-refrow">
            {kinds.map((kind) => {
              const dm = refDomain(kind)
              const count = refs.filter((r) => r.kind === kind).length
              const open = openKind === kind
              return (
                <button
                  key={kind}
                  type="button"
                  className={`mzc-refg dm-${dm.wash}${open ? ' on' : ''}`}
                  aria-expanded={open}
                  onClick={() => setOpenKind(open ? null : kind)}
                >
                  <span className="mzc-refic"><ClayIcon name={dm.icon} size={11} /></span>
                  {chatRefDisplay({ kind, id: '' }).kind}
                  <span className="mzc-refn">×{count}</span>
                </button>
              )
            })}
          </div>
          {openKind && (
            <div className="mzc-refrow mzc-refdates">
              {fullChips(refs.filter((r) => r.kind === openKind))}
            </div>
          )}
        </>
      ) : (
        <div className="mzc-refrow">{fullChips(refs)}</div>
      )}
    </div>
  )
}
