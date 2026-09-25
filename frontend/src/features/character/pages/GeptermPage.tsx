// ============================================================
// Mezo · Karakter — GeptermPage (mezo-1gim.14, Task 4; üveg re-dress U9, mezo-me75u.9)
// Source: docs/design_2.0/prototypes/src/uveg-mezo-teljes-u9.js `gepterem()` — the csapatfal's
// D5 „dev-ajtó”: a modest slate page, not a loud one. Head (Dev-ajtó · Gépterem) → one lede line
// (the hub's sub + the last run's plain-language line) → a dashed intro → the 7 destinations as
// slate glass `tf-case` rows with a 3D icon → the principle footer.
//
// Task 5 (mezo-1gim.14): Adatforrások and Detektorok navigate to their real routes —
// AdatforrasokPage/DetektorokPage.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/features/insights/boop-world.css'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { useCharacterRuns } from '@/data/hooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { addDays } from '@/shared/lib/dates'
import { lastRunLine } from '@/features/character/runLabels'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'
import { GepteremHead } from '@/features/character/components/GepteremHead'

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
  // M7 (final review): observationCount is only honestly a "megfigyelés" count for NIGHTLY and
  // WEEKLY rows — MONTHLY's counts re-evaluated ÁLLÍTÁSOK (active claims) and BOOTSTRAP's counts
  // kezdő állítások (see runLabels.ts's runHeroLede/runRowSubline, same ruling). Summing across
  // ALL kinds under the "megfigyelés" label would silently fold claim counts into an observation
  // total; restrict the sum to the two kinds whose count actually IS an observation count.
  const weekObsCount = runs
    .filter((r) => r.kind === 'NIGHTLY' || r.kind === 'WEEKLY')
    .reduce((sum, r) => sum + r.observationCount, 0)
  const lastLine = lastRunLine(lastRun)

  return (
    <div className="tf-page tf-c-slate gtm-page gtm-hub">
      <GepteremHead small="Dev-ajtó · a motorháztető alatt" title="Gépterem" onBack={() => navigate('/mezo/csapat')} />
      <p className="gtm-lede">
        Boop működése · források, memória és futások
        {lastLine != null && <>. Legutóbb: <b className="gtm-last">{lastLine}</b>.</>}
      </p>
      <div className="tf-dash gtm-intro">
        <Icon3D name="t-info" size={26} />
        <span>
          Ez nem a fal része — ide akkor jössz, ha a <strong>gépezetre</strong> vagy kíváncsi.
          Minden, amit a csapat mond, innen ellenőrizhető.
        </span>
      </div>
      <div className="tf-rows gtm-doors">
        <Door icon="t-history" title="Futások" index={1}
          line={`e héten ${runs.length} futás · ${weekObsCount} megfigyelés`}
          onClick={() => navigate('/mezo/karakter/gepterem/futasok')} />
        <Door icon="t-link" title="Adatforrások" index={2} line="a teljes tervezett korpusz"
          onClick={() => navigate('/mezo/karakter/gepterem/adatforrasok')} />
        <Door icon="t-journal" title="AI-napló" index={3} line="minden hívás tárolva"
          onClick={() => navigate('/admin/cost')} />
        <Door icon="t-radar" title="Detektorok" index={4} line="az aktív katalógus"
          onClick={() => navigate('/mezo/karakter/gepterem/detektorok')} />
        <Door icon="t-layers" title="Memória" index={5} line="rétegek, eredet és költségek"
          onClick={() => navigate('/mezo/memoria')} />
        <Door icon="t-eye" title="Megfigyelők" index={6} line="a coaching javaslatainak háttere"
          onClick={() => navigate('/mezo/coaching/megfigyelo')} />
        {/* The old 12-tile menu lives here as a dev-menu (csapat-üzenőfal spec §2.4). */}
        <Door icon="t-grid" title="Összes funkció" index={7} line="a régi teljes menü — minden eszköz egy helyen"
          onClick={() => navigate(ALL_FEATURES_ROUTE)} />
      </div>
      <p className="gtm-principle">{PRINCIPLE}</p>
    </div>
  )
}

// One destination: a slate glass `tf-case` row. Fix round 1 (a11y) still holds — no
// `aria-label`, so the button's accessible name is its own text (title + the live line), the
// same datum sighted readers get; the chevron is decorative.
function Door({ icon, title, line, index, onClick }: {
  icon: Icon3DName
  title: string
  line: string
  index: number
  onClick: () => void
}) {
  return (
    <button type="button" className="glass tf-case tf-c-slate gtm-door rise"
      style={{ '--d': `${index * 40}ms` } as CSSProperties} onClick={onClick}>
      <span className="tf-cmain">
        <Icon3D name={icon} size={36} />
        <span className="tf-ctxt">
          <span className="tf-ctitle">{title}</span>
          <span className="tf-csub">{line}</span>
        </span>
        <span className="tf-chev" aria-hidden="true">›</span>
      </span>
    </button>
  )
}
