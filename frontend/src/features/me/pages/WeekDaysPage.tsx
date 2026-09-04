// ============================================================
// Mezo · WeekDaysPage — `/me/week/napok` (mezo-d20.6.10)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html `#page-hdays`
// + `daysPage()` / `dayCard()`, ×1.18 (330 → 390px frame). Handoff §3.3.
//
// The Heti hub's „A hét napjai" tile → its own page: three mini-cells
// (legjobb nap · leggyengébb · tanulom), a 2-column day mosaic washed by
// each day's own score band, then the sub-score legend and the footnote
// that spells out what „tanulom" means.
//
// The tiles do NOT expand in place (4th design round): a tap deep-links to
// `/me/week/napok/:date`, which is what finally makes a single day
// addressable (audit gap §8.3/6 — a push notification can point at one).
// ============================================================
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, MCells } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { localDateString } from '@/shared/lib/dates'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useMeWeek, useWeeklyReview } from '@/data/hooks'
import { resolveWeekStart } from '@/features/me/logic/weekNav'
import { DAY_COPY, DAY_DIMENSIONS, dayNoteFor, huDowShort, summariseDays } from '@/features/me/logic/weekDay'
import { WeekDayTile } from '@/features/me/components/week/WeekDayTile'
import { WeekPageSkeleton, WeekPageError } from '@/features/me/components/week/WeekLoadStates'

const LEGEND = DAY_DIMENSIONS

export function WeekDaysPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  const { week, isPending, isError, refetch } = useMeWeek(start)
  const { review } = useWeeklyReview(start)
  const today = localDateString()

  const days = week?.days ?? []
  const { measured, best, worst, learning } = summariseDays(days, today)
  const title = deriveWeekTitle(start)

  const openDay = (dateIso: string) => navigate(`/me/week/napok/${dateIso}?start=${start}`)

  return (
    <MozaikPage tone="sage" className="wkd-page">
      <PageHead label="‹ Heti" onBack={() => navigate(`/me/week?start=${start}`)}>
        <span className="mz-eyebrow wkd-headtitle">{title}</span>
      </PageHead>
      <div className="mz-page-hero">
        <div className="mz-hero-nm">A hét napjai</div>
        <div className="mz-hero-row">
          <ClayIcon name="i-nap" size={59} />
          <span className="mz-bignum">
            {week ? measured : '—'}<span className="wkd-bigunit"> / 7</span>
          </span>
        </div>
        <div className="mz-hero-sb">mért nap · koppints egy csempére</div>
      </div>
      <PageBody>
        {isError ? (
          <WeekPageError onRetry={refetch} />
        ) : week == null ? (
          <WeekPageSkeleton pending={isPending} />
        ) : (
          <EntranceGroup replayKey={start}>
            <MCells
              className="rise wkd-cells"
              cells={[
                { label: 'legjobb nap', tone: 'sage', value: best?.score != null ? `${huDowShort(best.date)} ${best.score}` : '—' },
                { label: 'leggyengébb', tone: 'amber', value: worst?.score != null ? `${huDowShort(worst.date)} ${worst.score}` : '—' },
                { label: 'tanulom', tone: 'lav', value: learning > 0 ? learning : '—' },
              ]}
            />
            <div className="wkd-grid rise" style={{ '--d': '40ms' } as React.CSSProperties}>
              {days.map((d, i) => (
                <WeekDayTile
                  key={d.date}
                  day={d}
                  todayIso={today}
                  hasNote={dayNoteFor(review, d.date) != null}
                  delayMs={i * 35}
                  onOpen={() => openDay(d.date)}
                />
              ))}
            </div>
            <div className="wkd-legend rise" style={{ '--d': `${60 + days.length * 35}ms` } as React.CSSProperties}>
              {LEGEND.map((l) => (
                <span key={l.key}><i className={l.barClass} />{l.label}</span>
              ))}
            </div>
            <p className="wkd-foot rise" style={{ '--d': `${90 + days.length * 35}ms` } as React.CSSProperties}>
              {DAY_COPY.footnote}
            </p>
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}
