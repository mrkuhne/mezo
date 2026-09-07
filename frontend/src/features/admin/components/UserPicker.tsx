import { cn } from '@/shared/lib/cn'
import { useAdminUserInsights } from '@/data/admin/adminInsightsHooks'

// `.ad-pick` chip row — filters the data browser to one user's rows via `ownerColumn`
// (mezo-d5iy.12). Reuses Task 10's user-insight list rather than fetching a second roster —
// same accounts, same ids, one fewer endpoint to keep in sync.
export function UserPicker({ isOwner, value, onChange }: {
  isOwner: boolean
  value: string
  onChange: (userId: string | null) => void
}) {
  const users = useAdminUserInsights(null, 'name', 'asc', isOwner)
  return (
    <div className="ad-pick">
      <span className="lbl">User</span>
      <div className="ad-chiprow">
        <button
          type="button"
          className={cn('ad-chip', value === '' && 'on')}
          aria-pressed={value === ''}
          onClick={() => onChange(null)}
        >
          Mind
        </button>
        {users.data.map((u) => (
          <button
            key={u.id}
            type="button"
            className={cn('ad-chip', value === u.id && 'on')}
            aria-pressed={value === u.id}
            onClick={() => onChange(u.id)}
          >
            {u.name}
          </button>
        ))}
      </div>
    </div>
  )
}
