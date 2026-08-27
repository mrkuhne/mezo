// Weekly review (mezo-p2tr) — one expandable day row in the week grid (the WeeklyWeightCard
// expand idiom). `dayNote` is Mezo's per-day note (Task 8); `onChat` (Task 10) is the
// "Beszélgess a napról" chat handoff — WeekPage wires it to useChatHandoff().open({kind:'day'}),
// absent (and future days) render neither.
import { ScoreRing } from '@/shared/ui/ScoreRing'
import { Icon } from '@/shared/ui/Icon'
import { huMonthDayDow } from '@/shared/lib/dates'
import type { MeWeekDay } from '@/data/me/meWeek'

const SUBSCORE_LABEL: Record<keyof MeWeekDay['subscores'], string> = {
  sleep: 'Alvás',
  fuel: 'Táplálkozás',
  checkin: 'Check-in',
  activity: 'Aktivitás',
}
const SUBSCORE_ORDER: (keyof MeWeekDay['subscores'])[] = ['sleep', 'fuel', 'checkin', 'activity']

/** '445' minutes -> '7ó 25p'. */
function fmtSleep(min: number): string {
  return `${Math.floor(min / 60)}ó ${min % 60}p`
}

function compactLine(d: MeWeekDay): string {
  return [
    d.kcal != null ? `${Math.round(d.kcal)} kcal` : '—',
    d.sleepMin != null ? fmtSleep(d.sleepMin) : '—',
    d.weightKg != null ? `${d.weightKg.toFixed(1)} kg` : '—',
    `${d.checkinCount}× check-in`,
  ].join(' · ')
}

function subscoreLine(d: MeWeekDay): string {
  return SUBSCORE_ORDER.map((k) => `${SUBSCORE_LABEL[k]} ${d.subscores[k] ?? '—'}`).join(' · ')
}

export function WeekDayCard({ day, expanded, onToggle, future = false, dayNote, onChat }: {
  day: MeWeekDay
  expanded: boolean
  onToggle: () => void
  /** Current-week day later than today — renders dimmed, no expand (nothing has happened yet). */
  future?: boolean
  dayNote?: string | null
  onChat?: () => void
}) {
  const canExpand = !future
  return (
    <div
      data-testid="week-day-card"
      style={{
        background: 'var(--surface)',
        borderRadius: 20,
        boxShadow: 'var(--np-shadow-row)',
        padding: 14,
        marginBottom: 10,
        opacity: future ? 0.45 : 1,
      }}
    >
      <button
        onClick={canExpand ? onToggle : undefined}
        disabled={!canExpand}
        aria-expanded={expanded}
        className="row"
        style={{
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: canExpand ? 'pointer' : 'default',
        }}
      >
        <span className="row" style={{ gap: 10, alignItems: 'center' }}>
          {day.score != null ? (
            <ScoreRing pct={day.score / 100} size={32} stroke={3} color="var(--dv-lav)" label={String(day.score)} />
          ) : (
            <span style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--text-tertiary)',
            }}>—</span>
          )}
          <span className="col" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{huMonthDayDow(day.date)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{compactLine(day)}</span>
          </span>
        </span>
        {canExpand && <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />}
      </button>

      {expanded && canExpand && (
        <div className="col gap-sm" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Makrók</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {`P ${day.proteinG ?? '—'}${day.proteinTargetG != null ? ` / ${day.proteinTargetG}` : ''} g · C ${day.carbsG ?? '—'} g · F ${day.fatG ?? '—'} g`}
            </span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Alvás</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {day.sleepMin != null
                ? `${fmtSleep(day.sleepMin)}${day.sleepQuality != null ? ` · minőség ${day.sleepQuality}/10` : ''}`
                : '—'}
            </span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Edzés</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{`${day.workoutCount}×`}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>XP</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{day.xp ?? '—'}</span>
          </div>
          <div style={{ padding: '8px 10px', background: 'var(--warm)', borderRadius: 12, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{subscoreLine(day)}</span>
          </div>
          {dayNote != null && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>{dayNote}</p>
          )}
          {onChat != null && (
            <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={onChat}>
              Beszélgess a napról <Icon name="chevron-right" size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
