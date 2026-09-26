import { Component, type ReactNode } from 'react'
import { Icon3D } from '@/shared/ui/clay'

// The error leg of the loading/empty/error triad (GhostState + ScreenSkeleton are the other
// two). A render-time throw below this boundary swaps in a GhostState-vocabulary fallback
// instead of blanking the PWA. `resetKey` clears a caught error when it changes (AppLayout
// passes the pathname, so navigating away from a crashed page recovers automatically).
// Skin (üveg U10, mezo-me75u.10, prototype `.errcard`): a coral glass card, the 3D info icon, the
// retry as a lit coral pill — `uveg reteg ablak` block of prototype.css.

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
      <div className="abl-err glass" role="alert">
        <Icon3D name="t-info" size={62} className="abl-err-art" />
        <strong>Valami elromlott ezen a nézeten.</strong>
        <p>A hiba részletei a konzolban vannak. Próbáld újra, vagy válts másik fülre.</p>
        <button type="button" className="abl-pill" onClick={this.reset}>Újrapróbálom</button>
      </div>
    )
  }
}
