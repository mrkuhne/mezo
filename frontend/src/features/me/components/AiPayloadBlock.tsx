// One verbatim payload column (mezo-uakh). Monospace on a dark surface because this is raw wire
// content, not prose — and the character count is shown so a truncated payload is visible as a
// fact rather than guessed from a cut-off sentence.
//
// Copy button: the mockup showed a "Másolás" button, deliberately dropped here —
// `navigator.clipboard` does not exist under jsdom and the surface is complete without it.

export function AiPayloadBlock({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span className="eyebrow" style={{ flex: 1 }}>{label}</span>
        <span className="text-tertiary" style={{ fontSize: 10.5 }}>{text.length} kar.</span>
      </div>
      <pre style={{
        margin: 0, borderRadius: 11, padding: '10px 11px', background: 'var(--text-primary)',
        color: 'var(--surface-1)', fontSize: 10.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', maxHeight: 320, overflow: 'auto',
      }}>{text}</pre>
    </div>
  )
}
