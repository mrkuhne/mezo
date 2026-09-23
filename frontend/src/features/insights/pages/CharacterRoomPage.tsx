import { Link, useParams } from 'react-router-dom'
import { confidenceWord } from '@/data/character/characterApi'
import { useCharacterOverview } from '@/data/hooks'
import { RoomCaseCard } from '@/features/insights/components/feed/RoomCaseCard'
import { useTeamFeed } from '@/features/insights/components/feed/useTeamFeed'
import { TEAM } from '@/features/insights/logic/team'
import {
  ROOM_COPY, archivedPatternCount, dimensionsFor, growthPoints, isRoomId, roomCases, roomClaims,
  roomMaturity, weeklyGrowth, type RoomId,
} from '@/features/insights/logic/teamRooms'
import { renderInline } from '@/shared/lib/markdown'
import { Boop, Icon3D } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R
const CASES_MAX = 5
const CLAIMS_MAX = 3

function BackHead({ small, title }: { small: string; title: string }) {
  return (
    <div className="tf-dhead">
      <Link to="/mezo/csapat" className="glass tf-back" aria-label="Vissza a csapathoz">‹</Link>
      <span className="tf-dtitle"><small>{small}</small><strong>{title}</strong></span>
    </div>
  )
}

/** Így gyűlik a tudása: halmozott bejegyzés-szám 8 hétre, a prototípus normált görbéjével. */
function GrowthWell({ series }: { series: number[] }) {
  const total = series[series.length - 1] ?? 0
  if (total < 2) {
    return <p className="tf-note">Még kevés bejegyzése van — a görbe az első hetek után rajzolódik ki.</p>
  }
  const pts = growthPoints(series)
  const line = pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <div className="tf-matwell" data-testid="room-growth">
      <svg viewBox="0 0 330 60" className="tf-chart" aria-hidden="true">
        <path className="tf-grid" d="M14 50 H316" />
        <path className="tf-marea" d={`${line} L${lx.toFixed(1)},50 L14,50 Z`} />
        <path className="tf-l1 tf-draw" pathLength={100} d={line} />
        <circle className="tf-pt" cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="4.5" />
      </svg>
      <span className="tf-matnow">{total}</span>
      <span className="tf-matcap"><em>8 hete</em><em>ma</em></span>
    </div>
  )
}

