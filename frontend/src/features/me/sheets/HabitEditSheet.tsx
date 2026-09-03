import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useHabitCatalogActions, useProgressionProfile } from '@/data/hooks'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import type { HabitMode } from '@/data/types'

const XP_MIN = 5
const XP_MAX = 15
const XP_STEP = 5

const ROW: React.CSSProperties = { padding: '9px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }
const TEXT_INPUT: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13 }

/**
 * Habit-def CREATE sheet (routine editor, mezo-n5e9.2; narrowed to create-only in the
 * mezo-3zue.4 fix wave). `RutinHubPage` only ever opens it as `{chainKey}` — a habit row
 * navigates to `/me/rutin/szokas/{habitKey}` instead — so the old edit and delete branches
 * were unreachable dead code, and dead code carrying a DELETE path is a hazard. Editing a
 * definition (title, XP, „miért", the legacy horgony-szöveg, the link) and deleting one both
 * live on `HabitPage` now. The skill picker's options come
 * from `useProgressionProfile().life` (the Growth Skillek tab's own source — GrowthSkillsPage.tsx,
 * one of the Growth hub's sibling pages) rather than the static `LIFE_SKILLS` list directly,
 * falling back to it only when the profile
 * hasn't resolved yet (ghost profile, `life: []`) so the picker is never stranded empty.
 *
 * CREATE offers the mode toggle + (when DERIVED) the metric select; EDIT shows mode/metric AND
 * skillKey as read-only chips — `HabitDefUpdateRequest` (api/feature/habit/habit.yml) has no
 * `mode`/`metric`/`skillKey` fields at all, so all three are contract-immutable after creation,
 * not just the two the brief calls out.
 */
export function HabitEditSheet({
  chainKey, onClose,
}: { chainKey: string; onClose: () => void }) {
  const { createDef, pending } = useHabitCatalogActions()
  const { data: profile } = useProgressionProfile()

  const skillOptions = (profile.life ?? []).length > 0
    ? profile.life.map((s) => {
        const meta = LIFE_SKILLS.find((l) => l.key === s.skillKey)
        return { key: s.skillKey, name: meta?.name ?? s.skillKey, clayIcon: meta?.clayIcon }
      })
    : LIFE_SKILLS.map((s) => ({ key: s.key, name: s.name, clayIcon: s.clayIcon }))

  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [anchorCopy, setAnchorCopy] = useState('')
  const [skillKey, setSkillKey] = useState(skillOptions[0]?.key ?? 'mindset')
  const [xp, setXp] = useState(XP_MIN)
  const [linkUrl, setLinkUrl] = useState('')
  const [mode, setMode] = useState<HabitMode>('MANUAL')
  const [metric, setMetric] = useState(HABIT_METRIC_PALETTE[0]?.metric ?? '')

  const save = (close: () => void) => {
    createDef({
      chainKey, title, why: why || null, anchorCopy: anchorCopy || null,
      mode, skillKey, xp, linkUrl: linkUrl || null,
      ...(mode === 'DERIVED' ? { metric } : {}),
    }).then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="habit-edit-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="habit-edit-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Új habit
          </h2>

          <div className="row" style={ROW}>
            <div className="col" style={{ width: '100%' }}>
              <span style={LABEL}>Cím</span>
              <input aria-label="Cím" value={title} onChange={(e) => setTitle(e.target.value)} style={TEXT_INPUT} />
            </div>
          </div>

          <div className="row" style={ROW}>
            <div className="col" style={{ width: '100%' }}>
              <span style={LABEL}>Miért</span>
              <textarea aria-label="Miért" value={why} onChange={(e) => setWhy(e.target.value)}
                style={{ ...TEXT_INPUT, minHeight: 44, resize: 'none', lineHeight: 1.4 }} />
            </div>
          </div>

          <div className="row" style={ROW}>
            <div className="col" style={{ width: '100%' }}>
              <span style={LABEL}>Horgony-szöveg</span>
              <input aria-label="Horgony-szöveg" value={anchorCopy} onChange={(e) => setAnchorCopy(e.target.value)} style={TEXT_INPUT} />
            </div>
          </div>

          {/* `HabitDefUpdateRequest` carries no `skillKey` (like mode/metric), so all three are
              contract-immutable once a def exists — which is exactly why this sheet is
              create-only and `HabitPage` never offers them. */}
          <span style={LABEL}>Skill</span>
          <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            {skillOptions.map((s) => (
              <button
                key={s.key}
                type="button"
                className="chip"
                aria-pressed={skillKey === s.key}
                onClick={() => setSkillKey(s.key)}
                style={skillKey === s.key
                  ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                  : undefined}
              >
                {s.clayIcon && <ClayIcon name={s.clayIcon} size={12} />} {s.name}
              </button>
            ))}
          </div>

          <div className="row" style={{ ...ROW, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={LABEL}>XP</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="XP csökkentése"
                disabled={xp <= XP_MIN}
                onClick={() => setXp((v) => Math.max(XP_MIN, v - XP_STEP))}
                style={{ opacity: xp <= XP_MIN ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="XP érték" style={{ minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {xp}
              </span>
              <button type="button" className="chip" aria-label="XP növelése"
                disabled={xp >= XP_MAX}
                onClick={() => setXp((v) => Math.min(XP_MAX, v + XP_STEP))}
                style={{ opacity: xp >= XP_MAX ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row" style={ROW}>
            <div className="col" style={{ width: '100%' }}>
              <span style={LABEL}>Link URL</span>
              <input aria-label="Link URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={TEXT_INPUT} />
            </div>
          </div>

          <span style={LABEL}>Típus</span>
          <div className="row gap-sm">
            <button type="button" className="chip" aria-pressed={mode === 'MANUAL'} onClick={() => setMode('MANUAL')}
              style={mode === 'MANUAL' ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' } : undefined}>
              <span aria-hidden="true">✓</span> Pipa (MANUAL)
            </button>
            <button type="button" className="chip" aria-pressed={mode === 'DERIVED'} onClick={() => setMode('DERIVED')}
              style={mode === 'DERIVED' ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' } : undefined}>
              DERIVED
            </button>
          </div>
          {mode === 'DERIVED' && (
            <div className="row" style={ROW}>
              <div className="col" style={{ width: '100%' }}>
                <span style={LABEL}>Metrika</span>
                <select aria-label="Metrika" value={metric} onChange={(e) => setMetric(e.target.value)}
                  style={{ ...TEXT_INPUT, background: 'var(--surface-2)' }}>
                  {HABIT_METRIC_PALETTE.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <button type="button" className="cta-primary" disabled={pending || title.trim().length === 0}
            style={{ opacity: pending || title.trim().length === 0 ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
