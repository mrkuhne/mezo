// ============================================================
// Mezo · ChallengeCard — a single pre-workout micro-experiment the
// companion proposes. Type-colored pill, confidence + risk, big target,
// rationale, refs + tool transparency, accepted-glory banner, accept toggle.
// "a try maga a jutalom" · no FOMO · no penalty if skipped.
// Ported from prototype challenges.jsx.
// ============================================================
import type { Challenge, ChallengeType } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { RefTag } from '@/shared/ui/RefTag'
import { ToolChip } from '@/shared/ui/ToolChip'

const TYPE_COLOR: Record<ChallengeType, string> = {
  PR: 'var(--brand-glow)',
  Depth: 'var(--cat-tendency)',
  Volume: 'var(--info)',
  Tempo: 'var(--cat-preference)',
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
  const typeColor = TYPE_COLOR[c.type] ?? 'var(--brand-primary)'

  return (
    <div
      className="card notch-12"
      style={{
        padding: 16,
        background: accepted
          ? 'linear-gradient(180deg, color-mix(in srgb, var(--brand-glow) 6%, transparent) 0%, var(--surface-1) 100%)'
          : 'var(--surface-1)',
        borderColor: accepted ? 'var(--border-brand)' : 'var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {accepted && (
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle, color-mix(in srgb, ${typeColor} 15%, transparent), transparent 70%)`,
          }}
        />
      )}
      <div style={{ position: 'relative' }}>
        {/* Header row */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-sm">
            <span
              style={{
                padding: '3px 8px',
                fontFamily: 'var(--ff-mono)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: typeColor,
                border: `1px solid color-mix(in srgb, ${typeColor} 40%, transparent)`,
                background: `color-mix(in srgb, ${typeColor} 10%, transparent)`,
              }}
            >
              {c.typeLabel}
            </span>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              conf {c.confidence == null ? 'tanulom' : `${(c.confidence * 100).toFixed(0)}%`}
            </span>
            <span
              className="label-mono"
              style={{ fontSize: 9, color: c.risk === 'low' ? 'var(--success)' : 'var(--warning)' }}
            >
              · {c.risk === 'low' ? 'alacsony kockázat' : 'közép kockázat'}
            </span>
          </div>
        </div>

        {/* Exercise + target */}
        <div className="col mt-md">
          <span className="text-secondary" style={{ fontSize: 12 }}>
            {c.exercise}
          </span>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              marginTop: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.005em',
            }}
          >
            {c.target}
          </div>
        </div>

        {/* Why */}
        <p
          style={{
            fontSize: 13,
            marginTop: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
          }}
        >
          {c.why}
        </p>

        {/* Refs */}
        <div className="row gap-xs flex-wrap mt-md">
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

        {/* If accepted — show glory */}
        {accepted && (
          <div
            className="row gap-sm mt-md"
            style={{
              padding: '8px 10px',
              background: 'color-mix(in srgb, var(--brand-glow) 8%, transparent)',
              borderLeft: '2px solid var(--brand-glow)',
            }}
          >
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--brand-glow)', fontWeight: 500 }}>Ha sikerül</strong> ·{' '}
              {c.glory}
            </span>
          </div>
        )}

        {/* Actions */}
        <div
          className="row gap-sm mt-lg"
          style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={accepted}
            className="flex-1 notch-4"
            style={{
              padding: '12px',
              background: accepted ? 'var(--brand-primary)' : 'transparent',
              border: `1px solid ${accepted ? 'var(--brand-glow)' : 'var(--border-strong)'}`,
              color: accepted ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            {accepted ? (
              <>
                <Icon name="check" size={12} />
                Elfogadva
              </>
            ) : (
              <>
                <Icon name="sparkle" size={12} />
                Vállaljuk
              </>
            )}
          </button>
          {!accepted && (
            <button type="button" className="chip" style={{ padding: '10px 14px', fontSize: 9 }}>
              Nem ma
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
