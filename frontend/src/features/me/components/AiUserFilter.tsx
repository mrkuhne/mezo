import type { components } from '@/data/_client/api.gen'

type UserGroup = components['schemas']['LlmUsageUserGroup']

// Per-account chips over the breakdown's byUser rollup (mezo-qw37.3). Same toggle idiom as
// AiCallFilters: the active chip clears itself. The background bucket (userId null) is shown
// for honesty — it is often the biggest spender — but is not a filter: the list endpoint
// narrows on created_by = :userId, and "created_by IS NULL" is not expressible there (YAGNI).

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 11px',
    cursor: 'pointer', border: '1px solid var(--border-subtle)',
    background: active ? 'var(--text-primary)' : 'var(--surface-1)',
    color: active ? 'var(--surface-1)' : 'var(--text-secondary)',
  }
}

export function AiUserFilter({ groups, selected, onSelect }: {
  groups: UserGroup[]
  selected: string | null
  onSelect: (userId: string | null) => void
}) {
  if (groups.length === 0) return null
  const accounts = groups.filter((g) => g.userId != null)
  const background = groups.find((g) => g.userId == null)
  return (
    <div className="row" style={{ gap: 6, overflowX: 'auto', padding: '8px 0 0' }}>
      <button type="button" style={chipStyle(selected === null)} aria-pressed={selected === null} onClick={() => onSelect(null)}>
        Mindenki
      </button>
      {accounts.map((g) => {
        const active = selected === g.userId
        return (
          <button key={g.userId!} type="button" style={chipStyle(active)} aria-pressed={active}
            onClick={() => onSelect(active ? null : g.userId!)}>
            {g.name ?? 'törölt fiók'} {g.callCount}{active ? ' ✕' : ''}
          </button>
        )
      })}
      {background && (
        <span style={{ ...chipStyle(false), cursor: 'default', opacity: 0.7 }} title="cron/háttér hívások — nincs bejelentkezett fiók">
          Háttér {background.callCount}
        </span>
      )}
    </div>
  )
}
