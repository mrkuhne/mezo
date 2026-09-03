// ============================================================
// Mezo · Karakter — TranscriptTurn (mezo-1gim.13, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#konzTurns` render loop (`.turn`
// / `.tavatar` / `.tbub` / `.userquote`) — one konzílium transcript turn: a persona-railed
// bubble, szkeptikus getting the graphite face, mezo's ruling getting the full-width coral tint
// and no avatar.
//
// DANIEL VÁLASZA — the backend has no structured "this is Daniel's own words" field on a turn
// (`ConferenceTurn{persona,text,refIds}` — see api.gen.ts). `KonziliumProposalRound`'s own
// USER_FEEDBACK_PREFIX constant ("DANIEL VÁLASZA — ", backend
// service/KonziliumProposalRound.java) is fed to the LLM as an instruction to keep the user's
// own correction unmistakable when it quotes one back — so a line carrying that literal prefix
// can show up INSIDE an expert turn's free text, never as its own field. This component
// therefore splits `text` on newlines and re-styles any line that starts with the prefix as
// the prototype's `.userquote` gold rail — detecting real S6 output shape, not inventing a
// structured field the API doesn't have.
// ============================================================
import type { CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import type { ConferenceTurn } from '@/data/character/characterApi'

const DANIEL_PREFIX = 'DANIEL VÁLASZA — '

interface Line {
  isDaniel: boolean
  text: string
}

function splitLines(text: string): Line[] {
  return text.split('\n').map((line) => (
    line.startsWith(DANIEL_PREFIX)
      ? { isDaniel: true, text: line.slice(DANIEL_PREFIX.length) }
      : { isDaniel: false, text: line }
  ))
}

export interface TranscriptTurnProps {
  turn: ConferenceTurn
  /** derived from the persona's catalog `kind` (Task 1 contract) — SKEPTIC gets the graphite
   *  face, CHAIR gets the full-width coral ruling face, everything else (EXPERT, or an
   *  unrecognized persona key — never a crash on catalog drift) is a plain rail bubble. */
  kind: 'EXPERT' | 'SKEPTIC' | 'CHAIR'
  displayName: string
  color: string
  delayMs?: number
}

export function TranscriptTurn({ turn, kind, displayName, color, delayMs }: TranscriptTurnProps) {
  const isSkeptic = kind === 'SKEPTIC'
  const isRuling = kind === 'CHAIR'
  const variant = isSkeptic ? ' szkeptikus' : isRuling ? ' ruling' : ''
  const lines = splitLines(turn.text)
  const style = { '--tc': color, ...(delayMs != null ? { '--d': `${delayMs}ms` } : {}) } as CSSProperties

  return (
    <div className={`kr-turn${variant} rise`} style={style}>
      {!isRuling && (
        <div className="kr-tavatar" style={{ '--tc': color } as CSSProperties}>
          <PersonaOrb expertKey={turn.persona} size={24} />
        </div>
      )}
      <div className="kr-tbub">
        <div className="kr-tname">{displayName}</div>
        <div className="kr-ttxt">
          {lines.map((line, i) => (
            line.isDaniel
              ? (
                  <span key={i} className="kr-danielline">
                    <span className="kr-ul">Daniel válasza</span>
                    <span className="kr-ut">{line.text}</span>
                  </span>
                )
              : <span key={i}>{i > 0 && <br />}{line.text}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
