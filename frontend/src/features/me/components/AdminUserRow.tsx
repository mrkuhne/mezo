import { Toggle } from '@/shared/ui/Toggle'
import { formatDateTime } from '@/features/me/logic/llmCallFormat'
import type { AdminUserResponse } from '@/data/admin/adminApi'

// One account (mezo-qw37.3). `self` = the signed-in owner: no status toggle (the backend answers
// 409 ADMIN_SELF_STATUS anyway) — the UI simply does not offer a control that cannot succeed.
// The owner row also never gets a toggle by role, independent of `self`: mock-mode identity
// (mockMe.id) does not equal MOCK_OWNER_ID, so role is the reliable signal that this account
// can never be disabled through this UI ("saját magára 409" per spec).

const BTN: React.CSSProperties = { minHeight: 36, borderRadius: 999, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }

export function AdminUserRow({ user, self, onReset, onToggleStatus }: {
  user: AdminUserResponse
  self: boolean
  onReset: (id: string) => void
  onToggleStatus: (id: string, next: 'ACTIVE' | 'DISABLED') => void
}) {
  const disabled = user.status === 'DISABLED'
  const seen = user.lastSeenAt ? `utoljára: ${formatDateTime(user.lastSeenAt)}` : 'még nem járt itt'
  const onboarding = user.onboardedAt ? '' : ' · onboarding nyitva'
  return (
    <div className="card col" style={{ padding: '10px 12px', gap: 6, opacity: disabled ? 0.7 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="col" style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{user.name}</span>
          <span className="text-secondary" style={{ fontSize: 11 }}>{user.email}</span>
          <span className="text-tertiary" style={{ fontSize: 10.5 }}>
            {user.role === 'OWNER' ? 'tulajdonos' : disabled ? 'letiltva' : 'aktív'} · {seen}{onboarding}
          </span>
        </div>
        {!self && user.role !== 'OWNER' && (
          <Toggle on={disabled} ariaLabel={`Letiltás: ${user.name}`}
            onToggle={() => onToggleStatus(user.id, disabled ? 'ACTIVE' : 'DISABLED')} />
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" style={BTN} aria-label={`Jelszó-reset: ${user.name}`} onClick={() => onReset(user.id)}>
          Jelszó-reset
        </button>
      </div>
    </div>
  )
}
