// ============================================================
// Mezo · FaceEvening — the 🌙 face (mezo-j7u4): the Napzárás hero (with the
// wind-down card above it inside the dim/winddown window), the evening todos,
// the intention reflection, and the day's retrospective — the completed items
// with their DoneBar summaries plus the day's XP.
// The retrospective list IS this face's done surface, so — unlike the morning
// and day faces — no `DoneFold` is mounted here (it would repeat the same rows).
// ============================================================
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { RitualCard } from '@/features/today/components/RitualCard'
import { TodoCard } from '@/features/today/components/TodoCard'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { CompanionNote } from '@/data/types'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceEvening({
  open, done, doneXp, dayXp, note, onAct,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** Total XP earned today across every source — the retrospective's headline. */
  dayXp: number
  note: CompanionNote | null
  onAct: (item: TodayItem) => void
}) {
  const todo = open.filter((i) => i.source !== 'ritual')
  return (
    <>
      <WindDownBanner />
      <RitualCard />
      <TodoCard items={todo} doneCount={done.length} xp={doneXp} onAct={onAct} />
      <IntentionBanner variant="reflect" />
      {note && <CompanionNoteCard note={note} />}
      {done.length > 0 && (
        <>
          <div className="zoneline"><span>Ahogy a nap telt</span><i /></div>
          {done.map((it) => (
            <ItemRow key={it.id} tone={it.tone} emoji={it.emoji} title={it.title} subtitle={it.subtitle} done />
          ))}
          <div className="dayxp">Ma összesen <b>+{dayXp} XP</b></div>
        </>
      )}
    </>
  )
}
