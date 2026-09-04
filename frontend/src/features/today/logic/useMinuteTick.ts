// ============================================================
// Mezo · useMinuteTick — a `Date` that re-renders its subscriber once a minute (mezo-dhzk).
// EGYETLEN, MODUL-SZINTŰ óra (mezo-atry): korábban minden hívó saját `setInterval`-t
// indított a saját mountjakor, így két egyidejű fogyasztó (a shell fejléce és a Nap oldal)
// akár 60 s-ot csúszhatott egymáshoz képest — egy napszak-határon MÁS napszakot vezettek
// le ugyanabban a pillanatban. Egy `useSyncExternalStore` fölé tett közös óra megszünteti a
// fáziscsúszást (és mellesleg egyetlen timert tart életben): minden fogyasztó UGYANAZT a
// `Date` példányt kapja, tehát a rá épülő `useMemo`-k is stabilak.
// A needs-ringek folyamatosan apadnak, ezért a 60 s-os kadencia élőn tartja a kijelzett
// pct-t anélkül, hogy egy sűrűbb óra minden ütemére újrarenderelnénk.
// ============================================================
import { useSyncExternalStore } from 'react'

const TICK_MS = 60_000

const minuteOf = (ms: number) => Math.floor(ms / TICK_MS)

let now = new Date()
let timer: ReturnType<typeof setInterval> | null = null
const subscribers = new Set<() => void>()

function notify(): void {
  now = new Date()
  for (const s of subscribers) s()
}

/** Felfüggesztett/throttle-olt fülben a böngésző az intervallumot is lelassítja vagy leállítja,
 *  tehát ébredéskor a gyorsítótárazott `now` ELAVULT — és mivel ilyenkor VAN feliratkozó, a
 *  `getSnapshot` önjavító ága sem lép. A `MezoThreadProvider` ebből képzi a nap kulcsát, így a
 *  legrosszabb esetben az előző nap kulcsa alatt írna (mezo-1d46). Láthatóságváltáskor ezért
 *  utánahúzzuk az órát — de csak ha tényleg másik percben járunk, hogy egy fül-váltogatás ne
 *  rendereltessen feleslegesen. */
function onVisible(): void {
  if (document.visibilityState === 'hidden') return
  if (minuteOf(Date.now()) === minuteOf(now.getTime())) return
  notify()
}

function subscribe(onChange: () => void): () => void {
  subscribers.add(onChange)
  if (timer === null) {
    timer = setInterval(notify, TICK_MS)
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    subscribers.delete(onChange)
    if (subscribers.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

/** `getSnapshot` MUSZÁJ ugyanazt a példányt adja egy renderen belül (különben React ciklusba
 *  esik), ezért a gyorsítótárazott `now` csak akkor frissül, ha épp NINCS feliratkozó (tehát
 *  a timer sem jár) ÉS a fali óra másik percben tart — bármelyik irányban: felfüggesztett tab
 *  után előre, teszt `setSystemTime` után akár vissza. A frissítés idempotens: a második
 *  hívásra a feltétel már nem teljesül, tehát egy renderen belül egyetlen példány jár körbe. */
function getSnapshot(): Date {
  const t = Date.now()
  if (subscribers.size === 0 && minuteOf(t) !== minuteOf(now.getTime())) now = new Date(t)
  return now
}

export function useMinuteTick(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
