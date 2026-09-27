import { useState } from 'react'
import type { TeamChatThread } from '@/data/character/teamChatApi'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { Icon3D } from '@/shared/ui/clay'

/**
 * S7 (mezo-d6ivw.7, Task 9) — the csapatfal's answer afterlife: while the character is
 * writing back (`TypingRow`), once it closed the ügy in its own words (`CloseTag`), and the
 * "Megjegyeztem: …" standing-exception chip it may have left behind (`RememberedChip`), ported
 * from the approved prototype (docs/design_2.0/prototypes/uveg-uzenofal.html, `.typing`/`.ctag`/
 * `.remchip`/`.remgone`) into the app's `tf-chat-*` vocabulary. Dark only, flat — no glass inside
 * glass (üveg bible: the room itself is the one glass surface).
 */
export function TypingRow({ character }: { character: TeamCharacterId }) {
  const who = TEAM[character]
  return (
    <div className={`tf-chat-cm tf-c-${who.accent}`}>
      <span className="tf-chat-typing" role="status">
        <i /><i /><i />
        <span className="sr-only">{who.name} ír…</span>
      </span>
    </div>
  )
}

/** `RESOLVED` REPLY/EXCUSED close tag — "{Name} lezárta: {closeNote}" or "Kivétel: {closeNote}",
 *  both carrying the `csendben` pill (a lezárás sosem értesít). */
export function CloseTag({ thread }: { thread: TeamChatThread }) {
  if (thread.closeReason == null) return null
  const label = thread.closeReason === 'EXCUSED'
    ? `Kivétel: ${thread.closeNote ?? ''}`
    : `${TEAM[thread.owner].name} lezárta: ${thread.closeNote ?? ''}`
  return (
    <div className="tf-chat-tag">
      <span className="tf-st tf-s-sage">{label}</span>
      <span className="tf-chat-pm"><Icon3D name="t-clock" size={14} />csendben</span>
    </div>
  )
}

/** The "Megjegyeztem: …" standing-exception chip — visible only while `remembered.active`.
 *  After a successful undo (either locally just-tapped, or the thread coming back with
 *  `remembered.active === false`) shows the single muted "Visszavonva — …" line instead. A
 *  failed undo keeps the chip and shows a short error (the chip itself is the retry point). */
export function RememberedChip({ thread, onUndo }: {
  thread: TeamChatThread
  onUndo: (threadId: string) => Promise<void>
}) {
  const [undone, setUndone] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const remembered = thread.remembered
  if (remembered == null) return null

  if (undone || !remembered.active) {
    return <p className="tf-remgone">Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.</p>
  }

  const undo = async () => {
    setError(false)
    setBusy(true)
    try {
      await onUndo(thread.id)
      setUndone(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mzc-remwrap col gap-xs">
      <div className="mzc-remchip row gap-xs">
        <Icon3D name="t-spark" size={18} />
        <span className="mzc-remtx"><b>Megjegyeztem:</b> {remembered.text}</span>
        <button type="button" className="mzc-remundo" disabled={busy} onClick={() => void undo()}>Visszavonom</button>
      </div>
      {error && <p className="tf-error" role="alert">Nem sikerült visszavonni — próbáld újra.</p>}
    </div>
  )
}
