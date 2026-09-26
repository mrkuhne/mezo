import { ContentIcon, Icon3D } from '@/shared/ui/clay'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { LevelUpGain, LevelUpResult } from '@/data/train/trainApi'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import {
  CHIP_3D_BY_SOURCE,
  HEADLINE_BY_SOURCE,
  HEADLINE_NO_LEVELUP,
  skillDisplay,
} from '@/features/progression/logic/levelUpMeta'

// One accent per skill kind (bible §2): body = Edzés coral, athletic = sky, life = Én rose.
const ACCENT_BY_KIND: Record<LevelUpGain['kind'], string> = {
  MUSCLE: 'var(--dv-coral)',
  ATHLETIC: 'var(--dv-sky)',
  LIFE: 'var(--dv-rose)',
}

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

/**
 * Full-bleed animated post-workout level-up overlay, in the üveg look (mezo-me75u.10,
 * prototypes/uveg-reteg.html#szint): a frameless gold→lavender halo on the dark ground, a
 * gradient numeral, glass level-up rows, flat cells for the rest. Self-portals into
 * `.phone-screen` (the Sheet technique) so it covers the TabBar. CSS keyframes (no-preference
 * branch only) + rAF count-up; reduced motion renders everything in its final state.
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
  const chipText = [
    (result.workoutLabel ?? '').toUpperCase(),
    result.durationMin != null ? `${result.durationMin}′` : null,
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
    const cta = overlayRef.current?.querySelector<HTMLButtonElement>('.lvu-cta')
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

  // Üveg look (mezo-me75u.10, prototypes/uveg-reteg.html#szint): the header (chip, headline,
  // numeral) is on screen at once; the three sections rise in turn, only in the no-preference
  // motion branch (CSS). `--p` (0→1) follows the count-up and drives the halo's strength.
  const haloP = result.totalXp > 0 ? Math.min(1, totalXp / result.totalXp) : 1

  const ringFor = (g: LevelUpGain) => (
    <span className="lvu-ring">
      <svg className="uv-ring" viewBox="0 0 80 80" aria-hidden="true">
        <circle className="uv-ring-track" cx="40" cy="40" r="34" pathLength={100} />
        <circle
          className="uv-ring-prog"
          cx="40"
          cy="40"
          r="34"
          pathLength={100}
          style={{ strokeDasharray: `${clampPct(g.progressToPct)} 100` }}
        />
      </svg>
      <b>{g.levelAfter}</b>
    </span>
  )

  const overlay = (
    <div
      ref={overlayRef}
      className={`levelup lvu${reduced ? ' levelup--reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Szintlépés"
    >
      <div className="lvu-body">
        {/* mezo-tr5v: content block is vertically centered (margin-block:auto) while the CTA
            below stays pinned to the bottom — no more top-loaded empty space. */}
        <div className="lvu-content">
          <section className="lvu-hero" style={{ ['--p' as string]: String(haloP) } as CSSProperties}>
            <span className="lvu-chip" data-source={result.source}>
              <Icon3D name={CHIP_3D_BY_SOURCE[result.source]} size={22} />
              {chipText}
            </span>
            <div className="lvu-headline">{headline}</div>
            {/* The visible digits animate; an sr-only sentence carries the final total to AT. */}
            <b className="lvu-xp" aria-hidden="true">
              +<span>{totalXp}</span>
            </b>
            <span className="lvu-xplabel uv-eyebrow" aria-hidden="true">XP · ÖSSZESEN</span>
            <span className="lu-sr-only">Összesen {result.totalXp} XP</span>
          </section>

          {leveled.length > 0 && (
            <div className="lvu-sec lvu-s1">
              <div className="lvu-seclabel uv-eyebrow">
                Szintlépés <span className="lvu-cnt">· {leveled.length}</span>
              </div>
              {leveled.map((g) => {
                const meta = skillDisplay(g.skillKey, g.kind, g.name)
                return (
                  <div
                    key={g.skillKey}
                    className="lvu-row glass"
                    data-kind={g.kind}
                    style={{ ['--c' as string]: ACCENT_BY_KIND[g.kind] } as CSSProperties}
                  >
                    {ringFor(g)}
                    <span className="lvu-grow">
                      <span className="lvu-nm">
                        <ContentIcon name={meta.art3d} size={30} />
                        <span>{meta.name}</span>
                      </span>
                      <span className="lvu-badge">
                        <Icon3D name="t-up" size={16} />
                        LEVEL UP · Lv{g.levelBefore} → {g.levelAfter}
                      </span>
                    </span>
                  </div>
                )
              })}
              {result.perks.map((p) => (
                <div key={p.perkKey} className="lvu-perk">
                  <Icon3D name="t-star" size={20} />
                  <span>
                    <b>{p.name}</b> — <span className="lvu-eff">{p.effectCopy}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {(rest.length > 0 || result.robustness.xpGained > 0) && (
            <div className="lvu-sec lvu-s2">
              {rest.length > 0 && (
                <>
                  <div className="lvu-seclabel uv-eyebrow">
                    Még fejlődött <span className="lvu-cnt">· {rest.length}</span>
                  </div>
                  <div className="lvu-grid">
                    {rest.map((g) => {
                      const meta = skillDisplay(g.skillKey, g.kind, g.name)
                      return (
                        <div
                          key={g.skillKey}
                          className="lvu-cell"
                          data-kind={g.kind}
                          style={{ ['--c' as string]: ACCENT_BY_KIND[g.kind] } as CSSProperties}
                        >
                          <span className="lvu-ct">
                            <ContentIcon name={meta.art3d} size={26} />
                            <span className="lvu-cname">{meta.name}</span>
                            <em>+{g.xpGained}</em>
                          </span>
                          <span className="lvu-bar uv-bar">
                            <b style={{ ['--w' as string]: `${clampPct(g.progressToPct)}%` } as CSSProperties} />
                            <b
                              className="lvu-from"
                              style={{ ['--w' as string]: `${clampPct(g.progressFromPct)}%` } as CSSProperties}
                            />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {result.robustness.xpGained > 0 && (
                <div className="lvu-robust">
                  <Icon3D name="t-shield" size={30} />
                  <span className="lvu-rtx">
                    <b>Robusztusság</b> · {result.robustness.streakWeeks}. egymást követő héten edzel
                  </span>
                  <em>+{result.robustness.xpGained}</em>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lvu-foot lvu-sec lvu-s3">
          <button type="button" className="lvu-cta glass" onClick={onContinue}>
            <Icon3D name="t-tick" size={40} />
            <strong>Tovább</strong>
            <em aria-hidden="true">›</em>
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, target)
}
