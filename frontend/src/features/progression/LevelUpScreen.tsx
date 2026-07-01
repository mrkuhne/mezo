import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LevelUpGain, LevelUpResult } from '@/lib/trainApi'
import { useReducedMotion } from '@/lib/useReducedMotion'
import {
  CHIP_ICON_BY_SOURCE,
  HEADLINE_BY_SOURCE,
  HEADLINE_NO_LEVELUP,
  skillDisplay,
} from './levelUpMeta'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R // ≈ 163.36 — matches the mockup's dasharray

// rAF count-up to `target`; jumps straight to the final value when reduced.
function useCountUp(target: number, reduced: boolean, durationMs = 1100): number {
  const [val, setVal] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') {
      setVal(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, durationMs])
  return val
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))
// within-level fill of the ring/bar → stroke-dashoffset (0% = empty = full offset)
const ringOffset = (pct: number) => RING_C * (1 - clampPct(pct) / 100)

/**
 * Full-bleed animated post-workout level-up overlay (levelup-v4 mockup ported to
 * app tokens). Self-portals into `.phone-screen` (the Sheet technique) so it
 * covers the TabBar. Hand-rolled CSS keyframes, rAF count-up; reduced
 * motion renders everything in its final/filled state with the stagger collapsed.
 * Always shows something (XP + bars) — the no-level-up case omits the Szintlépés
 * section and adapts the headline; never a dead-end. Single `Tovább` CTA.
 */
