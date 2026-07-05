/** Honest real-mode ghost for Phase-3+ demo tabs — a direct URL never shows fiction. */
export function PhaseTeaserCard({ text }: { text: string }) {
  return (
    <div className="card notch-12" style={{ padding: 18, textAlign: 'center' }}>
      <span className="eyebrow text-tertiary">hamarosan</span>
      <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}
