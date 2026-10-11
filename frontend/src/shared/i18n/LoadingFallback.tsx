import { useM } from './index'

/** Suspense fallback that re-renders in the current language (a prebuilt element would go stale). */
export function LoadingFallback() {
  return <div className="ad-loading">{useM().frame.loading}</div>
}