export function LevelUpScreen({ result, onContinue }: { result: LevelUpResult; onContinue: () => void }) {
  const reduced = useReducedMotion()
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)
  const totalXp = useCountUp(result.totalXp, reduced)

  // Split gains: leveled (mini-ring rows) vs the rest (grid).
  const leveled = result.gains.filter(
    (g) => result.levelUps.includes(g.skillKey) || g.levelAfter > g.levelBefore,
  )
  const leveledKeys = new Set(leveled.map((g) => g.skillKey))
  const rest = result.gains.filter((g) => !leveledKeys.has(g.skillKey))

  const headline = leveled.length > 0 ? HEADLINE_BY_SOURCE[result.source] : HEADLINE_NO_LEVELUP
  const chipIcon = CHIP_ICON_BY_SOURCE[result.source]
  const chipText = [
    (result.workoutLabel ?? '').toUpperCase(),
    result.durationMin != null ? `${result.durationMin}'` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Modal focus management (the overlay claims aria-modal): move focus to the CTA
  // on mount, trap Tab to it (the single action), Escape dismisses, and restore
  // focus to the trigger on unmount.
  const overlayRef = useRef<HTMLDivElement>(null)
  const onContinueRef = useRef(onContinue)
  onContinueRef.current = onContinue
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const cta = overlayRef.current?.querySelector<HTMLButtonElement>('.lu-cta')
    cta?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onContinueRef.current()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        cta?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [])

  // top-to-bottom stagger: each animated element gets an increasing delay (s)
  let delay = 0.1
  const next = (step = 0.16) => {
    const d = delay
    delay += step
    return d
  }

  const animStyle = (d: number) => (reduced ? undefined : { animationDelay: `${d}s` })

  const ringFor = (g: LevelUpGain) => {
    const off = ringOffset(g.progressToPct)
    return (
      <div className="lu-miniring">
        <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
          <circle className="lu-mr-track" cx="29" cy="29" r={RING_R} />
          <circle
            className="lu-mr-prog"
            cx="29"
            cy="29"
            r={RING_R}
            style={{
              strokeDasharray: RING_C,
              // base offset = empty; the keyframe fills to --lu-ring-offset.
              ['--lu-ring-offset' as string]: String(off),
              ...(reduced ? { strokeDashoffset: off } : {}),
            }}
          />
        </svg>
        <div className="lu-mr-num">{g.levelAfter}</div>
      </div>
    )
  }

  const overlay = (
    <div
      ref={overlayRef}
      className={`levelup${reduced ? ' levelup--reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Szintlépés"
    >
      <div className="lu-glow" aria-hidden="true" />

      <div className="lu-body">
        <div className="lu-chip lu-anim" style={animStyle(next(0.18))}>
          <span aria-hidden="true">{chipIcon}</span> {chipText}
        </div>
        <div className="lu-headline lu-anim" style={animStyle(next(0.18))}>
          {headline}
        </div>

        <div className="lu-xpwrap lu-anim" style={animStyle(next(0.9))}>
          {/* The visible digits animate; an sr-only sentence carries the final total to AT. */}
          <div className="lu-xpnum" aria-hidden="true">
            <span className="lu-plus">+</span>
            <span>{totalXp}</span>
          </div>
          <div className="lu-xplabel" aria-hidden="true">XP · ÖSSZESEN</div>
          <span className="lu-sr-only">Összesen {result.totalXp} XP</span>
        </div>

        {leveled.length > 0 && (
          <>
            <div className="lu-seclabel lu-anim" style={animStyle(next())}>
              Szintlépés <span className="lu-cnt">· {leveled.length}</span>
            </div>
            {leveled.map((g) => {
              const meta = skillDisplay(g.skillKey, g.kind, g.name)
              return (
                <div
                  key={g.skillKey}
                  className={`lu-lvrow lu-pop${g.kind === 'MUSCLE' ? ' muscle' : ''}`}
                  style={animStyle(next(0.14))}
                >
                  {ringFor(g)}
                  <div className="lu-lvinfo">
                    <div className="lu-lvname">
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.name}</span>
                    </div>
                    <span className="lu-lvbadge">
                      LEVEL UP · Lv{g.levelBefore} → {g.levelAfter}
                    </span>
                  </div>
                </div>
              )
            })}
            {result.perks.map((p) => (
              <div key={p.perkKey} className="lu-perk lu-anim" style={animStyle(next(0.14))}>
                <span className="lu-pk-ic" aria-hidden="true">
                  ★
                </span>
                <span className="lu-pk-tx">
                  <b>{p.name}</b> — <span className="lu-eff">{p.effectCopy}</span>
                </span>
              </div>
            ))}
          </>
        )}

        {rest.length > 0 && (
          <>
            <div className="lu-seclabel lu-anim" style={animStyle(next())}>
              Még fejlődött <span className="lu-cnt">· {rest.length}</span>
            </div>
            <div className="lu-growgrid">
              {rest.map((g) => {
                const meta = skillDisplay(g.skillKey, g.kind, g.name)
                return (
                  <div
                    key={g.skillKey}
                    className={`lu-gcell lu-anim${g.kind === 'MUSCLE' ? ' mus' : ''}`}
                    style={animStyle(next(0.1))}
                  >
                    <div className="lu-gtop">
                      <span className="lu-gic" aria-hidden="true">
                        {meta.icon}
                      </span>
                      <span className="lu-gname">{meta.name}</span>
                      <span className="lu-gxp">+{g.xpGained}</span>
                    </div>
                    <div className="lu-gbar">
                      <div
                        className="lu-gfill"
                        style={{
                          ['--lu-from' as string]: `${clampPct(g.progressFromPct)}%`,
                          ['--lu-to' as string]: `${clampPct(g.progressToPct)}%`,
                          ...(reduced ? { width: `${clampPct(g.progressToPct)}%` } : {}),
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {result.robustness.xpGained > 0 && (
          <div className="lu-robust lu-anim" style={animStyle(next(0.12))}>
            <span className="lu-r-ic" aria-hidden="true">
              🛡️
            </span>
            <span className="lu-r-tx">
              <b>Robusztusság</b> · {result.robustness.streakWeeks}. egymást követő héten edzel
            </span>
            <span className="lu-r-xp">+{result.robustness.xpGained}</span>
          </div>
        )}

        <div className="lu-ctas lu-anim" style={animStyle(next(0.16))}>
          <button type="button" className="lu-cta" onClick={onContinue}>
            Tovább ›
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, target)
}
