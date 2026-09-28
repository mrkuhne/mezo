import type { TeamChatThread } from '@/data/character/teamChatApi'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { Icon3D } from '@/shared/ui/clay'
import { closedByAnswer, STOP_CLOSE_NOTE } from '@/features/insights/logic/teamChat'
import { MemoryChip } from '@/features/insights/components/memory/MemoryChip'

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
 *  both carrying the `csendben` pill (a lezárás sosem értesít). Anything else (DATA, EXPIRED,
 *  still OPEN) renders nothing — never a dangling "{Name} lezárta: ". */
export function CloseTag({ thread }: { thread: TeamChatThread }) {
  if (!closedByAnswer(thread)) return null
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

/** The "Megjegyeztem: …" standing-exception chip — S8 (mezo-d6ivw.12): now the shared
 *  `MemoryChip` on its csapatfal surface (same DOM/classes as before, no visible change). Done
 *  after a local undo or when the thread comes back with `remembered.active === false`; the
 *  reopen clause only while the ügy is actually OPEN again. A STOP-withdrawn exception never
 *  lands here (the server drops it from `remembered`). */
export function RememberedChip({ thread, onUndo }: {
  thread: TeamChatThread
  onUndo: (threadId: string) => Promise<void>
}) {
  const remembered = thread.remembered
  if (remembered == null || thread.closeNote === STOP_CLOSE_NOTE) return null
  return (
    <MemoryChip
      variant="remembered"
      surface="csapatfal"
      item={{ text: remembered.text }}
      done={!remembered.active}
      undoneText={thread.status === 'OPEN'
        ? 'Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.'
        : 'Visszavonva — nem jegyeztem meg.'}
      onUndo={() => onUndo(thread.id)}
    />
  )
}
