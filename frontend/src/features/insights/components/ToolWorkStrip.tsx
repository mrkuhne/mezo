import { useState } from 'react'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { parseToolName, toolDomain } from '@/features/insights/logic/toolDomains'
import type { Tool } from '@/shared/ui/ToolChip'

/** mezo-vdf4: the chat's tool calls as ONE human work strip instead of n raw
 *  monospace pills — overlapping domain clay icons + `Utánanézett · n forrás`,
 *  expanding to a per-source panel (human label + raw args + state). In `live`
 *  mode (the streaming turn) the label reads `Utánanéz…` and the last source is
 *  the running one — the list only ever grows during a stream, so "last = running"
 *  holds by construction. Root keeps the `mzc-tools` class: the strip sits exactly
 *  where the old ToolChipRow sat (above the answer bubble). */
const MAX_STACK_ICONS = 6

/** A tool's report usually opens with a heading line ("Napi étkezés-összesítők (utolsó 1 nap):")
 *  and continues with data rows. Split those apart so the heading can be set as a caption and the
 *  rows as figures, instead of dumping one block of prose. Anything that does not have that shape
 *  falls through as body-only — this is typography, never parsing the domain. */
function splitReport(text: string): { caption: string | null; body: string } {
  const [first, ...rest] = text.split('\n')
  if (rest.length > 0 && first.trim().endsWith(':')) {
    return { caption: first.trim().replace(/:$/, ''), body: rest.join('\n').trim() }
  }
  return { caption: null, body: text }
}


export function ToolWorkStrip({ tools, live }: { tools: Tool[]; live?: boolean }) {
  const [open, setOpen] = useState(false)
  // S9.7 provenance (mezo-rj214.7): at most one row's outcome unclamped at a time per strip —
  // mirrors RecalledMemoriesRow's `openCard` idiom rather than a per-row state machine.
  const [openRow, setOpenRow] = useState<number | null>(null)
  if (tools.length === 0) return null
  const shown = tools.slice(0, MAX_STACK_ICONS)
  const extra = tools.length - shown.length
  return (
    <div className="mzc-tools mzc-wwrap col">
      <button
        type="button"
        className="mzc-wstrip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mzc-wstk">
          {shown.map((t, i) => {
            const d = toolDomain(t.name)
            const running = live && i === tools.length - 1
            return (
              <span key={i} className={running ? 'mzc-wic run' : 'mzc-wic'}>
                <ContentIcon name={d.icon} size={22} />
              </span>
            )
          })}
          {extra > 0 && <span className="mzc-wic mzc-wmore">+{extra}</span>}
        </span>
        <span className="mzc-wlbl">{live ? 'Utánanéz…' : 'Utánanézett'}</span>
        <span className="mzc-wsub">{tools.length} forrás</span>
        <span className="mzc-wchev" aria-hidden>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
        </span>
      </button>
      {open && (
        <div className="mzc-wpanel">
          {tools.map((t, i) => {
            const d = toolDomain(t.name)
            const running = live && i === tools.length - 1
            const params = t.args ?? parseToolName(t.name).params
            const expanded = openRow === i
            return (
              <div key={i} className={running ? 'mzc-wrow run' : 'mzc-wrow'}>
                <span className={`mzc-wric dm-${d.wash}`}>
                  <ContentIcon name={d.icon} size={26} />
                </span>
                <span className="col" style={{ minWidth: 0, flex: 1 }}>
                  <span className="mzc-wnm">{d.label}</span>
                  {/* Always visible: the params are the ASK half, the one that outlives the
                     90-day scrub. Hiding them behind the outcome's expander would erase them
                     entirely on a scrubbed row, which has no outcome to expand. */}
                  {params && <span className="mzc-wprm">{params}</span>}
                  {t.why && <span className="mzc-wwhy">{t.why}</span>}
                  {/* Retention-scrubbed rows carry no `outcome` — the ask half above still
                     renders, never an empty content block for the missing result half. */}
                  {t.outcome && (
                    <button
                      type="button"
                      className={expanded ? 'mzc-wout open' : 'mzc-wout'}
                      aria-expanded={expanded}
                      aria-label={`${d.label} eredmény megnyitása`}
                      onClick={() => setOpenRow(expanded ? null : i)}
                    >
                      {(() => {
                        const { caption, body } = splitReport(t.outcome!)
                        return (
                          <>
                            {caption && <span className="mzc-wocap">{caption}</span>}
                            <span className="mzc-wobody">
                              {body.split('\n').map((line, li) => (
                                <span key={li} className="mzc-woline">{line}</span>
                              ))}
                            </span>
                          </>
                        )
                      })()}
                    </button>
                  )}
                </span>
                <span className="mzc-wst">
                  {running
                    ? <><i /> fut</>
                    : t.failed
                      ? <><Icon3D name="t-info" size={20} /><span className="sr-only">nem sikerült</span></>
                      : <><Icon3D name="t-tick" size={20} /><span className="sr-only">kész</span></>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
