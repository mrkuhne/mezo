import { useMemo } from 'react'
import { useFeedback, useWeekly } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { GrowthWeekCard } from '@/features/insights/components/GrowthWeekCard'
import type { WeeklyTrend } from '@/data/types'

function trendArrow(t: WeeklyTrend): string {
  return t === 'up' ? '↗' : t === 'down' ? '↘' : '→'
}

function trendColor(t: WeeklyTrend): string {
  return t === 'up' ? 'var(--success)' : t === 'down' ? 'var(--error)' : 'var(--text-tertiary)'
}

export function WeeklyPage() {
  const { weekly, deltaLabel, weeklySuggestion, weeklySuggestionId, growthWeek, mode } = useWeekly()
  // ONE feedback read for the page (mezo-b3pp.15) — the card is the only votable artifact here,
  // and there is nothing to vote on while the honest placeholder is up (no id ⇒ no request).
  const feedbackIds = useMemo(
    () => (weeklySuggestionId ? [weeklySuggestionId] : []),
    [weeklySuggestionId],
  )
  const feedback = useFeedback('weekly_suggestion', feedbackIds)

  return (
    <div className="col gap-md">
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{weekly.title}</span>
            {weekly.score != null ? (
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 1, marginTop: 8 }}>
                {weekly.score}
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 6 }}>/100</span>
              </div>
            ) : (
              // The patterns-precedent honest null-state: no data yet, never a fabricated score.
              <div className="col" style={{ marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 34, fontWeight: 600, lineHeight: 1, color: 'var(--text-tertiary)' }}>
                  tanulom
                </span>
                <span className="text-tertiary" style={{ fontSize: 11, marginTop: 6 }}>
                  még gyűjtöm az adatokat a heti értékeléshez
                </span>
              </div>
            )}
          </div>
          {weekly.delta != null && (
            <div className="col" style={{ alignItems: 'flex-end' }}>
              <span className="label-mono" style={{ color: weekly.delta >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {weekly.delta > 0 ? '+' : ''}{weekly.delta}
              </span>
              <span className="text-tertiary" style={{ fontSize: 10, marginTop: 4 }}>{deltaLabel}</span>
            </div>
          )}
        </div>

        <div className="col gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          {weekly.items.map((it, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="text-secondary" style={{ fontSize: 13 }}>{it.label}</span>
              <div className="row gap-sm">
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{it.value}</span>
                <span style={{ fontSize: 12, color: trendColor(it.trend) }}>{trendArrow(it.trend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · heti tervjavaslat</span>
        {weeklySuggestion != null ? (
          <>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{weeklySuggestion}</p>
            {mode === 'mock' ? (
              <div className="row gap-sm mt-md">
                <button type="button" className="cta-ghost" style={{ fontSize: 10 }}>Elfogad</button>
                <button type="button" className="chip" style={{ fontSize: 9 }}>Hangoljuk</button>
              </div>
            ) : null}
            {/* Both modes — the suggestion is an AI artifact wherever it comes from. Keyed by the
                artifactId: FeedbackChips seeds its reason-row state once, on mount, so React must
                never carry one week's instance over to the next week's suggestion. */}
            {weeklySuggestionId != null && (
              <div className="mt-md">
                <FeedbackChips
                  key={weeklySuggestionId}
                  value={feedback.get(weeklySuggestionId)}
                  onVote={(verdict, reason) => feedback.vote(weeklySuggestionId, verdict, reason)}
                  label="a heti tervjavaslatról"
                />
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            A társ heti tervjavaslata hamarosan.
          </p>
        )}
      </div>

      <GrowthWeekCard growth={growthWeek} />
    </div>
  )
}
