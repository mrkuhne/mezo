// A napom · „A napod · te és az app" (Check-in 2.0, mezo-ck2, spec §3.10; Folyadék prototype
// `ndDayBody`, vilagos/nap.js). The evening check-in's last question („Milyen volt a napod
// összességében?") next to the app's day score, as two vials: „az app szerint" and „szerinted",
// each with its band word. When the two bands differ, one row says so. A day not yet scored
// (today, before the dawn close) shows the app's vial honestly empty.
import { Card, Note, Row, Section, Vials } from '@/shared/ui/folyadek'
import { ratingBand, scoreRatingBand } from '@/features/today/logic/checkinItems'

export function NapomDayRatingCard({ rating, score, n }: { rating: number; score: number | null; /** Section number. */ n: number }) {
  const mine = ratingBand(rating)
  const app = score != null ? scoreRatingBand(score) : null
  return (
    <>
      <Section n={n} title="A napod · te és az app" />
      <Card className="nn-dayc" aria-label="A nap értékelése">
        <Vials
          height={132}
          items={[
            {
              label: 'az app szerint', icon: 't-score', color: 'var(--dom)', pct: score ?? 0, mark: '100',
              value: <>{score ?? '–'}<small> / 100</small></>,
              note: app ? `${app} nap` : 'hajnalban zárom',
            },
            {
              label: 'szerinted', icon: 't-mood', color: 'var(--fo-ok)', pct: rating * 10, mark: '10',
              value: <>{rating}<small> / 10</small></>,
              note: `${mine} nap`,
            },
          ]}
        />
        {app && app !== mine && (
          <div className="nn-rows">
            <Row icon="t-day" title={`Az app szerint ${app} nap, szerinted ${mine} volt.`} />
          </div>
        )}
        <Note>
          A {rating}/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.
        </Note>
      </Card>
    </>
  )
}
