import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { routes } from '@/app/router'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import '@/index.css'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* App-level boundary: catches provider/shell crashes the tab-level one cannot. */}
    <ErrorBoundary
      fallback={() => (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-primary, #ECECF1)' }} role="alert">
          <p style={{ fontSize: 14, fontWeight: 600 }}>Valami elromlott.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ textDecoration: 'underline' }}>
              Újratöltés
            </button>
          </p>
        </div>
      )}
    >
      <QueryProvider>
        <ThemeProvider>
          {/* App-root boundary for the FIRST lazily-loaded chunk (mezo-d5iy.9): AdminLayout
              itself is behind a React.lazy(), so a Suspense mounted only inside it can't
              cover its own load — this one catches the gap between navigating to /admin
              and that chunk (plus every other lazy admin page) arriving. Every non-admin
              route already renders synchronously, so this fallback is otherwise inert. */}
          <Suspense fallback={<div className="ad-loading">Betöltés…</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </ThemeProvider>
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
)
