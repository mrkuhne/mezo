// ============================================================
// Mezo · Karakter — CsapatPage (mezo-1gim.13, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-csapat` / `csapatBody`
// (search `.persocard`) — the 9 persona cards straight off `useCharacterExperts()`, in
// catalog order (7 EXPERT, then SKEPTIC, then CHAIR, per the Task 1 contract).
//
// role/voiceLine/watch render exactly what the DTO serves, nothing invented (Global
// Constraints: honest states). The prototype's card anatomy differs by `kind`:
//  · EXPERT — pnm=displayName, prole=voiceLine, pwatch="mit figyel: " + watch.join(' · '),
//    a role pchip badge (the domain-color wash).
//  · SKEPTIC — the graphite variant: pnm=displayName, prole=voiceLine, pwatch=watch.join(' · ')
//    with NO "mit figyel:" prefix (the prototype's szkeptikus card doesn't carry one) and no
//    pchip (CSS `:not(.szkeptikus)`).
//  · CHAIR (mezo) — the coral-gradient variant with the real `s-orb` (PersonaOrb already falls
//    back to `s-orb` for any key it doesn't have a domain variant for): pnm=displayName,
//    pwatch=watch.join(' · ') (only rendered when non-empty), no pchip. `CharacterService.experts()`
//    sets Mezo's `role` field to literally the same string as its `voiceLine` ("Elnök ·
//    Integrátor" — the backend's own javadoc calls this a known minor duplication, since the
//    prototype's mezo card has no separate role/pchip to source a distinct value from). Printing
//    both fields as two subtitle lines would show the identical sentence twice, so this page
//    renders ONE subtitle line off `role` for CHAIR (equal in value to `voiceLine`, never both).
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterExperts } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterExpertDto } from '@/data/character/characterApi'

function watchLine(expert: CharacterExpertDto): string | null {
  if (expert.watch.length === 0) return null
  return expert.kind === 'EXPERT' ? `mit figyel: ${expert.watch.join(' · ')}` : expert.watch.join(' · ')
}

export function CsapatPage() {
  const navigate = useNavigate()
  const { experts, isLoading } = useCharacterExperts()

  if (isLoading) return null

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Csapat</div>
        <div className="mz-hero-sb">Mezo belső tanácsa — ők dolgoznak a karakteren</div>
      </div>
      <div className="mz-page-body">
        {experts.map((e, i) => {
          const color = expertColor(e.key)
          const isSkeptic = e.kind === 'SKEPTIC'
          const isChair = e.kind === 'CHAIR'
          const variant = isSkeptic ? ' szkeptikus' : isChair ? ' mezo' : ''
          const subtitle = isChair ? e.role : e.voiceLine
          const watch = watchLine(e)
          return (
            <div
              key={e.key}
              className={`kr-persocard${variant} rise`}
              style={{ '--d': `${i * 55}ms` } as React.CSSProperties}
            >
              <div
                className={`kr-pdisc${isChair ? ' orb' : ''}`}
                style={!isSkeptic && !isChair ? ({ '--pc': color } as React.CSSProperties) : undefined}
              >
                <PersonaOrb expertKey={e.key} size={36} />
              </div>
              <div className="kr-pinfo">
                <div className="kr-pnm">{e.displayName}</div>
                <div className="kr-prole">{subtitle}</div>
                {watch != null && <div className="kr-pwatch">{watch}</div>}
                {e.kind === 'EXPERT' && (
                  <span className="kr-pchip" style={{ '--pcw': `${color}22`, '--pc': color } as React.CSSProperties}>
                    {e.role}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
