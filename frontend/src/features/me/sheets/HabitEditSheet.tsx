import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Chip } from '@/shared/ui/Chip'
import { useHabitCatalogActions, useProgressionProfile } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'
import type { HabitDefInfo, HabitMode } from '@/data/types'

const XP_MIN = 5
const XP_MAX = 15
const XP_STEP = 5

const ROW: React.CSSProperties = { padding: '9px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }
const TEXT_INPUT: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13 }

/**
 * Habit-def create/edit sheet (routine editor, mezo-n5e9.2). The skill picker's options come
 * from `useProgressionProfile().life` (the Growth Skillek tab's own source — GrowthPage.tsx)
 * rather than the static `LIFE_SKILLS` list directly, falling back to it only when the profile
 * hasn't resolved yet (ghost profile, `life: []`) so the picker is never stranded empty.
 *
 * CREATE offers the mode toggle + (when DERIVED) the metric select; EDIT shows mode/metric AND
 * skillKey as read-only chips — `HabitDefUpdateRequest` (api/feature/habit/habit.yml) has no
 * `mode`/`metric`/`skillKey` fields at all, so all three are contract-immutable after creation,
 * not just the two the brief calls out.
 */
export function HabitEditSheet({
  chainKey, def, onClose,
}: { chainKey: string; def?: HabitDefInfo; onClose: () => void }) {
  const { createDef, updateDef, deleteDef, pending } = useHabitCatalogActions()
  const { data: profile } = useProgressionProfile()

  const skillOptions = (profile.life ?? []).length > 0
    ? profile.life.map((s) => {
        const meta = LIFE_SKILLS.find((l) => l.key === s.skillKey)
        return { key: s.skillKey, name: meta?.name ?? s.skillKey, clayIcon: meta?.clayIcon }
      })
    : LIFE_SKILLS.map((s) => ({ key: s.key, name: s.name, clayIcon: s.clayIcon }))

  const [title, setTitle] = useState(def?.title ?? '')
  const [why, setWhy] = useState(def?.why ?? '')
  const [anchorCopy, setAnchorCopy] = useState(def?.anchorCopy ?? '')
  const [skillKey, setSkillKey] = useState(def?.skillKey ?? skillOptions[0]?.key ?? 'mindset')
  const [xp, setXp] = useState(def?.xp ?? XP_MIN)
  const [linkUrl, setLinkUrl] = useState(def?.linkUrl ?? '')
  const [mode, setMode] = useState<HabitMode>(def?.mode ?? 'MANUAL')
  const [metric, setMetric] = useState(HABIT_METRIC_PALETTE[0]?.metric ?? '')

  const save = (close: () => void) => {
    if (def) {
      // Contract-honest "can't clear an optional field in v1" (mezo-n5e9.2 fix wave): the real
      // PATCH ignores a JSON `null` value (`if (request.getWhy() != null)`), so sending
      // `why: null` after the user emptied the field silently no-ops in real mode while
      // `mockUpdateDef` used to actually clear it — a divergence the refetch would then expose
      // (the old value reappears). Omitting an emptied optional key entirely makes both modes
      // agree: neither touches a field the user cleared, in v1.
      const patch: HabitDefUpdateInput = { title, xp }
      if (why.trim()) patch.why = why
      if (anchorCopy.trim()) patch.anchorCopy = anchorCopy
      if (linkUrl.trim()) patch.linkUrl = linkUrl
      updateDef(def.id, patch).then(close)
      return
    }
    createDef({
      chainKey, title, why: why || null, anchorCopy: anchorCopy || null,
      mode, skillKey, xp, linkUrl: linkUrl || null,
      ...(mode === 'DERIVED' ? { metric } : {}),
    }).then(close)
  }

  const remove = (close: () => void) => {
    if (def) deleteDef(def.id).then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="habit-edit-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="habit-edit-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {def ? 'Habit szerkesztése' : 'Új habit'}
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

          {/* The picker is CREATE-only: `HabitDefUpdateRequest` has no `skillKey` field (like
              mode/metric), so an editable picker in EDIT mode would silently drop a change on
              save — the read-only chip block below carries it once a def exists. */}
          {!def && (
            <>
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
            </>
          )}

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

          {def ? (
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <Chip>{def.mode}</Chip>
              {def.mode === 'DERIVED' && <Chip>{def.metric}</Chip>}
              <Chip>{skillOptions.find((s) => s.key === def.skillKey)?.name ?? def.skillKey}</Chip>
            </div>
          ) : (
            <>
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
            </>
          )}

          {def && (
            // Confirm-free (single-user app, soft-deleted server-side) — the backend has no
            // seed-def guard, so a built-in def is deletable too, matching the editor's
            // edit-anything intent. Danger-styled (`var(--error)`) so it reads as destructive
            // without needing a two-step confirm like the goal-delete precedent.
            <button
              type="button"
              className="cta-ghost"
              disabled={pending}
              style={{ opacity: pending ? 0.5 : 1, color: 'var(--error)', borderColor: 'var(--error)' }}
              onClick={() => remove(close)}
            >
              <Icon name="trash" size={13} /> Habit törlése
            </button>
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
