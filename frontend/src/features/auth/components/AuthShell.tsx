import type { ReactNode } from 'react'

/**
 * Chrome-free frame for the auth pages: full-height, centered card, same surface tokens the
 * degraded boot screen uses. No PhoneFrame — these render outside the router/AppLayout.
 */
export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-base, #FDFAF4)', color: 'var(--text-primary, #2B2118)' }}>
      <div className="col gap-lg" style={{ width: '100%', maxWidth: 360 }}>
        <div className="col gap-xs" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>mezo</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h1>
        </div>
        {children}
        {footer && <div style={{ textAlign: 'center', fontSize: 13 }}>{footer}</div>}
      </div>
    </div>
  )
}

export const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-subtle, #E5DED2)',
  background: 'var(--surface-2, #FFFFFF)', color: 'inherit', fontSize: 15,
}

export function ErrorLine({ text }: { text?: string }) {
  if (!text) return null
  return <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--coral-deep, #C2412D)' }}>{text}</p>
}
