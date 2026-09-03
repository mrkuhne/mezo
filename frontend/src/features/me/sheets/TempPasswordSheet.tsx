import { Sheet } from '@/shared/ui/Sheet'

// Shows a freshly minted temporary password ONCE (mezo-qw37.3) — the server stores only the
// hash, so closing this sheet is the last time anyone sees it. The owner reads it out to the
// user, who must change it at next login (must_change_password → S1's ChangePasswordPage).
export function TempPasswordSheet({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="temp-pw-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="temp-pw-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Ideiglenes jelszó</h2>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{name} ezzel lép be legközelebb, és rögtön újat kell választania.</span>
          <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 12, textAlign: 'center', fontFamily: 'var(--ff-mono, monospace)', fontSize: 18, fontWeight: 700, letterSpacing: '.08em', userSelect: 'all' }}>
            {password}
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Csak most látszik — a szerver csak a hash-t tárolja.</span>
          <button type="button" className="chip" onClick={close} style={{ alignSelf: 'flex-end', minHeight: 40 }}>Megjegyeztem</button>
        </div>
      )}
    </Sheet>
  )
}
