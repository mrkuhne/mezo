import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { CircadianTheme } from '@/app/CircadianTheme'
import { FloatingReturnLayer } from '@/app/FloatingReturnLayer'
import { PhoneFrame } from '@/app/PhoneFrame'
import { QuickLogFab } from '@/app/QuickLogFab'
import { ScreenContent } from '@/app/ScreenContent'
import { TabBar } from '@/app/TabBar'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { MealCeremonyProvider } from '@/features/fuel/MealCeremonyProvider'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { ArrivalProvider } from '@/shared/ui/mozaik/arrival'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { useTodayScenario, useScheduleSnapshotWriter, useDayEvaluation, normalizeDayEvaluation } from '@/data/hooks'
import { useScreenTracking } from '@/app/useScreenTracking'
import { useMorningMode } from '@/features/today/logic/useMorningMode'
import { localDateString, addDays } from '@/shared/lib/dates'

export function AppLayout() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()
  // A napom's tab dot (mezo-yjzhw.4): morning mode is decided from YESTERDAY's evaluation —
  // if the overnight review scored it and the reader hasn't opened A napom since, the tab
  // carries a dot. AppLayout mounts once per session (see the snapshot-writer comment
  // below), so this is one query for the whole app, not one per page.
  const yesterdayIso = addDays(localDateString(), -1)
  const yesterdayEval = useDayEvaluation(yesterdayIso)
  const morning = useMorningMode(yesterdayEval.data ? normalizeDayEvaluation(yesterdayEval.data) : null)
  // App-open notification-schedule snapshot (N3, bd mezo-h4wp.6.3): AppLayout is the root
  // route element (children of `/`) and, unlike a page under the Outlet, mounts exactly once
  // for the whole app session — nested route changes only swap the Outlet's child, never
  // remount this component. It already sits inside QueryProvider's QueryClientProvider (see
  // main.tsx), so a data hook can be called here directly. Real-mode-only, fire-and-forget,
  // once per mount — see notificationScheduleWriter.ts for the full rationale.
  useScheduleSnapshotWriter()
  // Screen telemetry (mezo-o5cz): mounted here for the same reason as the snapshot writer above —
  // AppLayout is the root route element and mounts exactly once per session, so the hook's
  // route-change effect sees every navigation without re-registering. Reports the matched route
  // PATTERN only, is a hard no-op in mock mode, and swallows every backend failure.
  useScreenTracking()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/nap')
  // Full-screen surfaces where the app chrome is dead weight: the active workout session,
  // the extra-dark night page (its light would defeat the <30 lux point), and the
  // Napzárás ritual flow (mezo-ilsj). No header, no tab bar, no FAB.
  // mezo-88iwa.9 (T8 Task 4): `/train/sport/log` is the same kind of surface — a
  // full-screen picker → form → CEREMONY flow with its own back affordance. Measured at
  // 320px the tab bar plus the coral FAB sat on top of the ceremony's close CTA and its
  // honesty line, exactly the situation `/train/session` is on this list for.
  const hideChrome = ['/train/session', '/train/sport/log', '/me/sleep/night', '/ritual'].includes(location.pathname)
  // mezo-vdf4: the chat's composer owns the thumb zone — the coral FAB overlapped the
  // send disc there. Chat keeps the rest of the chrome (header, tab bar).
  // mezo-bq2t: /fuel/log/uj is the same situation — its sticky save bar owns the thumb zone
  // (measured: the FAB sat right on top of it), and a "quick log" FAB on the logging page
  // itself is redundant anyway. Same deal: header and tab bar stay.
  // mezo-mhum: /nap/gyors IS the picker page (QuickLogSurface variant="page") — the coral
  // FAB would float over its own destination and open the modal sheet duplicate on top of
  // the full-page picker. Same call as /fuel/log/uj above.
  // mezo-7flr: a companion-first `/nap` alsó szövegmezője birtokolja a hüvelykujj-zónát (ugyanaz
  // a helyzet, mint a chat/`/fuel/log/uj` composerénél, mezo-vdf4/bq2t) — a korall FAB rálógna a
  // küldés gombra, ezért itt is elmarad; a gyors-naplózó a navigációból érhető el.
  const inSettings = location.pathname.startsWith('/settings')
  const hideFab = hideChrome || inSettings || ['/mezo/chat', '/fuel/log/uj', '/nap/gyors', '/nap'].includes(location.pathname)
  // A chatnek saját, beszélgetés-specifikus fejléce van (vissza, szálválasztó, új szál,
  // műveletek). A shell-fejléc ugyanitt ugyanazt a Mezo-identitást rajzolta ki még egyszer,
  // ezért ezen az egy route-on csak a chat saját fejléce marad.
  const hideHeader = hideChrome || location.pathname === '/mezo/chat'
  // Visszaöltöztetés (mezo-ju4j6.3): a Titán SÖTÉT hatókör MEGSZŰNT. A `/nap`, a teljes
  // Fuel és a teljes Train domén korábban két rétegben viselte a hideg grafit bőrt: az
  // AppLayout a ház dark témáját KÉNYSZERÍTETTE rajtuk (`useForceTheme('dark')`), a
  // `.titan-dark` osztály pedig a shell burkára tette a prototípus grafit palettáját.
  // Mindkét fél EGYÜTT hal meg — a bőr félig levéve (kényszerített sötét téma, scope
  // nélkül) meleg grafitban landolna, ami nem a visszaállított alapállapot. Innentől
  // minden útvonal a felhasználó SAJÁT témabeállítását követi, világos-elsőként.
  // A `useForceTheme` maga megmarad: a Napzárás rituálé (mezo-tr5v) továbbra is használja.
  // A képernyő-részfa egyszer, hogy a fenti kapu ne duplikálja a JSX-et (mezo-eekm).
  const screen = (
    <ScreenContent>
      {/* A fejléc a shellé, nem az oldalaké (mezo-atry): egy példány, minden oldalon
          ugyanaz. A scrollerben ÜL, de kitapad (mezo-8az6, position: sticky) — a tartalom
          görög alatta, ő maga a görgetőport tetején marad. */}
      {!hideHeader && <AppHeader />}
      {/* Tab-level boundary: a crashed page degrades to a fallback card; the chrome
          (TabBar) stays usable and navigating away (resetKey) recovers. */}
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </ScreenContent>
  )
  return (
    <ArrivalProvider>
      <CircadianTheme />
      <PhoneFrame anchor={anchor}>
        <ToastProvider>
          {/* A kaja-ünneplés EGY gazdája (mezo-bqwyo): a naplózás négy felületről indulhat, és
              mindegyik bezárja magát a mentés pillanatában — a ceremónia ezért felettük lakik,
              ugyanúgy, ahogy a szintlépés-réteg. A „Részletek" útvonala a shellé. */}
          <MealCeremonyProvider onDetails={(mealId) => navigate(`/fuel/etkezes/${mealId}/ertekeles`)}>
          <LevelUpProvider>
            {/* Mezo-kalauz motor (mezo-gb1s.1): egy példány, route-váltásra dönt, a sheetet ide
                portálja (.phone-screen). A fejléc „?" gombja és a Beállítások ugyanezt a
                contextet hívja. */}
            <TutorialProvider>
              {/* A mezo-szál EGY példánya a fejlécnek és az /nap/uzenetek oldalnak (mezo-atry):
                  a fejléc az Outlet ELŐTTI testvér, tehát a két fogyasztó csak közös
                  ősként osztozhat a szálon — így az olvasatlan-vízjel is közös. */}
              {/* mezo-eekm: a szál-provider a hideChrome kapun BELÜL. A három chrome-mentes
                  útvonalon nincs fejléc és nincs TabBar, tehát a szálnak nincs fogyasztója —
                  a provider ~15 `useNeeds`-olvasása ott tiszta pazarlás volt. A provider
                  EGYÜTTES őse marad a fejlécnek és az Outlet-nek (mezo-atry), csak épp már
                  nem mountol ott, ahol egyik sincs. */}
              {hideChrome ? screen : <MezoThreadProvider>{screen}</MezoThreadProvider>}
            </TutorialProvider>
            {!hideChrome && !inSettings && <TabBar dots={{ '/nap/napom': morning }} />}
            {/* Decision B (mezo-d20.1.1): quick log = floating coral FAB, present on
                every tab, absent on the chrome-free full-screen flows. */}
            {!hideFab && <QuickLogFab />}
            <FloatingReturnLayer />
          </LevelUpProvider>
          </MealCeremonyProvider>
        </ToastProvider>
      </PhoneFrame>
    </ArrivalProvider>
  )
}
