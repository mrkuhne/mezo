import { useNavigate } from 'react-router-dom'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

export function CharacterHeader({ active }: { active: 'feed' | 'profile' | 'team' }) {
  const navigate = useNavigate()
  return (
    <header className="kr-social-header">
      <div className="kr-social-heading">
        <div>
          <span className="kr-social-eyebrow">EGYRE JOBBAN ISMERÜNK</span>
          <h1>Karakter</h1>
        </div>
        <PersonaOrb expertKey="mezo" size={52} />
      </div>
      <nav className="kr-social-tabs" aria-label="Karakter nézetek">
        {(
          [
            { id: 'feed', label: 'Üzenőfal', path: '' },
            { id: 'profile', label: 'Rólad', path: '/dimenziok' },
            { id: 'team', label: 'Csapat', path: '/csapat' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={active === tab.id ? 'page' : undefined}
            onClick={() => navigate(`/mezo/karakter${tab.path}`)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
