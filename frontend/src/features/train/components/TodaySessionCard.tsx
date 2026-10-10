// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Train's Mai (mezo-9bbc).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sessStep()` / `sessHero()` / `gymDayHero()`):
// the same session in two faces. As a ROW (default) it is a step in the „Ma még" card — time, the
// glyph bubble, the title, „tag · facts" with the state chip — and under it the done line, the
// kímélő line, the skipped box or the text-link actions. As the day's HERO (`hero`, when the day
// has no today-gym poster) it is the page's vessel: eyebrow „day · time · tag", the title as the
// verdict, the state + facts, a callout box for done / kímélő / skipped / the comeback run, and the
// one button on the liquid row. `graphic` replaces the glyph with the page's own drawing (the body
// of another day's gym session).
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { Icon3DName } from '@/shared/ui/clay'
import { Box, Btn, Bub, Hero, Lk, St, Step } from '@/shared/ui/folyadek'
import { DoneBar } from '@/features/train/components/DoneBar'
import { KimeloInner, RunRampInner, SkippedActs, SkippedBlock, SkippedBox } from '@/features/train/components/SkippedBlock'
import type { SessionTone } from '@/features/train/logic/sportKinds'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { SESSION_STATE_LABEL } from '@/features/train/logic/sessionState'
import { KIMELO } from '@/features/train/logic/skipCopy'

/** The wire labels are upper-case („FUTÁS", „MOST"); on white they read as words („Futás", „Most"). */
const KEEP_CAPS = new Set(['TRX'])
export function sentenceCase(s: string): string {
  if (KEEP_CAPS.has(s) || s !== s.toLocaleUpperCase('hu')) return s
  return s.charAt(0) + s.slice(1).toLocaleLowerCase('hu')
}

interface TodaySessionCardProps {
  tone: SessionTone
  /** The session's glyph (t-dumbbell, t-volley, t-run…), in its bubble. */
  art: Icon3DName
  tag: string
  time?: string | null
  title: string
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  loggedDetail?: string | null
  stateLabel?: string | null
  ctaLabel?: string
  onLog?: () => void
  /** Kihagyás S1 (mezo-q4xt2.1): the skip row when this occurrence is skipped — the chip reads
   *  „Kihagyva" and the actions give way to the skipped box (reason, effect, Másik ok / Visszavonom). */
  skipped?: PlannedSkip
  /** Offers the „Kihagyom"/„Kihagytam" link beside the action (omit ⇒ no link). */
  onSkip?: () => void
  skipLabel?: 'Kihagyom' | 'Kihagytam'
  onSkipReason?: () => void
  onSkipUndo?: () => void
  /** Kímélő mód S2 (mezo-q4xt2.2): the occurrence sits on a protected day — the chip reads
   *  „Kímélő mód" and the calm kímélő line replaces the actions (no skip link: the day already
   *  kimarad). Wins over a real skip row on the same date. */
  kimelo?: boolean
  /** The first run after a comeback: the „Visszatérő futás" note. */
  rampNote?: boolean
  /** A one-off event (not a weekly slot): said after the facts. */
  oneOff?: boolean
  /** The hero face: this session is the day's main card. */
  hero?: boolean
  /** Hero only — the day in front of the eyebrow („Ma", „Kedd"). */
  eyebrow?: string
  /** Hero only — the page's own drawing instead of the glyph bubble (stands under the text). */
  graphic?: ReactNode
  /** Hero only — the label of the button that opens a logged session (default „Megnézem"). */
  doneCta?: string
}

