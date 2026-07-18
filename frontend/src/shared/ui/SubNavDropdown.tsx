import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, matchPath, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'

export interface SubNavItem {
  to: string
  label: string
  end?: boolean
}

export interface SubNavExtraAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
}

/** Compact sub-navigation for the sticky AppHero row: a pill chip showing the active
 *  sub-view that opens an anchored popover menu (spec 2026-07-18-compact-header §4).
 *  Domain-free: the section shells pass their tab lists in. */
export function SubNavDropdown({
  label,
  items,
  extraAction,
  accent,
}: {
  label: string
  items: SubNavItem[]
  extraAction?: SubNavExtraAction
  accent?: string
}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const chipRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  // Same active semantics as the retired NavLink pills: index items match exactly
  // (end: true), section items match by prefix.
  const active =
    items.find((i) => matchPath({ path: i.to, end: i.end ?? false }, pathname)) ?? items[0]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        chipRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav
      className="subnav-dd"
      aria-label={label}
      style={accent ? ({ '--subnav-accent': accent } as React.CSSProperties) : undefined}
    >
      <button
        ref={chipRef}
        type="button"
        className="dd-chip np-press"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {active.label}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} />
      </button>
      {open && (
        <>
          {createPortal(
            <button
              type="button"
              className="dd-backdrop"
              aria-label="Bezárás"
              onClick={() => {
                setOpen(false)
                chipRef.current?.focus()
              }}
            />,
            // Resolved lazily, here in the open-branch render, NOT via a useState
            // initializer: SubNavDropdown mounts unconditionally with the page (it's
            // in the always-rendered header), so a useState(() => querySelector(...))
            // initializer would run on the very first render, before PhoneFrame's DOM
            // commits, permanently caching the <body> fallback. This branch only ever
            // renders once `open` is true, i.e. after the initial commit, so the query
            // reliably finds `.phone-screen`. Same fallback as Sheet.tsx for jsdom/tests.
            document.querySelector('.phone-screen') ?? document.body,
          )}
          <div className="dd-menu" role="menu" id={menuId}>
            {items.map((item) => {
              const on = item === active
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  role="menuitem"
                  className={cn('dd-item np-press', on && 'on')}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {on && <Icon name="check" size={13} />}
                </NavLink>
              )
            })}
            {extraAction && (
              <>
                <div className="dd-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dd-item np-press"
                  onClick={() => {
                    setOpen(false)
                    extraAction.onSelect()
                  }}
                >
                  {extraAction.label}
                  {extraAction.icon}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  )
}
