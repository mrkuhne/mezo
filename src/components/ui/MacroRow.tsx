export function MacroRow({ macros, per }: { macros: { kcal: number; p: number; c: number; f: number }; per?: number }) {
  return (
    <div className="row gap-md" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
      <span><span style={{ color: 'var(--text-tertiary)' }}>kcal</span> <span style={{ color: 'var(--text-primary)' }}>{macros.kcal}</span></span>
      <span><span style={{ color: 'var(--text-tertiary)' }}>P</span> <span style={{ color: 'var(--text-primary)' }}>{macros.p}</span></span>
      <span><span style={{ color: 'var(--text-tertiary)' }}>C</span> <span style={{ color: 'var(--text-primary)' }}>{macros.c}</span></span>
      <span><span style={{ color: 'var(--text-tertiary)' }}>F</span> <span style={{ color: 'var(--text-primary)' }}>{macros.f}</span></span>
      {per != null && <span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>/ {per}g</span>}
    </div>
  )
}
