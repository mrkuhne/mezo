import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { DOMAINS, routeForDomain } from '@/app/navModel'

/** Five independent cards over blur; deliberately no Sheet or drawer chrome.
 *  Restored world (mezo-ju4j6.4): the cards are §2.2 A wash tiles, one per domain wash,
 *  with the clay domain mark at 44px — style bible §7.4. The overlay keeps its blur: there
 *  it is functional (it separates a modal layer), the one place §2.3's frosting ban lifts. */
export function DomainSwitcher({ currentDomainId, onClose }: {
  currentDomainId: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [target] = useState(() => document.querySelector('.phone-screen') ?? document.body)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current!
    // Restore each previous value, including already-inert background overlays.
    const siblings = Array.from(target.children).filter(el => el !== overlayRef.current)
    const previous = siblings.map(el => [el, el.hasAttribute('inert')] as const)
    siblings.forEach(el => el.setAttribute('inert', ''))
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
    const initialFocus = buttons.find(button => button.getAttribute('aria-current') === 'true') ?? buttons[0]
    initialFocus?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
      if (event.key === 'Tab') {
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        if (event.shiftKey && index <= 0) {
          event.preventDefault()
          buttons.at(-1)?.focus()
        } else if (!event.shiftKey && (index === buttons.length - 1 || index < 0)) {
          event.preventDefault()
          buttons[0]?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous.forEach(([el, wasInert]) => { if (!wasInert) el.removeAttribute('inert') })
      if (opener?.isConnected) opener.focus()
    }
  }, [onClose, target])

  return createPortal(
    <div ref={overlayRef} className="domain-switcher-overlay" onClick={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div ref={dialogRef} className="domain-switcher" role="dialog" aria-modal="true" aria-label="Területváltó">
        <div className="domain-list">
          {DOMAINS.map(domain => {
            const current = domain.id === currentDomainId
            const summary = domain.tabs.map(tab => tab.label).join(' · ')
            return (
              <button key={domain.id} type="button"
                className={cn('domain-row', current && 'current')}
                data-domain={domain.id}
                aria-label={`${domain.name} — ${summary}`}
                aria-current={current ? 'true' : undefined}
                onClick={() => {
                  onClose()
                  navigate(routeForDomain(domain.id))
                }}>
                <span className="domain-row-mark"><ClayIcon name={domain.tabs[0].icon} size={44} /></span>
                <span className="domain-row-text"><strong>{domain.name}</strong><small>{summary}</small></span>
                <b className="domain-row-end" aria-hidden="true">{current ? '✓' : '↗'}</b>
              </button>
            )
          })}
        </div>
      </div>
    </div>, target,
  )
}
