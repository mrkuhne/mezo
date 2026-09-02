import { useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
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

export function ToolWorkStrip({ tools, live }: { tools: Tool[]; live?: boolean }) {
  const [open, setOpen] = useState(false)
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
                <ClayIcon name={d.icon} size={13} />
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
            return (
              <div key={i} className={running ? 'mzc-wrow run' : 'mzc-wrow'}>
                <span className={`mzc-wric dm-${d.wash}`}>
                  <ClayIcon name={d.icon} size={14} />
                </span>
                <span className="col" style={{ minWidth: 0 }}>
                  <span className="mzc-wnm">{d.label}</span>
                  {params && <span className="mzc-wprm">{params}</span>}
                </span>
                <span className="mzc-wst">{running ? <><i /> fut</> : <Icon name="check" size={12} />}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
