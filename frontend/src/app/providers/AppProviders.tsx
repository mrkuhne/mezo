import { Suspense, type ReactNode } from 'react'
import { ThemeProvider } from '@/app/ThemeProvider'
import { StartupSplash } from '@/app/StartupSplash'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { ClaySprites } from '@/shared/ui/clay'
import { LanguageProvider } from '@/shared/i18n'
import { LoadingFallback } from '@/shared/i18n/LoadingFallback'

/**
 * The app-root providers, in the one order `main.tsx` mounts them (the router goes in as
 * `children`). Everything here has app-root lifetime: a language switch must not remount any of
 * it (mezo-n4wf5.11) -- the remount boundary sits inside the shells, see `LanguageBoundary`.
 * A component of its own so the tests mount exactly what the app mounts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <LanguageProvider>
        <ThemeProvider>
          {/* A clay <symbol> defek EGYETLEN mountja (mezo-ju4j6.3). Korábban minden
              shell-réteg (AppLayout, AdminLayout) külön mountolta őket — az indító-
              képernyő viszont MINDKETTŐ fölött él, és a visszaállított jele agyag-gömb,
              tehát neki is látnia kell a defeket. Egy közös, gyökérszintű példány mindhárom
              fogyasztót kiszolgálja, duplikált id-k nélkül. */}
          <ClaySprites />
          <StartupSplash>
            {/* App-root boundary for the FIRST lazily-loaded chunk (mezo-d5iy.9): AdminLayout
                itself is behind a React.lazy(), so a Suspense mounted only inside it can't
                cover its own load — this one catches the gap between navigating to /admin
                and that chunk (plus every other lazy admin page) arriving. Every non-admin
                route already renders synchronously, so this fallback is otherwise inert. */}
            <Suspense fallback={<LoadingFallback />}>
              {children}
            </Suspense>
          </StartupSplash>
        </ThemeProvider>
      </LanguageProvider>
    </QueryProvider>
  )
}
