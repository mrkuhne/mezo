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
// ============================================================
import type { CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterRunObservation } from '@/data/character/characterApi'

export function SignalChainCard({ observation, index, expertName }: {
  observation: CharacterRunObservation
  /** Position in the run's observation list — drives the numbered badge + entrance stagger. */
  index: number
  expertName: string
}) {
  return (
    <div className="kr-chain rise" style={{ '--d': `${index * 60}ms` } as CSSProperties}>
      <div className="kr-chain-num">{index + 1}</div>
      <div className="kr-chain-body">
        {observation.signals.map((signal, i) => (
          <div className="kr-chain-code" key={`${signal.detectorKey}-${i}`}>
            <span className="kr-detchip">{signal.detectorKey}</span>
            <span className="kr-chain-codetxt">{signal.summary}</span>
            {signal.refCount > 0 && <span className="kr-refcount">{signal.refCount} forrás-hivatkozás</span>}
          </div>
        ))}
        <div className="kr-chain-arrow" aria-hidden="true">↓</div>
        <div className="kr-chain-llm">
          <PersonaOrb expertKey={observation.expertKey} size={26} />
          <div className="kr-chain-llmtxt" style={{ '--tc': expertColor(observation.expertKey) } as CSSProperties}>
            <b>{expertName}</b>
            <p>{observation.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
