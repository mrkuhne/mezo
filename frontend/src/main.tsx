import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { StartupSplash } from '@/app/StartupSplash'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { routes } from '@/app/router'
import { ClaySprites } from '@/shared/ui/clay'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import '@/index.css'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* App-level boundary: catches provider/shell crashes the tab-level one cannot. */}
    <ErrorBoundary
      fallback={() => (
        // Inline on purpose (mezo-me75u.10): this renders when the stylesheet itself may be the
        // casualty. The dark lock's black ground + ink, one faint glass-ish cell, a lit pill.
        <div role="alert" style={{
          minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
          background: '#000', color: '#F5EFE6', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            width: '100%', maxWidth: 320, textAlign: 'center', padding: '22px 18px', borderRadius: 22,
            background: 'linear-gradient(160deg, rgba(52,46,41,.72), rgba(30,27,24,.60))',
            boxShadow: 'inset 0 0 0 1px rgba(245,239,230,.10), 0 0 26px -6px rgba(171,159,210,.35)',
          }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Valami elromlott.</p>
            <button type="button" onClick={() => window.location.reload()} style={{
              marginTop: 16, padding: '11px 22px', border: 0, borderRadius: 999, cursor: 'pointer',
              font: 'inherit', fontSize: 14, fontWeight: 700, color: '#191614', background: '#AB9FD2',
              boxShadow: '0 0 14px rgba(171,159,210,.55)',
            }}>
              Újratöltés
            </button>
          </div>
        </div>
      )}
    >
      <QueryProvider>
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
            <Suspense fallback={<div className="ad-loading">Betöltés…</div>}>
              <RouterProvider router={router} />
            </Suspense>
          </StartupSplash>
        </ThemeProvider>
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
)
