import { Component, type ReactNode } from 'react'
import { CtaPrimary } from '@/shared/ui/Cta'

// The error leg of the loading/empty/error triad (GhostState + ScreenSkeleton are the other
// two). A render-time throw below this boundary swaps in a GhostState-vocabulary fallback
// instead of blanking the PWA. `resetKey` clears a caught error when it changes (AppLayout
// passes the pathname, so navigating away from a crashed page recovers automatically).

interface Props {
  children: ReactNode
  /** Changing this value clears a caught error (e.g. route pathname). */
  resetKey?: unknown
  /** Custom fallback; `reset` clears the error state. Default: message + retry CTA. */
  fallback?: (reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('ErrorBoundary caught render error', error, info)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  private reset = () => this.setState({ hasError: false })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset)
    return (
      <div className="card" style={{ padding: 18, margin: 16 }} role="alert">
        <div className="col gap-sm" style={{ alignItems: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Valami elromlott ezen a nézeten.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            A hiba részletei a konzolban vannak. Próbáld újra, vagy válts másik fülre.
          </p>
          <CtaPrimary onClick={this.reset}>Újrapróbálom</CtaPrimary>
        </div>
      </div>
    )
  }
}
