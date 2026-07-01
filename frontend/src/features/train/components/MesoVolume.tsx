// ============================================================
// Mezo · MesoVolume (builder · Volumen) — the provenance view. A collapsible
// recompute status banner (pulsing live dot → audit card listing the last
// pattern-engine run's per-muscle changes + the tool chips that produced
// them), a `Honnan jönnek a számok?` provenance intro, one VolumeBar per
// muscle group, and a closing `Mezo · javaslat` AI suggestion card.
// Guards mesos that lack volumePerMuscle / volumeRecompute (planned/archived).
// Ported from prototype mesocycles.jsx MesoVolume.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train'
import type { Mesocycle } from '@/data/types'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Icon } from '@/components/ui/Icon'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { Tool } from '@/components/ui/ToolChip'
import { SafeMarkdown } from '@/lib/safeMarkdown'
import { VolumeBar } from '@/features/train/components/VolumeBar'

// The four tools behind the weekly volume recompute (prototype tool chips).
const RECOMPUTE_TOOLS: Tool[] = [
  { type: 'compute', name: 'generateAiHypotheses()' },
  { type: 'read', name: 'get_workout_pattern', args: '28d' },
  { type: 'read', name: 'get_niggle_events()' },
  { type: 'write', name: 'updateVolumeProfile()' },
]

const PROVENANCE_INTRO =
  '**RP guidelines** baseline-ról indulnak (Mike Israetel · intermediate-advanced lifter), majd ' +
  'Daniel-specifikus pattern-ekkel finomítjuk: niggle, sport cross-load, korábbi meso retro. ' +
  '**Tappolj egy izomcsoportra a részletekért.**'

const AI_SUGGESTION =
  'A rear-delt jelenleg 9 szet/hét, MAV target 12. Egy +1 Face Pull szet Pull Day-en bezárná a ' +
  'deficit-et — most aktiválható kihívásként.'

export function MesoVolume({ meso }: { meso: Mesocycle }) {
  const [showHistory, setShowHistory] = useState(false)

  const volumePerMuscle = meso.volumePerMuscle
  const recompute = meso.volumeRecompute

  // Planned / archived mesos lack a volume profile.
  if (!volumePerMuscle) {
    return (
      <div style={{ padding: '12px 24px' }}>
        <Eyebrow>Volumen-profil csak aktív mesocikluson érhető el.</Eyebrow>
      </div>
    )
  }

  return (
    <div className="col">
      {/* Recompute status banner */}
      {recompute && (
        <div style={{ padding: '12px 24px 0' }}>
          <button
            type="button"
            aria-expanded={showHistory}
            aria-label={showHistory ? 'Recompute napló bezárása' : 'Recompute napló kibontása'}
            onClick={() => setShowHistory((v) => !v)}
            className="card notch-4"
            style={{
              padding: '10px 14px',
              width: '100%',
              textAlign: 'left',
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row gap-sm">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--brand-glow)',
                    boxShadow: '0 0 6px var(--brand-glow)',
                    animation: 'pulse-soft 2s ease-in-out infinite',
                  }}
                />
                <div className="col" style={{ alignItems: 'flex-start' }}>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                    Élő rendszer · 4 nappal ezelőtt frissítve
                  </span>
                  <span
                    className="text-tertiary"
                    style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', marginTop: 2 }}
                  >
                    Következő recompute: {recompute.nextRun.replace('Vasárnap · ', 'vas · ')}
                  </span>
                </div>
              </div>
              <Icon name={showHistory ? 'chevron-up' : 'chevron-down'} size={12} color="var(--text-tertiary)" />
            </div>
          </button>

          {showHistory && (
            <div
              className="card notch-4 mt-sm"
              style={{ padding: 14, background: 'var(--surface-2)', borderColor: 'var(--border-brand)' }}
            >
              <Eyebrow brand>Utolsó futás · {recompute.lastRun}</Eyebrow>
              <p className="text-tertiary" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>
                {recompute.trigger} · 3 izomcsoport értékei módosultak Daniel pattern-jei alapján.
              </p>
              <div className="col gap-sm mt-md">
                {recompute.changes.map((c, i) => (
                  <div key={i} className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                    <Icon
                      name={c.warning ? 'warning' : 'sparkle'}
                      size={11}
                      color={c.warning ? 'var(--warning)' : 'var(--brand-glow)'}
                    />
                    <div className="col flex-1">
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          {MUSCLE_LABELS[c.muscle] ?? c.muscle}
                        </span>
                        <span
                          className="label-mono"
                          style={{ fontSize: 10, color: c.warning ? 'var(--warning)' : 'var(--brand-glow)' }}
                        >
                          {c.change}
                        </span>
                      </div>
                      <span
                        className="text-tertiary"
                        style={{ fontSize: 10, lineHeight: 1.4, marginTop: 2 }}
                      >
                        {c.reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: 10, marginTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <ToolChipRow tools={RECOMPUTE_TOOLS} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provenance intro + per-muscle bars */}
      <div style={{ padding: '12px 24px' }}>
        <div
          className="card notch-4"
          style={{
            padding: 12,
            background: 'color-mix(in srgb, var(--brand-glow) 3%, transparent)',
            marginBottom: 14,
          }}
        >
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <div className="col flex-1">
              <Eyebrow brand>Honnan jönnek a számok?</Eyebrow>
              <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <SafeMarkdown text={PROVENANCE_INTRO} />
              </p>
            </div>
          </div>
        </div>

        <div className="col gap-md">
          {Object.entries(volumePerMuscle).map(([muscle, profile]) => (
            <VolumeBar key={muscle} muscle={muscle} profile={profile} />
          ))}
        </div>
      </div>

      {/* AI suggestion */}
      <div style={{ padding: '16px 24px' }}>
        <div
          className="card notch-4"
          style={{ padding: 14, background: 'color-mix(in srgb, var(--brand-glow) 4%, transparent)' }}
        >
          <div className="row gap-sm">
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <div className="col flex-1">
              <Eyebrow brand>Mezo · javaslat</Eyebrow>
              <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                {AI_SUGGESTION}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
