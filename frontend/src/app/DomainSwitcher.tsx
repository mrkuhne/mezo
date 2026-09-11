// ============================================================
// Mezo · Domain switcher dialog (mezo-jkh4)
// "Egy társ. Öt világ." — lists the five domains, each with its name + its four tab
// labels joined by " · "; the current domain is marked. Selecting a domain navigates
// to its last-visited tab (navMemory), else its first tab. A thin wrapper over the
// house `Sheet` primitive (the QuickInputSheet idiom).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Sheet } from '@/shared/ui/Sheet'
import { ClayIcon } from '@/shared/ui/clay'
import { DOMAINS, routeForDomain } from '@/app/navModel'

export function DomainSwitcher({
  currentDomainId,
  onClose,
}: {
  currentDomainId: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  return (
    <Sheet onClose={onClose} className="domain-switcher" labelledBy="domain-switcher-title">
      {(close) => (
        <div className="domain-switcher-body">
          <p className="domain-switcher-eyebrow">MERRE MENJÜNK?</p>
          <h2 id="domain-switcher-title" className="sheet-title">
            Egy társ. Öt világ.
          </h2>
          <div className="domain-list">
            {DOMAINS.map((d) => {
              const current = d.id === currentDomainId
              return (
                <button
                  key={d.id}
                  type="button"
                  className={cn('domain-row', current && 'current')}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => {
                    const to = routeForDomain(d.id)
                    close()
                    navigate(to)
                  }}
                >
                  <span className="domain-row-mark">
                    <ClayIcon name={d.tabs[0].icon} size={30} />
                  </span>
                  <span className="domain-row-text">
                    <strong>{d.name}</strong>
                    <small>{d.tabs.map((t) => t.label).join(' · ')}</small>
                  </span>
                  <b className="domain-row-end" aria-hidden="true">
                    {current ? '✓' : '↗'}
                  </b>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Sheet>
  )
}
