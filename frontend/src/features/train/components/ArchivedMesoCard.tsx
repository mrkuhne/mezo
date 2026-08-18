// ============================================================
// Mezo · ArchivedMesoCard — dimmed (opacity 0.7) card for a finished
// mesocycle: Archív + end date eyebrow, Display title, summary line.
// The body opens the run's FROZEN report (mezo-meyc.2 — a closed run has no
// builder); the footer carries two actions on the closed block — „Újrafuttatás"
// (mezo-meyc.1) reruns it (the parent resolves its ORIGINATING template,
// materializing one for a legacy run, and opens MesoStartSheet on it) and
// „Sablonná" (mezo-tlwa) forks its plan into a brand-new template.
//
// Two additions in mezo-meyc.4:
//  · a footer chip stating whether the run HAS a frozen report („riport") or not
//    („nincs riport") — a legacy closed run may carry none, and finding that out only
//    after tapping through is a dead end. It is deliberately a plain <span>, not a
//    button: the card body already goes to the report, and a nested button would both
//    be unnecessary and fight the selection mode below. It is a plain state stamp, not an
//    arrow-suffixed link — the whole card body (not this chip) is what opens the report.
//  · `selectMode` — the library's „Összevetés" mode, where a tap SELECTS the run for the
//    compare view instead of navigating. The body then carries `aria-pressed` and the
//    rerun action steps aside, so the whole card reads as one toggle.
//
// Eyebrow date (fix wave, mezo-meyc.4): shows the run's actual close timestamp
// (`closedAt`, formatted like every other date on this card) when one exists, falling
// back to the plan's `endDate` only for a legacy run closed before `closedAt` existed.
// Ported from prototype mesocycles.jsx ArchivedMesoCard.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import { huMonthDay } from '@/shared/lib/dates'
import type { Mesocycle } from '@/data/types'

interface ArchivedMesoCardProps {
  meso: Mesocycle
  /** Opens the frozen report — or, in `selectMode`, toggles this run's selection. */
  onOpen: () => void
  onRerun: () => void
  /** Forks this run's plan into a NEW template (mezo-tlwa) — see `logic/runToTemplate.ts`. */
  onSaveAsTemplate: () => void
  selectMode?: boolean
  selected?: boolean
}

export function ArchivedMesoCard({ meso, onOpen, onRerun, onSaveAsTemplate, selectMode = false, selected = false }: ArchivedMesoCardProps) {
  return (
    // A plain card, not a <button>: the rerun action is a button of its own and
    // buttons cannot nest.
    <div
      className="card col"
      style={{
        padding: 'var(--sp-4)',
        width: '100%',
        // A selected run comes fully into focus; everything else stays in the archive's dim.
        opacity: selected ? 1 : 0.7,
        border: selected ? '1px solid var(--coral)' : undefined,
        background: selected ? 'color-mix(in srgb, var(--coral) 6%, transparent)' : undefined,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        {...(selectMode ? { 'aria-pressed': selected } : {})}
        className="row"
        style={{ width: '100%', textAlign: 'left', justifyContent: 'space-between' }}
      >
        <div className="col flex-1">
          <span className="eyebrow text-tertiary">
            Archív · {meso.closedAt ? huMonthDay(meso.closedAt.slice(0, 10)) : meso.endDate}
          </span>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, marginTop: 4 }}>{meso.title}</div>
          {meso.summary ? (
            <p className="text-secondary mt-sm" style={{ fontSize: 14, lineHeight: 1.4 }}>
              {meso.summary}
            </p>
          ) : null}
        </div>
        {selectMode ? (
          <span
            className="label-mono"
            style={{ fontSize: 12, color: selected ? 'var(--coral)' : 'var(--text-tertiary)' }}
            aria-hidden="true"
          >
            {selected ? '✓' : '○'}
          </span>
        ) : (
          <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
        )}
      </button>
      <div className="row mt-md" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {meso.hasReport ? (
          <span className="chip">riport</span>
        ) : (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            nincs riport
          </span>
        )}
        {/* While selecting, the only meaningful tap on this card is the selection itself —
            BOTH actions step aside (mezo-tlwa keeps the mezo-meyc.4 rule for the new one). */}
        {!selectMode && (
          <div className="row gap-xs">
            <button type="button" className="chip tapchip" onClick={onSaveAsTemplate}>
              <Icon name="bookmark" size={10} /> Sablonná
            </button>
            <button type="button" className="chip tapchip" onClick={onRerun}>
              <Icon name="sparkle" size={10} /> Újrafuttatás
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
