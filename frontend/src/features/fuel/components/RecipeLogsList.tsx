// ============================================================
// Mezo · RecipeLogsList
// Today's logs of this recipe: slot, loggedAt, actual score,
// delta vs baseline, macros. Empty-state copy when none.
// ============================================================
import type { RecipeLog } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

export function RecipeLogsList({ logs, baselineScore }: { logs?: RecipeLog[]; baselineScore: number }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <span className="text-tertiary" style={{ fontSize: 12 }}>Még nem logoltad ezt a receptet ezen a héten.</span>
        <p className="text-tertiary mt-sm" style={{ fontSize: 11, lineHeight: 1.5 }}>
          Amint logolod a mai étkezésekbe, a Mezo kontextusra futtatja és látod itt a tényleges score-okat.
        </p>
      </div>
    )
  }
  return (
    <div className="col gap-sm">
      {logs.map((l, i) => {
        // delta vs the recipe's live mezo-fit baseline (mezo-yta); the seed's authored delta is
        // the fallback for mock logs whose baseline is still the pending null → 0.
        const delta = baselineScore > 0 && l.score ? l.score - baselineScore : l.delta
        return (
        <div key={i} className="card" style={{ padding: '10px 12px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col">
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{l.slot}</span>
              <span className="label-mono text-tertiary" style={{ fontSize: 9, marginTop: 2 }}>{l.loggedAt}</span>
            </div>
            <div className="col" style={{ alignItems: 'flex-end' }}>
              {l.score ? (
                <>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, color: 'var(--coral)', lineHeight: 1, fontWeight: 600 }}>
                    {(l.score * 100).toFixed(0)}
                  </span>
                  <span className="label-mono" style={{
                    fontSize: 9,
                    color: delta > 0 ? 'var(--coral)' : delta < 0 ? 'var(--warning)' : 'var(--text-tertiary)',
                    marginTop: 2,
                  }}>
                    {delta > 0 ? '+' : ''}{(delta * 100).toFixed(0)} vs baseline
                  </span>
                </>
              ) : (
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="sparkle" size={12} /> pending
                </span>
              )}
            </div>
          </div>
          <div className="row gap-md mt-sm" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>kcal <span style={{ color: 'var(--text-primary)' }}>{l.kcal}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>P <span style={{ color: 'var(--text-primary)' }}>{l.p}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>C <span style={{ color: 'var(--text-primary)' }}>{l.c}</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>F <span style={{ color: 'var(--text-primary)' }}>{l.f}</span></span>
          </div>
        </div>
        )
      })}

      <div className="card" style={{ padding: 10, background: 'var(--surface-1)', borderStyle: 'dashed', marginTop: 6 }}>
        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
          Csak a mai naptári logok látszanak itt. Heti / havi nézet az Insights tabon.
        </span>
      </div>
    </div>
  )
}
