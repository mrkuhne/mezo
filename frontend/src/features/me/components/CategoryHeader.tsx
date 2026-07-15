/** Category label row above a group of KnowledgeFactCards — Napiv row-card idiom (mezo-8141 Task 7). */
export function CategoryHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div
      className="row gap-sm"
      style={{ alignItems: 'center', marginBottom: 6, background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--np-shadow-row)', padding: '8px 12px' }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color }}>
        {label} · {count}
      </span>
    </div>
  )
}
