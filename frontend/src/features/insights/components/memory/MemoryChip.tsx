import { useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'

/**
 * S8 (mezo-d6ivw.12) — the ONE memory chip of the chat and the csapatfal, extracted from S7's
 * `RememberedChip` (ReplyAfterlife.tsx). Four variants on one flat-pill shape (üveg: outside the
 * answer card, never glass in glass): remembered (t-spark · Megjegyeztem · Visszavonom), proposed
 * (t-bulb · Megjegyezném · Igen / Ne), recalled (t-people · Emlékszem: names ›) and forgotten
 * (t-eraser · Elfelejtettem: list · Mindent ebből a beszélgetésből?). Every action has busy /
 * error / done states, and the done state is gated on the artefact, not on the parent's status
 * (lesson 33). `surface="csapatfal"` renders S7's exact DOM (`mzc-remchip` / `tf-remgone`), so the
 * team-chat reply does not change visually. Source: docs/design_2.0/prototypes/elo/mezo.html „S8 ·".
 *
 * mezo-d6ivw.13 „Rólam is": a chat person-fact chip may carry `aboutMe` — a second, toggling
 * action (Rólam is ⇄ Rólad is · kész, aria-pressed) that copies the fact into the owner's own
 * facts. With two actions the chip is `is-two`: the button row wraps below the text (prototype
 * `.s8chip.two`). The csapatfal surface never gets it.
 *
 * Owner ruling 2026-09-28: "ezt ne jegyezd meg" forgets only the immediately preceding message;
 * when that message learned nothing, `forgotten.items` is empty — the chip then renders an
 * empty state instead of the "Elfelejtettem:" list (no heading, no permanence note), keeping the
 * widen offer when there is still more to forget from the conversation.
 */
export interface MemoryLine { who?: string | null; text: string }

export const memoryLabel = (m: MemoryLine) => (m.who ? `${m.who} — ${m.text}` : m.text)

type Phase = 'idle' | 'busy' | 'error' | 'done'

/** „Rólam is" (mezo-d6ivw.13): `on` = the copy is live; `onToggle` flips it. */
export interface AboutMeToggle { on: boolean; onToggle: () => Promise<void> }

function useChipAction() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [outcome, setOutcome] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>, as: string) => {
    setPhase('busy')
    try {
      await fn()
      setOutcome(as)
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }
  return { phase, outcome, run }
}

const UNDONE = 'Visszavonva — nem jegyeztem meg.'
const delayStyle = (delay?: number) => ({ ['--d' as string]: `${delay ?? 0}s` })

export type MemoryChipProps =
  | { variant: 'remembered'; surface?: 'chat' | 'csapatfal'; item: MemoryLine; sub?: string; sensitive?: boolean
      done?: boolean; undoneText?: string; forgotten?: boolean; delay?: number; onUndo: () => Promise<void>
      aboutMe?: AboutMeToggle }
  | { variant: 'proposed'; item: MemoryLine; forgotten?: boolean; rejected?: boolean; delay?: number
      onAccept: () => Promise<void>; onReject: () => Promise<void> }
  | { variant: 'recalled'; names: string[]; onOpen: () => void }
  | { variant: 'forgotten'; items: MemoryLine[]; canWiden: boolean; delay?: number; onWiden: () => void }

export function MemoryChip(props: MemoryChipProps) {
  switch (props.variant) {
    case 'remembered': return <Remembered {...props} />
    case 'proposed': return <Proposed {...props} />
    case 'recalled': return <Recalled {...props} />
    case 'forgotten': return <Forgotten {...props} />
  }
}

function ForgottenLine({ item }: { item: MemoryLine }) {
  return (
    <p className="mzc-memdone">
      <Icon3D name="t-eraser" size={16} />
      <span>Elfelejtve · <s>{memoryLabel(item)}</s></span>
    </p>
  )
}

