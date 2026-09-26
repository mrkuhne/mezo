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
      {/* Üveg (mezo-me75u.10, /admin only consumer): a recessed flat well (`.ad-pre`), not the
          old inverted ink block. */}
      <pre className="ad-pre">{text}</pre>
    </div>
  )
}
