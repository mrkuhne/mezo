// ============================================================
// Mezo · Karakter — GeptermPage (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-gepterem` (`gepLede`,
// `gepTiles`) — the geek-transparency hub: hero (the last run's plain-language line) + a
// 4-tile mosaic (Futások / Adatforrások / AI-napló / Detektorok).
//
// Binding ruling (task-4 brief): Adatforrások and Detektorok navigate to routes Task 5
// registers (mezo-1gim.14) — they render here now (their content already exists in the
// prototype) but stay inert until that route lands. This is the brief's own explicit call,
// not an oversight — a link into a still-unregistered route would 404 for no reason.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { Mosaic, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { useCharacterRuns } from '@/data/hooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { addDays } from '@/shared/lib/dates'
import { lastRunLine } from '@/features/character/runLabels'

const PRINCIPLE = 'Minden Karakter-hívás mentve — feature=character, lépésenként (observe / '
  + 'propose / skeptic / integrate / portrait). Semmi nem tűnik el.'

export function GeptermPage() {
  const navigate = useNavigate()
  const weekStart = mondayIso()
  const weekEnd = addDays(weekStart, 6)
  const { runs, isLoading } = useCharacterRuns(weekStart, weekEnd)

  if (isLoading) return null

  // Runs arrive day-desc (Task 2 contract) — [0] is the most recent.
  const lastRun = runs[0]
  const weekObsCount = runs.reduce((sum, r) => sum + r.observationCount, 0)

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <PageHero icon="i-retegek" iconSize={34} name="Gépterem" sub="mi táplálja a dossziét — nyíltan">
        {lastRun != null && <p className="kr-runlede">{lastRunLine(lastRun)}</p>}
      </PageHero>
      <PageBody principle={PRINCIPLE}>
        <Mosaic className="kr-geptiles">
          <Tile
            icon="i-idozito"
            eyebrow="Futások"
            delayMs={60}
            line={`e héten ${runs.length} futás · ${weekObsCount} megfigyelés`}
            onClick={() => navigate('/me/karakter/gepterem/futasok')}
          />
          <Tile
            icon="i-retegek"
            eyebrow="Adatforrások"
            delayMs={100}
            line="a teljes tervezett korpusz"
          />
          <Tile
            icon="i-tudas"
            eyebrow="AI-napló"
            delayMs={140}
            line="minden hívás tárolva"
            onClick={() => navigate('/me/ai-usage')}
          />
          <Tile
            icon="i-minta"
            eyebrow="Detektorok"
            delayMs={180}
            line="az aktív katalógus"
          />
        </Mosaic>
      </PageBody>
    </div>
  )
}

// A small local tile (not the shared Mozaik `Tile`, whose `wash` union has no graphite/
// technical tone) — mirrors the prototype's `.dimtile.t-gepterem` recipe: kr-prefixed like
// this feature's other CSS, buttonized only when it actually navigates (Adatforrások/
// Detektorok stay plain `div`s until Task 5 wires their routes — an inert tile shouldn't
// pretend to be a button).
function Tile({ icon, eyebrow, line, delayMs, onClick }: {
  icon: ClayIconName
  eyebrow: string
  line: string
  delayMs: number
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="kr-geptile-hd">
        <ClayIcon name={icon} size={17} />
        <span className="kr-geptile-eyebrow">{eyebrow}</span>
      </div>
      <div className="kr-geptile-line">{line}</div>
    </>
  )
  const style = { '--d': `${delayMs}ms` } as CSSProperties
  if (onClick) {
    return (
      <button type="button" className="kr-geptile rise" style={style} onClick={onClick} aria-label={eyebrow}>
        {content}
      </button>
    )
  }
  return (
    <div className="kr-geptile rise" style={style} aria-label={eyebrow}>
      {content}
    </div>
  )
}
