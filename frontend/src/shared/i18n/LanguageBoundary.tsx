import { Fragment, useLayoutEffect, useState, type ReactNode } from 'react'
import { useLang } from './lang'

/**
 * The remount boundary of a language switch: everything beneath it is unmounted and mounted again
 * when the language changes, so code that reads the catalog with the non-hook `m()` (label maps,
 * logic files, values captured in state) cannot keep stale words. It sits INSIDE each shell
 * (`AppLayout`, `AdminLayout`), just above the routed screens, because things with app-root
 * lifetime must not be reset by a switch. The store itself is aligned with the account by
 * `LanguageProvider` at the app root, which never remounts anything.
 *
 * Reviewed 2026-10-11 (mezo-n4wf5.11) -- who lives where, and why:
 *
 * ABOVE the boundary (survives a switch; re-renders its own words through `useM()` / `useLang()`):
 * - `QueryProvider` / `AuthGate`   -- the query cache and the session; the auth pages use `useM()`.
 * - `LanguageProvider`             -- the account sync; no words.
 * - `ThemeProvider`                -- the theme mode and the force-theme claims; no words.
 * - `ClaySprites`                  -- the one sprite mount; no words.
 * - `StartupSplash`                -- its intro plays on mount (three seconds, the app inert); label via `useM()`.
 * - the router (`RouterProvider`)  -- the URL and history; the Suspense fallback uses `useM()`.
 * - `AppLayout` itself             -- its once-per-session effects (the notification-schedule snapshot write,
 *                                     screen telemetry) must not fire again; it renders no words.
 * - `ArrivalProvider`              -- "has the user navigated yet" lives in a ref; a remount turned the next
 *                                     back navigation into a first arrival. No words.
 * - `CircadianTheme`, `PhoneFrame` -- clocks; `.phone-screen` stays mounted, so a portal target looked up
 *                                     during render is the live node. No words.
 * - `ToastProvider`                -- visible toasts are component state: a remount wiped the save-failed toast
 *                                     of a failed switch. A toast keeps the words it was emitted with; the close
 *                                     label uses `useM()`.
 * - `MealCeremonyProvider`, `LevelUpProvider` -- an open ceremony is state; the meal ceremony also keeps its
 *                                     portal target in state. Their words render only while a ceremony is up.
 * - `TutorialProvider`             -- the once-per-session auto-open guard, an open guide and the first-run
 *                                     welcome are state/refs; a remount could open a guide a second time.
 * - `AdminLayout`'s `ToastProvider`, `ArrivalProvider`, and its owner check (the no-permission toast effect).
 *
 * BELOW the boundary (remounted; safe because nothing they own must survive):
 * - `MezoThreadProvider`           -- the read watermark and the shown-nudge log are in localStorage, re-read on
 *                                     mount; its mount effect only re-writes the same log entries.
 * - `FrameProvider`                -- title/back registered by the mounted page; the page re-registers.
 * - `ScreenContent`                -- remembered scroll offsets (a switch lands at the top, like before).
 * - `TitleBar`, `TopTabs`, the routed page (`Outlet`), `BottomBar`, `QuickLogFab`, `FloatingReturnLayer`,
 *   and the admin rail + page -- the screens themselves; this is what the remount is for.
 *
 * The remount is two-phase: first commit the children as unmounted (`null`), then mount the new
 * tree from a layout effect (no painted blank frame). The new tree's first render therefore runs
 * against a DOM that no longer holds the old tree, exactly like a cold start; code that resolves a
 * portal target during render (`document.querySelector(...)`) can never pick a node of the old,
 * about-to-be-removed tree and land in a detached subtree.
 */
export function LanguageBoundary({ children }: { children: ReactNode }) {
  const lang = useLang()
  const [mounted, setMounted] = useState(lang)
  useLayoutEffect(() => {
    if (mounted !== lang) setMounted(lang)
  }, [mounted, lang])
  if (mounted !== lang) return null
  return <Fragment key={lang}>{children}</Fragment>
}
