// ============================================================
// Mezo · FuelNaploPage — the Fuel hub's Napló tile → its own page
// (Design 2.0 F3.1, mezo-d20.4.1). Prototype: fuel-body.html #page-naplo (p-sky).
//
// SCOPE NOTE: the designed Napló is a WEEK-centric trend page (iterations §6 —
// week-picker, daily kcal bars with the dashed goal line, per-day macro averages,
// weight + AI-average cards with a vs-previous-week delta). That page needs data
// the FE does not have yet: the weekly 7-day series is collapsed to 3 scalars
// (audit gap #28) and there is no stored weekly AI average — both are F6.2 backend
// slices, and the page itself is F3.6. This slice ships the tile's HONEST
// destination on the data that exists today: the day's own AI average, today's
// totals, and the logged meals with their scores. No invented trend, no fake bars.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFuelDay, useFuelWeek } from '@/data/hooks'
import { aiAverage } from '@/features/fuel/logic/keretHero'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { huInt } from '@/shared/lib/huNum'

/** HH:mm off a logged meal's real instant. */
const hhmm = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function FuelNaploPage() {
  const navigate = useNavigate()
  const { fuel } = useFuelDay()
  const { weeklyStats } = useFuelWeek()

  const scores = fuel.meals.map(m => (m.score != null ? Math.round(m.score * 100) : null))
  const avg = aiAverage(scores)

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel" />
      {/* Honest hero: nothing scored today → an em dash, never a fabricated 0 pont. */}
      <PageHero icon="i-naplo" name="Napló" big={avg != null ? avg : '—'} sub="AI-átlag · ma" />
      <PageBody principle="A napló a mai valóságot mutatja — a heti trend akkor kerül ide, amikor a hét adatai tárolva lesznek.">
        <EntranceGroup>
          <StatStrip className="rise">
            <StatCell value={huInt(fuel.consumed.kcal)} label="kcal ma" />
            <StatCell value={`${Math.round(fuel.consumed.p)} g`} label="fehérje" />
            <StatCell value={fuel.meals.length} label="étkezés" />
            <StatCell value={`${weeklyStats.proteinHitDays}/7`} label="protein-nap" />
          </StatStrip>

          {/* Honest empty: a day with no logged meal shows nothing to browse and says so. */}
          {fuel.meals.length === 0 ? (
            <p className="fh-naplo-empty rise" style={{ '--d': '60ms' } as React.CSSProperties}>
              Ma még nincs logolt étkezés.
            </p>
          ) : (
            fuel.meals.map((m, i) => {
              const pctScore = m.score != null ? Math.round(m.score * 100) : null
              return (
                <div key={m.id} className="fh-naplorow rise" style={{ '--d': `${60 + i * 50}ms` } as React.CSSProperties}>
                  <div className="fh-naplorow-t">{mealDisplayName(m) ?? m.slot}</div>
                  <div className="fh-naplorow-x">
                    {hhmm(m.loggedAt)} · {huInt(m.kcal)} kcal · {Math.round(m.p)} g P
                  </div>
                  <span className={`fh-scorech${pctScore == null ? ' is-pend' : pctScore < 90 ? ' is-mid' : ''}`}>
                    {pctScore == null ? '✨ folyamatban' : `✨ ${pctScore} p`}
                  </span>
                </div>
              )
            })
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
