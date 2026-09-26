import { useToast } from '@/shared/ui/ToastProvider'
import { formatDateTime } from '@/features/me/logic/llmCallFormat'
import type { InviteResponse } from '@/data/admin/adminApi'

// One invite (mezo-qw37.3). A used code is history — no Törlés; the consumer's name is the fact
// that matters. Copy is best-effort: navigator.clipboard is absent under jsdom and on http
// origins, so the button falls back to a toast that just shows the code.

const CODE: React.CSSProperties = { fontFamily: 'var(--ff-mono, monospace)', fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }

export function AdminInviteRow({ invite, onDelete, pending = false }: { invite: InviteResponse; onDelete: (id: string) => void; pending?: boolean }) {
  const { show } = useToast()
  const expired = invite.expiresAt != null && new Date(invite.expiresAt).getTime() < Date.now()
  const state = invite.usedAt
    ? `felhasználta: ${invite.usedByName ?? 'ismeretlen'} · ${formatDateTime(invite.usedAt)}`
    : expired ? 'lejárt' : invite.expiresAt ? `lejár: ${formatDateTime(invite.expiresAt)}` : 'nyitott'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code)
      show({ kind: 'success', text: 'Kód másolva' })
    } catch {
      show({ kind: 'info', text: invite.code })
    }
  }

  return (
    // Üveg (mezo-me75u.10, /admin only consumer): a flat row cell (`.ad-acrow`), ghost pills;
    // „Törlés” keeps its warning tone as a coral outline (bible U4 rule 29).
    <div className="ad-acrow glass row">
      <div className="col" style={{ minWidth: 0 }}>
        <span style={CODE}>{invite.code}</span>
        <span className="text-secondary" style={{ fontSize: 11 }}>{invite.label ?? '—'}</span>
        <span className="text-tertiary" style={{ fontSize: 10.5 }}>{state}</span>
      </div>
      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
        {!invite.usedAt && (
          <button type="button" className="ad-chip" onClick={copy}>Másolás</button>
        )}
        {!invite.usedAt && (
          <button type="button" className="ad-chip is-danger" aria-label={`Törlés: ${invite.code}`} disabled={pending} onClick={() => onDelete(invite.id)}>
            Törlés
          </button>
        )}
      </div>
    </div>
  )
}
