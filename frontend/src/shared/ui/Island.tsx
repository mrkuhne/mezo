// ============================================================
// Mezo · Island — domain-free shell for a "sky" of morphing tiles
// (born in Today's three-islands redesign, mezo-euze; promoted to
// shared/ui as Fuel's window-river became its 2nd consumer,
// mezo-jgh9). The shell is a single continuous bubble: capsule
// (29px radius, floaty) ↔ big island (34px radius, morphing halo
// blob) on one shared spring curve; the capsule layer sits absolute
// on the shell and cross-fades, so the morph never shows an empty
// frame. Content (the big view) comes in as children — this file
// knows nothing about facts, items, or any domain: the caller
// supplies the tone, the capsule's language (emoji/title/essence),
// and the full spoken aria-label.
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type IslandTone = 'reggel' | 'nap' | 'este' | 'fuel' | 'keret'

export interface IslandCapsule {
  emoji: string
  title: string
  essence: string
  count: string
  nowTag?: string
}

export interface IslandProps {
  tone: IslandTone
  big: boolean
  /** Chronological "now" — gold ring + nowTag on the capsule, independent of selection. */
  nowRing: boolean
  capsule: IslandCapsule
  /** Night phase — the shell itself goes dark (theme-invariant, like the retired .wdb-night). */
  night?: boolean
  /** Belt variant: fixed 54px, no float — a row of shells rather than a sky of them. */
  belt?: boolean
  /** Full spoken label for the capsule button — the caller composes it (tone name, now, essence). */
  ariaLabel: string
  onSelect: () => void
  children: ReactNode
}

export function Island({ tone, big, nowRing, capsule, night, belt, ariaLabel, onSelect, children }: IslandProps) {
  return (
    <section
      className={cn('isl', big && 'isl-big', nowRing && 'now-clock', night && 'isl-night', belt && 'isl-belt')}
      data-tone={tone}
    >
      <div className="isl-blob" />
      <button
        type="button"
        className="isl-cap"
        aria-label={ariaLabel}
        aria-hidden={big || undefined}
        tabIndex={big ? -1 : undefined}
        onClick={onSelect}
      >
        <span aria-hidden="true">{capsule.emoji}</span>
        <span>
          <span className="isl-cap-t">{capsule.title}</span>
          <span className="isl-cap-m">{capsule.essence}</span>
        </span>
        {nowRing && <span className="isl-nowtag">{capsule.nowTag ?? 'MOST'}</span>}
        <span className="isl-cap-n">{capsule.count}</span>
      </button>
      <div className="isl-bigview" aria-current={big || undefined}>
        {big ? children : null}
      </div>
    </section>
  )
}
