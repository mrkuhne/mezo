// ============================================================
// Mezo · VolumeBar — the signature provenance widget. A tappable per-muscle
// header (MEV/MAV/MRV stacked zone bar + glowing `current` marker) that
// expands into a 3-stage derivation: 01 Baseline (RP guidelines) →
// 02 Daniel-személyre szabás (per-adjustment deltas) → 03 Eredő · most
// (FinalStat cells), plus an italic note, a confidence mini-bar and an inert
// `Felülír` override chip. Self-managed expand/collapse.
// Ported from prototype mesocycles.jsx VolumeBar.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train'
import type { VolumeProfile } from '@/data/types'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { FinalStat } from '@/features/train/components/FinalStat'

interface VolumeBarProps {
  muscle: string
  profile: VolumeProfile
}

// Adjustment kind → icon (prototype: niggle⚠, pattern✨, recovery=today, sport-cross=train).
function adjustmentIcon(kind: string): IconName {
  switch (kind) {
    case 'niggle':
      return 'warning'
    case 'pattern':
      return 'sparkle'
    case 'recovery':
      return 'today'
    case 'sport-cross':
      return 'train'
    default:
      return 'tool'
  }
}

function deltaText(delta: VolumeProfile['source']['adjustments'][number]['delta']): string {
  return Object.entries(delta)
    .map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`)
    .join(' · ')
}

export function VolumeBar({ muscle, profile }: VolumeBarProps) {
  const [expanded, setExpanded] = useState(false)
  const label = MUSCLE_LABELS[muscle] ?? muscle
  const { mev, mav, mrv, current, source } = profile

  const mevPct = (mev / mrv) * 100
  const mavPct = (mav / mrv) * 100
  const curPct = (current / mrv) * 100
  const hasWarning = source.adjustments.some((a) => a.warning)
  const confidencePct = Math.round(source.confidence * 100)

  return (
    <div className="col gap-xs">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${label} volumen-profil ${expanded ? 'bezárása' : 'kibontása'}`}
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: 0, textAlign: 'left', width: '100%', background: 'transparent' }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-sm">
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
            {hasWarning && <Icon name="warning" size={11} color="var(--warning)" />}
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `1px solid ${expanded ? 'var(--brand-glow)' : 'var(--border-strong)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: expanded ? 'var(--brand-glow)' : 'var(--text-tertiary)',
                fontSize: 9,
                fontFamily: 'var(--ff-mono)',
              }}
            >
              ?
            </span>
          </div>
          <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>
            {current} szet · most
          </span>
        </div>

        {/* Stacked MEV/MAV/MRV zone bar with the glowing current marker.
            Bar spans 0→MRV. Three brand-alpha zones: 0→MEV (faint),
            MEV→MAV (medium), MAV→MRV (strong). A 4px glowing brand bar marks
            `current`, with hairline dividers at the MEV / MAV thresholds. */}
        <div style={{ position: 'relative', height: 18, background: 'var(--surface-2)', marginTop: 4 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${mevPct}%`,
              background: 'color-mix(in srgb, var(--brand-glow) 8%, transparent)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${mevPct}%`,
              top: 0,
              bottom: 0,
              width: `${mavPct - mevPct}%`,
              background: 'color-mix(in srgb, var(--brand-glow) 18%, transparent)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${mavPct}%`,
              top: 0,
              bottom: 0,
              width: `${100 - mavPct}%`,
              background: 'color-mix(in srgb, var(--brand-glow) 28%, transparent)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `calc(${curPct}% - 2px)`,
              top: -2,
              bottom: -2,
              width: 4,
              background: 'var(--brand-glow)',
              boxShadow: '0 0 8px var(--brand-glow)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${mevPct}%`,
              top: -1,
              bottom: -1,
              width: 1,
              background: 'color-mix(in srgb, #ffffff 15%, transparent)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${mavPct}%`,
              top: -1,
              bottom: -1,
              width: 1,
              background: 'color-mix(in srgb, #ffffff 15%, transparent)',
            }}
          />
        </div>
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            fontFamily: 'var(--ff-mono)',
            fontSize: 9,
            color: 'var(--text-tertiary)',
            marginTop: 2,
          }}
        >
          <span>MEV {mev}</span>
          <span>MAV {mav}</span>
          <span>MRV {mrv}</span>
        </div>
      </button>

      {expanded && (
        <div
          className="card notch-4 mt-sm"
          style={{ padding: 14, background: 'var(--surface-2)', borderColor: 'var(--border-brand)' }}
        >
          {/* 01 · Baseline */}
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
              01 · Baseline
            </span>
            <div className="bar flex-1" style={{ height: 1, background: 'var(--border-subtle)' }} />
          </div>
          <div className="row mt-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{source.baseline.name}</span>
            <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {source.baseline.mev} / {source.baseline.mav} / {source.baseline.mrv}
            </span>
          </div>

          {/* 02 · Daniel-személyre szabás */}
          {source.adjustments.length > 0 && (
            <>
              <div className="row gap-sm mt-md" style={{ alignItems: 'center' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                  02 · Daniel-személyre szabás
                </span>
                <div className="bar flex-1" style={{ height: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div className="col gap-sm mt-sm">
                {source.adjustments.map((a, i) => {
                  const tint = a.warning ? 'var(--warning)' : 'var(--text-secondary)'
                  const deltaNegative = Object.values(a.delta).some((v) => v < 0)
                  return (
                    <div key={i} className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                      <Icon name={adjustmentIcon(a.kind)} size={11} color={tint} />
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.45, flex: 1 }}>
                        {a.label}
                      </span>
                      <span
                        className="label-mono"
                        style={{
                          fontSize: 9,
                          whiteSpace: 'nowrap',
                          color: deltaNegative ? 'var(--warning)' : 'var(--brand-glow)',
                        }}
                      >
                        {deltaText(a.delta)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 03 · Eredő · most */}
          <div className="row gap-sm mt-md" style={{ alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
              03 · Eredő · most
            </span>
            <div className="bar flex-1" style={{ height: 1, background: 'var(--border-subtle)' }} />
          </div>
          <div className="row gap-md mt-sm">
            <FinalStat label="MEV" val={mev} delta={mev - source.baseline.mev} />
            <FinalStat label="MAV" val={mav} delta={mav - source.baseline.mav} />
            <FinalStat label="MRV" val={mrv} delta={mrv - source.baseline.mrv} highlight />
          </div>

          {/* Note */}
          {source.note && (
            <p
              className="text-secondary mt-md"
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                fontStyle: 'italic',
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              &ldquo;{source.note}&rdquo;
            </p>
          )}

          {/* Confidence + override */}
          <div className="row mt-md" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                Confidence
              </span>
              <div className="bar" style={{ width: 80, height: 3 }}>
                <div className="bar-fill glow" style={{ width: `${confidencePct}%` }} />
              </div>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                {confidencePct}%
              </span>
            </div>
            <button type="button" className="chip" style={{ fontSize: 9, padding: '4px 8px' }}>
              <Icon name="tool" size={10} /> Felülír
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
