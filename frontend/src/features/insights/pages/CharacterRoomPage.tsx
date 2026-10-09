import { Link, useNavigate, useParams } from 'react-router-dom'
import { confidenceWord } from '@/data/character/characterApi'
import { useCharacterOverview, useMaturityHistory } from '@/data/hooks'
import { RoomCaseCard } from '@/features/insights/components/feed/RoomCaseCard'
import { useTeamFeed } from '@/features/insights/components/feed/useTeamFeed'
import { TEAM } from '@/features/insights/logic/team'
import {
  ROOM_COPY, archivedPatternCount, dimensionsFor, growthPoints, isRoomId, maturityDropNote, roomCases, roomClaims,
  roomMaturity, roomMaturitySeries, type RoomId,
} from '@/features/insights/logic/teamRooms'
import { renderInline } from '@/shared/lib/markdown'
import { Boop, Icon3D } from '@/shared/ui/clay'
import { useFrameBack, useHasTitleBar } from '@/shared/ui/folyadek'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R
const CASES_MAX = 5
const CLAIMS_MAX = 3

function BackHead({ small, title }: { small: string; title: string }) {
  // Folyadék frame (mezo-n4wf5.1): the shell's title bar draws the back control and runs this
  // handler; the page keeps its own link only where no title bar is mounted.
  const navigate = useNavigate()
  useFrameBack(() => navigate('/mezo/csapat'))
  const shellHasBack = useHasTitleBar()
  return (
    <div className="tf-dhead">
      {!shellHasBack && <Link to="/mezo/csapat" className="glass tf-back" aria-label="Vissza a csapathoz">‹</Link>}
      <span className="tf-dtitle"><small>{small}</small><strong>{title}</strong></span>
    </div>
  )
}

const LINE_MIN_POINTS = 4
const EARLY_TEXT = 'Most kezdtem el hétről hétre feljegyezni, mennyire ismerlek'

type Pt = [number, number]
const pathOf = (seg: Pt[]) => seg.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/**
 * Így érik a képe rólad (mezo-a9bo7.11): a szoba heti érettsége a prototípus normált görbéjével.
 * 4 pont alatt különálló pöttyök + őszinte szöveg; onnan vonal, ami a hiányzó hétnél megszakad
 * (sosem hidal át). Az utolsó pont az élő hét — ugyanaz a szám, mint a gyűrűn.
 */
export function MaturityWell({ series, note }: { series: (number | null)[]; note: string | null }) {
  const count = series.filter(v => v !== null).length
  if (count === 0) {
    return <p className="tf-note">{EARLY_TEXT} — jövő héttől itt látod.</p>
  }
  const pts = growthPoints(series)
  const segments: Pt[][] = []
  let run: Pt[] = []
  for (const p of pts) {
    if (p) run.push(p)
    else if (run.length) { segments.push(run); run = [] }
  }
  if (run.length) segments.push(run)
  let lastIdx = pts.length - 1
  while (!pts[lastIdx]) lastIdx--
  const [lx, ly] = pts[lastIdx]!
  const drawLine = count >= LINE_MIN_POINTS
  // Pötty ott, ahol nincs vonal: 4 pont alatt mind, onnan csak a magányos (két hiány közé eső) hét.
  const dots = drawLine ? segments.filter(seg => seg.length === 1).map(seg => seg[0]) : pts.filter((p): p is Pt => p !== null)
  return (
    <>
      <div className="tf-matwell" data-testid="room-growth" data-state={drawLine ? 'line' : 'dots'}>
        <svg viewBox="0 0 330 60" className="tf-chart" aria-hidden="true">
          <path className="tf-grid" d="M14 50 H316" />
          {drawLine && segments.filter(seg => seg.length > 1).map(seg => (
            <g key={seg[0][0]}>
              <path className="tf-marea" d={`${pathOf(seg)} L${seg[seg.length - 1][0].toFixed(1)},50 L${seg[0][0].toFixed(1)},50 Z`} />
              <path className="tf-l1 tf-draw" pathLength={100} d={pathOf(seg)} />
            </g>
          ))}
          {dots.filter(p => p !== pts[lastIdx]).map(p => (
            <circle key={p[0]} className="tf-dot" cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3" />
          ))}
          <circle className="tf-pt" cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="4.5" />
        </svg>
        <span className="tf-matnow">{series[lastIdx]}%</span>
        <span className="tf-matcap"><em>8 hete</em><em>e hét</em></span>
      </div>
      {!drawLine && <p className="tf-note">{EARLY_TEXT} — a 4. héttől vonal köti össze a pontokat.</p>}
      {note && <p className="tf-note tf-end" data-testid="room-growth-note">{note}</p>}
    </>
  )
}

/** A „+N% · 3 hét” címke: csak ha az e heti és a 3 héttel korábbi pont is megvan. */
function threeWeekHint(series: (number | null)[]): string | null {
  const now = series[series.length - 1], then = series[series.length - 4]
  if (now == null || then == null) return null
  const d = now - then
  return `${d >= 0 ? '+' : ''}${d}% · 3 hét`
}

function Room({ id }: { id: RoomId }) {
  // A szoba a TELJES rekordkészletből él (`rooms`), nem a falból: ami az esti kiadásba nem került
  // be, az itt marad (spec 2026-09-24 §2, mezo-a9bo7.13).
  const { rooms, today, loading, patterns, pairs } = useTeamFeed()
  const { overview, isLoading } = useCharacterOverview()
  const { history, isLoading: historyLoading } = useMaturityHistory()
  if (loading || isLoading || historyLoading) return <ScreenSkeleton />

  const who = TEAM[id]
  const copy = ROOM_COPY[id]
  const dims = dimensionsFor(id, overview?.dimensions ?? [])
  const maturity = roomMaturity(dims)
  const claims = roomClaims(dims)
  const cases = roomCases(rooms.days, id)
  const archived = archivedPatternCount(id, patterns, pairs)
  const series = roomMaturitySeries(history, id)
  const hint = threeWeekHint(series)
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

      <div className="tf-sec"><h2>Így érik a képe rólad</h2>{hint && <span className="tf-hint">{hint}</span>}</div>
      <MaturityWell series={series} note={maturityDropNote(history, id)} />

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
