// ============================================================
// Mezo · MezoThreadProvider — a nap mezo-szálának EGYETLEN példánya (mezo-atry).
// A szálat két felület olvassa: az `/nap/uzenetek` oldal (kirajzolja) és a shell fejléce
// (csak az olvasatlan-számot mutatja). Amíg mindkettő maga építette, ELTÉRTEK: az oldal a
// küszöb-nudge-okkal együtt építette (`buildMezoMessages` a szál VÉGÉRE fűzi őket) és az
// utolsó elem id-jével bélyegezte az olvasottság-vízjelet, a fejléc viszont nudge-ok nélkül
// — így a vízjel egy olyan id lett, amit a fejléc listája sosem tartalmazott, a
// `findIndex` mindig -1-et adott, és a badge SOSEM tudott lenullázódni.
//
// A javítás nem az összehasonlítás foltozása, hanem hogy egyáltalán ne legyen két szál:
// a provider a shellben ül (AppLayout), ott fut a nudge-levezetés és a megjelenés-napló
// írása is EGYSZER, a fogyasztók pedig ugyanazt a listát kapják.
//
// Az olvasottság-vízjel itt REACT-ÁLLAPOT is, nem csak localStorage: az oldal `markSeen()`-t
// hív, amitől a fejléc badge-e AZONNAL nullázódik (korábban a fejléc útvonalváltásra
// olvasta újra a vízjelet, tehát a saját oldalán még égett). A localStorage-olvasás egyetlen
// megmaradt újrafuttatója a DÁTUM váltása — a kulcs napra szól, éjfélkor új napot kezdünk.
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveBriefing, useCompanionFeed, useSleepGoal, useTodayScenario } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { lastSeenMessage, markMessagesSeen } from '@/shared/lib/seenMessages'
import { buildMezoMessages, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import { deriveNudges, toNudgeMessage } from '@/features/today/logic/needsNudges'
import { markNudgeShown, shownNudges } from '@/features/today/logic/nudgeSeen'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'

export interface MezoThread {
  /** A nap teljes szála, a megjelenítés sorrendjében (feed → demo-briefing előtag → nudge-ok). */
  messages: MezoMessageItem[]
  /** Az olvasottság-vízjel ÓTA érkezett elemek száma — a fejléc badge-e. */
  unread: number
  /** A szálat látottnak jelöli az UTOLSÓ elem id-jével (üres szálon no-op). */
  markSeen: () => void
}

const MezoThreadContext = createContext<MezoThread | null>(null)

export function useMezoThread(): MezoThread {
  const value = useContext(MezoThreadContext)
  if (value === null) throw new Error('useMezoThread: hiányzik a MezoThreadProvider')
  return value
}

export function MezoThreadProvider({ children }: { children: ReactNode }) {
  const scenario = useTodayScenario()
  const feed = useCompanionFeed()
  const tick = useMinuteTick()
  const date = localDateString(tick)
  const needs = useNeeds(tick)
  const { goal: sleepGoal } = useSleepGoal()

  // Életjel küszöb-nudge-ok (mezo-dhzk Task 5) — a levezetés és a megjelenés-napló írása
  // a NapMezoPage-ről költözött ide, változatlan szabállyal: a FRISS nudge-okat egyszer
  // elmentjük, hogy egy ring naponta legfeljebb egyszer szóljon.
  const nudgeEntries = useMemo(
    () => (needs.isPending
      ? []
      : deriveNudges(needs.states, tick, sleepGoal.wakeTime, sleepGoal.bedTime, shownNudges(date))),
    [needs.isPending, needs.states, tick, sleepGoal.wakeTime, sleepGoal.bedTime, date],
  )
  useEffect(() => {
    for (const n of nudgeEntries) if (n.fresh) markNudgeShown(date, n.key, n.at)
  }, [nudgeEntries, date])

  const messages = useMemo(
    () => buildMezoMessages({
      feed,
      demoBriefing: resolveBriefing(scenario.dayState),
      nudges: nudgeEntries.map(toNudgeMessage),
    }),
    [feed, scenario.dayState, nudgeEntries],
  )

  const [seenId, setSeenId] = useState<string | null>(() => lastSeenMessage(date))
  useEffect(() => { setSeenId(lastSeenMessage(date)) }, [date])

  const unread = useMemo(() => {
    if (seenId === null) return messages.length
    const idx = messages.findIndex((m) => m.id === seenId)
    return idx < 0 ? messages.length : messages.length - (idx + 1)
  }, [seenId, messages])

  const markSeen = useCallback(() => {
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : null
    if (lastId === null) return
    markMessagesSeen(date, lastId)
    setSeenId(lastId)
  }, [messages, date])

  const value = useMemo<MezoThread>(() => ({ messages, unread, markSeen }), [messages, unread, markSeen])
  return <MezoThreadContext.Provider value={value}>{children}</MezoThreadContext.Provider>
}
