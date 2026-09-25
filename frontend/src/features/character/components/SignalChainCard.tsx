// ============================================================
// Mezo · Karakter — SignalChainCard (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `chainPanelHTML` — one
// CharacterRunObservation rendered as two tone-separated rows: a monospace KÓD row (the
// detector chip + its deterministic summary + "N forrás-hivatkozás" — the Task 2 contract's
// refCount, raw refIds stay backend-side) → an arrow → an LLM row (the expert's own orb +
// the observation written in their voice). "kód detektál, LLM értelmez" made visually
// legible, not just documented.
//
// Final review (mezo-1gim.14, M4): production `DetectorSignal`s never carry `refIds` today —
// every real signal serves `refCount: 0` (CharacterService#toRunObservationSignal sums
// `signal.refIds().size()`, and no detector populates that list yet). Rendering "0
// forrás-hivatkozás" on every card would be exactly the kind of confident-looking-but-empty
// number this feature's honesty rule exists to forbid, so the ref line is hidden whenever
// refCount is 0 rather than printed as a hollow zero. `refCount > 0` stays wired up for when a
// future contract change actually starts populating refIds — this line isn't dead code, its
// input just happens to always be zero today.
//
// Üveg re-dress (U9, mezo-me75u.9): uveg-mezo-teljes-u9.js `futas()` jellánc — a FLAT panel in
// the observing character's accent (left accent edge): numbered badge + monospace detector-key
// chip(s), the code line, ↓, then the character figure + name + the observation. `expertName`
// is the csapatfal character's name (RunPage passes `personaName`).
// ============================================================
import type { CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { personaCharacter } from '@/features/character/personaCharacter'
import type { CharacterRunObservation } from '@/data/character/characterApi'

export function SignalChainCard({ observation, index, expertName }: {
  observation: CharacterRunObservation
  /** Position in the run's observation list — drives the numbered badge + entrance stagger. */
  index: number
  expertName: string
}) {
  const accent = personaCharacter(observation.expertKey).accent
  return (
    <div className={`gtm-chain tf-c-${accent} rise`} style={{ '--d': `${index * 60}ms` } as CSSProperties}>
      <div className="gtm-chain-th">
        <span className="gtm-chain-num">{index + 1}</span>
        {observation.signals.map((signal, i) => (
          <span className="gtm-det" key={`${signal.detectorKey}-${i}`}>{signal.detectorKey}</span>
        ))}
      </div>
      {observation.signals.map((signal, i) => (
        <p className="gtm-chain-code" key={`${signal.detectorKey}-${i}`}>
          {signal.summary}
          {signal.refCount > 0 && <span className="gtm-refcount"> · {signal.refCount} forrás-hivatkozás</span>}
        </p>
      ))}
      <span className="gtm-chain-arrow" aria-hidden="true">↓</span>
      <div className="gtm-chain-who">
        <PersonaOrb expertKey={observation.expertKey} size={30} />
        <b style={{ color: expertColor(observation.expertKey) }}>{expertName}</b>
      </div>
      <p className="gtm-chain-obs">{observation.text}</p>
    </div>
  )
}
