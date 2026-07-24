// ============================================================
// Mezo · ChallengeCard — a single pre-workout micro-experiment the
// companion proposes, restyled as a quest card (mission-briefing redesign,
// mezo-bxpg): coral-bordered, --wash-gym tint, type+exercise header, risk tag
// (swapped for the outcome chip once resolved), a why/glory pitch line,
// confidence + refs + tool transparency, accept/skip actions.
// "a try maga a jutalom" · no FOMO · no penalty if skipped.
// Ported from prototype challenges.jsx.
// ============================================================
import type { Challenge, ChallengeStatus } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { RefTag } from '@/shared/ui/RefTag'
import { ToolChip } from '@/shared/ui/ToolChip'

// A resolved challenge (workout decided) — its accept/skip row is hidden and an
// outcome chip + line replace it. Chips mirror the experiments-tab wording
// (ExperimentsPage.statusLabel) so the two proactive surfaces read alike.
const RESOLVED: ReadonlyArray<ChallengeStatus> = ['hit', 'miss', 'inconclusive']
type OutcomeState = { label: string; color: string }
const OUTCOME: Record<'hit' | 'miss' | 'inconclusive', OutcomeState> = {
  // hit = confirmed (success green); miss = muted/neutral, NO red, no-penalty
  // tone; inconclusive = tertiary "not evaluable" (no logged sets).
  hit: { label: '✓ Megerősítve', color: 'var(--success)' },
  miss: { label: '◯ Nem igazolódott', color: 'var(--text-tertiary)' },
  inconclusive: { label: '◌ Nem értékelhető', color: 'var(--text-tertiary)' },
}

export function ChallengeCard({
  challenge,
  accepted,
  onToggle,
}: {
  challenge: Challenge
  accepted: boolean
  onToggle: () => void
}) {
  const c = challenge
  const resolved = c.status != null && (RESOLVED as ReadonlyArray<string>).includes(c.status)
  const outcome = resolved ? OUTCOME[c.status as 'hit' | 'miss' | 'inconclusive'] : null

  return (
    <div
      className="card"
      style={{ padding: 16, border: '1px solid var(--coral)', background: 'var(--wash-gym)' }}
    >
      {/* Header row: type + exercise name (coral-deep) · risk tag right (tertiary) —
          the outcome chip takes the right slot once the workout is decided. */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral-deep)' }}>
          {c.typeLabel} · {c.exercise}
        </span>
        {outcome ? (
          <span
            className="chip"
            style={{
              fontSize: 9,
              padding: '3px 8px',
              color: outcome.color,
              borderColor: `color-mix(in srgb, ${outcome.color} 40%, transparent)`,
            }}
          >
            {outcome.label}
          </span>
        ) : (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {c.risk === 'low' ? 'alacsony kockázat' : 'közép kockázat'}
          </span>
        )}
      </div>

      {/* Target + confidence */}
      <div className="col mt-sm">
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.15,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
          }}
        >
          {c.target}
        </div>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
          conf {c.confidence == null ? 'tanulom' : `${(c.confidence * 100).toFixed(0)}%`}
        </span>
      </div>

      {/* Why / glory line — the quest pitch, shown until the workout is decided. */}
      {!resolved && (
        <p style={{ fontSize: 12, marginTop: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {c.why} <span style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>· {c.glory}</span>
        </p>
      )}

      {/* Refs */}
      <div className="row gap-xs flex-wrap mt-sm">
        {c.refs.map((r, i) => (
          <RefTag key={i} kind={r.kind} label={r.label} />
        ))}
      </div>

      {/* Tool transparency */}
      <div className="row gap-xs flex-wrap mt-sm">
        {c.tools?.map((t, i) => (
          <ToolChip key={i} {...t} />
        ))}
      </div>

      {/* Outcome line — the workout is decided; the action row is hidden. */}
      {resolved && c.outcome && (
        <p className="mt-md" style={{ fontSize: 12, color: outcome!.color, lineHeight: 1.45 }}>
          {c.outcome}
        </p>
      )}

      {/* Actions — hidden once the challenge is resolved (workout decided). */}
      {!resolved && (
        <div
          className="row gap-sm mt-md"
          style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={accepted}
            className="chip"
            style={{
              flex: 1,
              justifyContent: 'center',
              background: accepted ? 'var(--coral-deep)' : 'var(--coral)',
              borderColor: 'var(--coral)',
              color: 'var(--text-inverse)',
              fontSize: 11,
            }}
          >
            {accepted ? (
              <>
                <Icon name="check" size={11} />
                Elfogadva
              </>
            ) : (
              '⚔ Elfogadom'
            )}
          </button>
          {!accepted && (
            <button type="button" className="chip">
              Passz
            </button>
          )}
        </div>
      )}
    </div>
  )
}