function Room({ id }: { id: RoomId }) {
  const { feed, today, loading, patterns, pairs } = useTeamFeed()
  const { overview, isLoading } = useCharacterOverview()
  if (loading || isLoading) return <ScreenSkeleton />

  const who = TEAM[id]
  const copy = ROOM_COPY[id]
  const dims = dimensionsFor(id, overview?.dimensions ?? [])
  const maturity = roomMaturity(dims)
  const claims = roomClaims(dims)
  const cases = roomCases(feed.days, id)
  const archived = archivedPatternCount(id, patterns, pairs)
  const series = weeklyGrowth(feed.days, id, today)
  // Egy dimenzió → egyenesen oda; több (pl. Derű: test + lélek) → a dimenziók listája.
  const claimsRoute = dims.length === 1 ? `/mezo/karakter/dimenzio/${dims[0].key}` : '/mezo/karakter/dimenziok'

  return (
    <div className={`tf-page tf-c-${who.accent}`}>
      <BackHead small={who.area} title={who.name} />
      <section className="tf-rhero">
        <Boop domain={who.boop} size={92} alive className="tf-rboop" />
        <h1>{who.name} · {who.area}</h1>
        <p>{copy.quote}</p>
      </section>
      <section className="tf-gauges" aria-label="Számokban">
        <div className="tf-gauge">
          <svg viewBox="0 0 64 64" className="uv-ring" aria-hidden="true">
            <circle className="uv-ring-track" cx="32" cy="32" r={RING_R} />
            {maturity > 0 && (
              <circle className="uv-ring-prog" cx="32" cy="32" r={RING_R}
                strokeDasharray={`${(maturity / 100) * RING_C} ${RING_C}`} />
            )}
          </svg>
          <span className="tf-gauge-value">{maturity > 0 ? `${maturity}%` : '—'}</span>
          <span className="tf-gauge-label">{maturity > 0 ? 'Érettség' : 'Ismerkedik'}</span>
        </div>
        <div className="tf-rnum"><span className="tf-rnum-value">{cases.length}</span><span className="tf-rnum-label">Ügy a falon</span></div>
        <div className="tf-rnum"><span className="tf-rnum-value">{claims.length}</span><span className="tf-rnum-label">Beépült tudás</span></div>
      </section>

      <div className="tf-sec"><h2>Most ezen dolgozik</h2></div>
      {cases.length === 0 ? (
        <p className="tf-note">Most nincs nyitott ügye — ahogy naplózol, itt jelennek meg, és a falon is szól.</p>
      ) : (
        <div className="tf-rows">
          {cases.slice(0, CASES_MAX).map((post, i) => (
            <RoomCaseCard key={post.id} post={post} owner={id} lead={i === 0} today={today} />
          ))}
        </div>
      )}

      <div className="tf-sec"><h2>Így gyűlik a tudása rólad</h2><span className="tf-hint">Bejegyzések · 8 hét</span></div>
      <GrowthWell series={series} />

      <div className="tf-sec">
        <h2>Amit rólad tud</h2>
        {dims.length > 0 && claims.length > 0 && <Link className="tf-hint" to={claimsRoute}>Mind · {claims.length} →</Link>}
      </div>
      <div className="tf-tlist">
        {claims.length === 0 && (
          <span className="tf-trow"><span className="tf-ttx">
            <span className="tf-ttitle">Még nem épült be semmi</span>
            <span className="tf-tsub">csak az kerül ide, amit a csapat közösen elfogad</span>
          </span></span>
        )}
        {claims.slice(0, CLAIMS_MAX).map(c => (
          <span key={c.id} className="tf-trow">
            <span className="tf-st tf-s-sage">{confidenceWord(c.confidence)}</span>
            <span className="tf-ttx">
              <span className="tf-ttitle">{c.text}</span>
              {c.evidence[0] && <span className="tf-tsub">{c.evidence[0].label}</span>}
            </span>
          </span>
        ))}
        {archived > 0 && (
          <Link className="tf-trow" to="/mezo/patterns">
            <Icon3D name="t-history" size={22} />
            <span className="tf-ttx">
              <span className="tf-ttitle">Lezárt ügyei · {archived}</span>
              <span className="tf-tsub">az őszinteség itt is látszik</span>
            </span>
            <span className="tf-chev" aria-hidden="true">›</span>
          </Link>
        )}
      </div>

      <div className="tf-sec"><h2>{who.name} jegyzete</h2></div>
      <div className="glass tf-pnote">
        <Icon3D name="t-score" size={36} />
        <div><small>Kérése hozzád</small><p>{renderInline(copy.ask, { boldOnly: true })}</p></div>
      </div>
    </div>
  )
}

/**
 * Karakter-szoba (spec 2026-09-23 §2.5, mezo-a9bo7.9) — a prototípus szoba-ritmusa: hero →
 * érettség-gyűrű + 2 szám → ügyek (az első üveg, a többi lapos) → tudás-görbe → tudás-lista →
 * jegyzet. Ismeretlen karakterre (vagy a szoba nélküli Szkeptikusra) őszinte üzenet.
 */
export function CharacterRoomPage() {
  const { id } = useParams()
  if (!isRoomId(id)) {
    return (
      <div className="tf-page">
        <BackHead small="A csapat" title="Nincs ilyen szoba" />
        <p className="tf-note">Ilyen csapattagot nem ismerünk. A csapat oldalán mind az öten megtalálhatók.</p>
      </div>
    )
  }
  return <Room key={id} id={id} />
}
