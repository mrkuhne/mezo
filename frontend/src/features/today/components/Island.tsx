// ============================================================
// Mezo · Island — one daypart's shell in the three-islands Today
// (mezo-euze). The shell is a single continuous bubble: capsule
// (29px radius, floaty) ↔ big island (34px radius, morphing halo
// blob) on one shared spring curve; the capsule layer sits absolute
// on the shell and cross-fades, so the morph never shows an empty
// frame. Content (the big view) comes in as children — this file
// knows nothing about facts or items.
// ============================================================
import type { ReactNode } from 'react'
import type { DayFace } from '@/features/today/logic/dayFace'
import { FACE_EMOJI, FACE_LABEL } from '@/features/today/logic/dayFace'
import { cn } from '@/shared/lib/cn'

export interface IslandProps {
  face: DayFace
  big: boolean
  /** Chronological "now" — gold ring + MOST tag on the capsule, independent of selection. */
  nowClock: boolean
  capsule: { essence: string; count: string }
  /** Evening night phase — the shell itself goes dark (theme-invariant, like the retired .wdb-night). */
  night?: boolean
  onSelect: (face: DayFace) => void
  children: ReactNode
}

export function Island({ face, big, nowClock, capsule, night, onSelect, children }: IslandProps) {
  const label = `${FACE_LABEL[face]}${nowClock ? ' · most' : ''} · ${capsule.essence} · megnyitás`
  return (
    <section className={cn('isl', big && 'isl-big', nowClock && 'now-clock', night && 'isl-night')} data-face={face}>
      <div className="isl-blob" />
      <button
        type="button"
        className="isl-cap"
        aria-label={label}
        aria-hidden={big || undefined}
        tabIndex={big ? -1 : undefined}
        onClick={() => onSelect(face)}
      >
        <span aria-hidden="true">{FACE_EMOJI[face]}</span>
        <span>
          <span className="isl-cap-t">{FACE_LABEL[face]}</span>
          <span className="isl-cap-m">{capsule.essence}</span>
        </span>
        {nowClock && <span className="isl-nowtag">MOST</span>}
        <span className="isl-cap-n">{capsule.count}</span>
      </button>
      <div className="isl-bigview" aria-current={big || undefined}>
        {big ? children : null}
      </div>
    </section>
  )
}
