import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { routes } from '@/app/router'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { installAutoGrow } from '@/shared/lib/autoGrow'
import { m } from '@/shared/i18n'
import '@/index.css'

const router = createBrowserRouter(routes)

// Every textarea grows with its text instead of trapping it in a tiny scroll box.
installAutoGrow()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* App-level boundary: catches provider/shell crashes the tab-level one cannot. */}
    <ErrorBoundary
      fallback={() => (
        // Inline on purpose (mezo-me75u.10): this renders when the stylesheet itself may be the
        // casualty. The Folyadék light identity by literal (mezo-n4wf5.1): the page ground
        // #EEF5F9, ink #0A2A3C (secondary #4E6B7A for the cell's hairline), one white cell, and
        // the action pill in the Nap blue #1877F2.
        <div role="alert" style={{
          minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
          background: '#EEF5F9', color: '#0A2A3C', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            width: '100%', maxWidth: 320, textAlign: 'center', padding: '22px 18px', borderRadius: 22,
            background: '#fff',
            boxShadow: 'inset 0 0 0 1px rgba(78,107,122,.18), 0 18px 30px -22px rgba(10,42,60,.45)',
          }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{m().frame.crash.title}</p>
            <button type="button" onClick={() => window.location.reload()} style={{
              marginTop: 16, padding: '11px 22px', border: 0, borderRadius: 999, cursor: 'pointer',
              font: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', background: '#1877F2',
              boxShadow: '0 10px 18px -10px rgba(24,119,242,.7)',
            }}>
              {m().frame.crash.reload}
            </button>
          </div>
        </div>
      )}
    >
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