function Remembered({ surface = 'chat', item, sub, sensitive, done, undoneText = UNDONE, forgotten, delay, onUndo, aboutMe }:
  Extract<MemoryChipProps, { variant: 'remembered' }>) {
  const { phase, run } = useChipAction()
  const [meBusy, setMeBusy] = useState(false)
  const [meError, setMeError] = useState(false)
  if (forgotten) return <ForgottenLine item={item} />
  if (done || phase === 'done') {
    return surface === 'csapatfal'
      ? <p className="tf-remgone">{undoneText}</p>
      : <p className="mzc-memdone"><Icon3D name="t-spark" size={16} />{undoneText}</p>
  }
  const busy = phase === 'busy' || meBusy
  const undo = () => void run(onUndo, 'undone')
  const toggleMe = async () => {
    if (!aboutMe) return
    setMeBusy(true)
    setMeError(false)
    try {
      await aboutMe.onToggle()
    } catch {
      setMeError(true)
    } finally {
      setMeBusy(false)
    }
  }
  if (surface === 'csapatfal') {
    return (
      <div className="mzc-remwrap col gap-xs">
        <div className="mzc-remchip row gap-xs">
          <Icon3D name="t-spark" size={18} />
          <span className="mzc-remtx"><b>Megjegyeztem:</b> {item.text}</span>
          <button type="button" className="mzc-remundo" disabled={busy} onClick={undo}>Visszavonom</button>
        </div>
        {phase === 'error' && <p className="tf-error" role="alert">Nem sikerült visszavonni — próbáld újra.</p>}
      </div>
    )
  }
  return (
    <>
      <div className={`mzc-memchip is-remembered${aboutMe ? ' is-two' : ''}`} style={delayStyle(delay)}>
        <Icon3D name="t-spark" size={20} />
        <span className="mzc-memtx">
          <b>Megjegyeztem:</b> {item.who && <><b>{item.who}</b> — </>}{item.text}
          {sensitive && <span className="mzc-remsens">érzékeny</span>}
          {sub && <small>{sub}</small>}
        </span>
        <span className="mzc-memacts">
          {aboutMe && (
            <button type="button" className={`mzc-mbtn is-me${aboutMe.on ? ' is-on' : ''}`} aria-pressed={aboutMe.on}
              disabled={busy} onClick={() => void toggleMe()}>
              {aboutMe.on ? 'Rólad is · kész' : 'Rólam is'}
            </button>
          )}
          <button type="button" className="mzc-mbtn is-ghost" disabled={busy} onClick={undo}>Visszavonom</button>
        </span>
      </div>
      {phase === 'error' && <p className="mzc-memerr" role="alert">Nem sikerült visszavonni — próbáld újra.</p>}
      {meError && <p className="mzc-memerr" role="alert">Nem sikerült — próbáld újra.</p>}
    </>
  )
}

function Proposed({ item, forgotten, rejected, delay, onAccept, onReject }: Extract<MemoryChipProps, { variant: 'proposed' }>) {
  const { phase, outcome, run } = useChipAction()
  if (forgotten) return <ForgottenLine item={item} />
  if (rejected || (phase === 'done' && outcome === 'rejected')) {
    return <p className="mzc-memdone"><Icon3D name="t-bulb" size={16} />Rendben, nem jegyzem meg — és nem is javaslom újra.</p>
  }
  // accepted: the parent swaps this chip for the "Megjegyeztem" one once the kept state lands
  const busy = phase === 'busy' || outcome === 'accepted'
  return (
    <>
      <div className="mzc-memchip is-proposed" style={delayStyle(delay)}>
        <Icon3D name="t-bulb" size={20} />
        <span className="mzc-memtx">
          <b>Megjegyezném:</b> {item.text}
          <small>rólad szól, ezért előbb megkérdezlek</small>
        </span>
        <span className="mzc-memacts">
          <button type="button" className="mzc-mbtn" disabled={busy} onClick={() => void run(onAccept, 'accepted')}>Igen</button>
          <button type="button" className="mzc-mbtn is-ghost" disabled={busy} onClick={() => void run(onReject, 'rejected')}>Ne</button>
        </span>
      </div>
      {phase === 'error' && <p className="mzc-memerr" role="alert">Nem sikerült — próbáld újra.</p>}
    </>
  )
}

function Recalled({ names, onOpen }: Extract<MemoryChipProps, { variant: 'recalled' }>) {
  return (
    <button type="button" className="mzc-memrec" onClick={onOpen} aria-label="Mit vettem elő róluk">
      <Icon3D name="t-people" size={20} />
      <span>Emlékszem: <b>{names.join(' · ')}</b></span>
      <em aria-hidden="true">›</em>
    </button>
  )
}

function Forgotten({ items, canWiden, delay, onWiden }: Extract<MemoryChipProps, { variant: 'forgotten' }>) {
  if (items.length === 0) {
    return (
      <div className="mzc-memchip is-forgotten" style={delayStyle(delay)}>
        <Icon3D name="t-eraser" size={20} />
        <span className="mzc-memtx">
          Nem volt mit elfelejteni — az előző üzenetedből semmit nem jegyeztem meg.
          {canWiden && <button type="button" className="mzc-mbtn" onClick={onWiden}>Mindent ebből a beszélgetésből?</button>}
        </span>
      </div>
    )
  }
  return (
    <div className="mzc-memchip is-forgotten" style={delayStyle(delay)}>
      <Icon3D name="t-eraser" size={20} />
      <span className="mzc-memtx">
        <b>Elfelejtettem:</b>
        <ul>{items.map((i, n) => <li key={`${n}-${memoryLabel(i)}`}>{memoryLabel(i)}</li>)}</ul>
        <small>végleg — ezeket többé nem használom, és nem is tanulom meg újra</small>
        {canWiden && <button type="button" className="mzc-mbtn" onClick={onWiden}>Mindent ebből a beszélgetésből?</button>}
      </span>
    </div>
  )
}