export function TodaySessionCard({
  tone, art, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog,
  skipped, onSkip, skipLabel = 'Kihagyom', onSkipReason, onSkipUndo, kimelo, rampNote,
  oneOff, hero, eyebrow, graphic, doneCta = 'Megnézem',
}: TodaySessionCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  // A logged session wins over a skip (a trained day is never "skipped").
  const isKm = !logged && Boolean(kimelo)
  const isSkip = !logged && !isKm && Boolean(skipped)
  const missed = stateLabel === SESSION_STATE_LABEL.missed
  const planned = stateLabel === SESSION_STATE_LABEL.planned
  const state = logged ? 'Megvan' : isKm ? KIMELO.innerTitle : isSkip ? 'Kihagyva' : stateLabel ? sentenceCase(stateLabel) : null
  const stateCls = cn('em-sess-state', (isSkip || isKm) && 'is-skip', !logged && !isSkip && !isKm && missed && 'is-miss')
  const cls = cn('em-sess', `em-sess-${tone}`, logged && 'is-logged', (isSkip || isKm) && 'is-skip')
  const name = <span className="em-sess-title">{title}</span>
  const openLabel = interactive ? `${title} — logolt session megnyitása` : undefined

  if (hero) {
    const rest = [...pills, oneOff && 'egyszeri esemény'].filter(Boolean).join(' · ')
    let actions: ReactNode
    if (logged) actions = interactive ? <Btn onClick={onLog} aria-label={openLabel}>{doneCta}</Btn> : undefined
    else if (isKm) actions = undefined
    else if (isSkip) actions = <SkippedActs skip={skipped!} onReason={() => onSkipReason?.()} onUndo={() => onSkipUndo?.()} />
    else if (interactive || onSkip) {
      actions = (
        <>
          {interactive && <Btn grow onClick={onLog}>{ctaLabel}</Btn>}
          {onSkip && <Lk onClick={onSkip}>{skipLabel}</Lk>}
        </>
      )
    }
    return (
      <Hero className={cn(cls, 'em-sess-hero')}
        label={[eyebrow, time, sentenceCase(tag)].filter(Boolean).join(' · ')}
        verdict={name}
        sub={state || rest ? <>{state && <span className={stateCls}>{state}</span>}{state && rest ? ' · ' : ''}{rest}</> : undefined}
        left={graphic ? undefined : <Bub icon={art} size={60} />}
        actions={actions}>
        {graphic}
        {logged ? (
          !graphic && loggedSummary ? (
            <Box icon="t-tick" color="var(--fo-ok)" title={loggedSummary} className="em-doneb">
              {loggedDetail ? <p>{loggedDetail}</p> : null}
            </Box>
          ) : null
        ) : isKm ? (
          <Box icon="t-kimelo" title={KIMELO.innerTitle} className="em-skipd"><p>{KIMELO.innerSub}</p></Box>
        ) : isSkip ? (
          <SkippedBox skip={skipped!} />
        ) : rampNote ? (
          <Box icon="t-sprout" title={KIMELO.runRampTitle} className="em-skipd"><p>{KIMELO.runRamp}</p></Box>
        ) : null}
      </Hero>
    )
  }

  const line = [sentenceCase(tag), ...pills, oneOff && 'egyszeri'].filter(Boolean).join(' · ')
  return (
    <div className={cls}>
      <Step time={time ?? undefined} icon={art} title={name}
        sub={(
          <>
            <span className="em-sess-facts">{line}</span>
            {state && (
              <> <St tone={logged ? 'ok' : isKm || isSkip || planned ? 'q' : missed ? 'bad' : 'plan'} className={stateCls}>{state}</St></>
            )}
          </>
        )} />
      {logged ? (
        <DoneBar
          summary={loggedSummary ?? ''}
          detail={loggedDetail}
          onClick={interactive ? onLog : undefined}
          ariaLabel={openLabel}
        />
      ) : isKm ? (
        <KimeloInner />
      ) : isSkip ? (
        <SkippedBlock inner skip={skipped!} onReason={() => onSkipReason?.()} onUndo={() => onSkipUndo?.()} />
      ) : (
        <>
          {rampNote && <RunRampInner />}
          {(interactive || onSkip) && (
            <div className="em-in em-sess-cta">
              {interactive && <Lk onClick={onLog}>{ctaLabel}</Lk>}
              {onSkip && <Lk onClick={onSkip}>{skipLabel}</Lk>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
