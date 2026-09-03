// ============================================================
// Mezo · Heti felfedezések — /me/week/felfedezesek (mezo-d20.6.10)
// Source of truth: en-body.html #page-hdisc + discPage(), ×1.18 (330→390px).
//
// The counterpart to /me/week/tanulsagok: that page shows CANDIDATES the reader
// must decide on, this one shows what already landed in the memory by itself.
// The head card says exactly that, and the empty week says the quiet truth
// instead of pretending something is coming.
//
// The digest is a raw week-window read (never gated on the review row existing),
// so it behaves identically in both modes — mock re-dates the seed, real reads
// `GET /api/proactive/weekly-review/{start}/digest`, which contractually never 404s.
// ============================================================
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useWeeklyReview } from '@/data/hooks'
import { resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'
import { WeekDiscoveries, countDiscoveries } from '@/features/me/components/WeekDiscoveries'

export function WeekDiscoveriesPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  const { digest, isPending, isError, refetch } = useWeeklyReview(start)
  const count = countDiscoveries(digest)
  const empty = count === 0

  const head = (
    <PageHead label="‹ Heti" onBack={() => navigate(weekHubPath(start))}>
      <span className="mz-eyebrow wkl-wk">{deriveWeekTitle(start)}</span>
    </PageHead>
  )

  // Real-mode cold-load window: an unresolved digest is NOT a quiet week (§4).
  if (isPending) {
    return (
      <MozaikPage tone="sky">
        {head}
        <PageBody>
          <div className="sk wk-skel" style={{ height: 62 }} aria-label="A felfedezések betöltése…" />
          <div className="sk wk-skel" style={{ height: 84 }} />
          <div className="sk wk-skel" style={{ height: 84 }} />
        </PageBody>
      </MozaikPage>
    )
  }

  if (isError) {
    return (
      <MozaikPage tone="sky">
        {head}
        <PageBody>
          <div className="wkl-ghost">
            <div className="wkl-ghost-tx">Nem sikerült betölteni a heti felfedezéseket.</div>
            <button type="button" className="wkl-btn primary wkl-retry" onClick={refetch}>Újra</button>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="sky">
      {head}
      {/* Hero hand-rolled from the shared .mz-page-hero classes (NapKuldetesekPage
          precedent) so the clay icon keeps the prototype's 50px ×1.18 = 59px. */}
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Heti felfedezések</div>
        <div className="mz-hero-row">
          <ClayIcon name="i-retegek" size={59} />
          {/* Never a fabricated 0 (§4) — a quiet week reads `—`, and the body says why. */}
          <span className="mz-bignum">{empty ? '—' : count}</span>
        </div>
        <div className="mz-hero-sb">{empty ? 'csendes hét volt' : 'új nyom a memóriában'}</div>
      </div>
      <PageBody>
        <EntranceGroup replayKey={start}>
          {empty ? (
            <div className="wkl-ghost rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="wkl-ghost-tx">
                Csendes hét volt — nem született új minta vagy tudás. Ez nem hiba: a memória csak
                akkor nő, ha van mit tanulni.
              </div>
            </div>
          ) : (
            <>
              <div className="wkl-head rise" style={{ '--d': '0ms' } as React.CSSProperties}>
                Amit a Mezo a héten <b>magától</b> tett a memóriába — ezek nem javaslatok, hanem
                megtörtént nyomok. Koppints, és a Mezo tabon nyílnak ki.
              </div>
              <WeekDiscoveries digest={digest} />
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
