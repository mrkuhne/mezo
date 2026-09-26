import type { ReactNode } from 'react'
import { ClaySprites, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

/**
 * Chrome-free frame for the auth pages (üveg, mezo-me75u.10): the black ground, a frameless
 * lavender/gold halo hero with the gradient „boop" wordmark (the header's), the title and an
 * optional lead line, then the page's form — ONE `.auth-card.glass` — and the footer links.
 * No PhoneFrame: these render outside the router/AppLayout, so the column centres itself
 * (max ~380px) on any width. Styles: `── uveg reteg belepes (` in prototype.css.
 *
 * AuthGate renders these INSTEAD of the app tree, i.e. above main.tsx's root <ClaySprites/>
 * (which lives inside QueryProvider → AuthGate), so the shell mounts the sprite defs itself —
 * the 3D icons would draw nothing otherwise. Never both at once, so no duplicate ids.
 */
export function AuthShell({ title, lead, children, footer, className }: {
  title: string
  /** The sub copy under the title (the forced password change's „Ideiglenes jelszóval…"). */
  lead?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className="auth-page">
      <ClaySprites />
      <div className={cn('auth', className)}>
        <div className="auth-hero">
          <span className="auth-mark">boop</span>
          <h1>{title}</h1>
          {lead && <p>{lead}</p>}
        </div>
        {children}
        {footer && <div className="auth-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** A labelled auth input: the label is the field's small uppercase eyebrow (CSS), the input is
 *  flat with a lit focus ring. The label text stays the accessible name. */
export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="auth-field">
      <span className="auth-field-lb">{label}</span>
      {children}
    </label>
  )
}

/** A flat gold-tinted notice cell with a 3D icon (session expired → clock, otherwise info). */
export function AuthNotice({ icon = 't-info', children }: { icon?: Icon3DName; children: ReactNode }) {
  return (
    <p className="auth-notice">
      <Icon3D name={icon} size={22} />
      <span>{children}</span>
    </p>
  )
}

export function ErrorLine({ text }: { text?: string }) {
  if (!text) return null
  return (
    <p role="alert" className="auth-err">
      <Icon3D name="t-info" size={18} />
      <span>{text}</span>
    </p>
  )
}
