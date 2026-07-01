import { RefTag } from '@/shared/ui/RefTag'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import type { ChatMessage as ChatMessageT } from '@/data/types'

export function ChatMessage({ m }: { m: ChatMessageT }) {
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <div
          className="card notch-12"
          style={{ padding: '10px 14px', background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.text}</p>
        </div>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--ff-mono)',
            display: 'block',
            textAlign: 'right',
            marginTop: 4,
            color: 'var(--text-tertiary)',
          }}
        >
          {m.ts}
        </span>
      </div>
    )
  }
  return (
    <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '92%' }}>
      <div className="row gap-sm">
        <span className="eyebrow brand">Mezo</span>
        <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)' }}>
          {m.ts}
        </span>
      </div>
      {m.tools && <ToolChipRow tools={m.tools} />}
      <div className="card notch-12" style={{ padding: 14 }}>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{m.text}</p>
        {m.refs && (
          <div
            className="row gap-xs flex-wrap mt-md"
            style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>
              Hivatkozott · L3
            </span>
            {m.refs.map((r, i) => (
              <RefTag key={i} kind={r.kind} label={r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
