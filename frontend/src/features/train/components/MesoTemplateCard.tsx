// ============================================================
// Mezo · MesoTemplateCard (mezo-meyc.1, redesigned into a Mozaik 2.0 POSTER in
// mezo-3a9a — prototype `docs/design_2.0/prototypes/sablonok.html`) — one reusable
// mesocycle blueprint on the `Sablonok` tab.
//
// The old card was a flat white box that SAID what the block is (chips: "5 nap ·
// U/L/P/P/L", "5 + 1 deload") under four equal-weight buttons — the Törlés carried the
// same visual weight as the Indítás, and nothing showed what you were about to start.
// The poster DRAWS it instead (`templatePoster.ts`, from data the template already has):
//
//   eyebrow → title → goal → **week arc** (one bar per phase-curve week, the deload a
//   hatched step-down) → **day spine** (the week's 7 slots, training days lettered by
//   their type) → chips → foot.
//
// Wash = what the block is for: legacy sage · emphasised coral · balanced gold.
//
// The FACE is the button (→ the template editor: a template's own page is where you
// change it), the foot keeps exactly ONE action — Indítás — and the lifecycle pair
// (Duplikálás, Törlés) moved into the ⋯ menu. Törlés stays the two-tap confirm
// (`CatalogExerciseSheet`'s idiom): the first tap arms it („Biztos? Törlés"), the second
// deletes; the menu stays open while armed, and closes on Escape or an outside press.
// A template is timeless — no dates, no status, no progress (that's the run's job).
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import type { MesoTemplate } from '@/data/types'
import { SPLIT_LABELS, isLegacyPlan } from '@/features/train/logic/mesoPlan'
import { TIER_GROUPS, tierOf } from '@/features/train/logic/musclePriorities'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'
import { daySpine, templateWash, weekArc } from '@/features/train/logic/templatePoster'

interface MesoTemplateCardProps {
  template: MesoTemplate
  onEdit: () => void
  onStart: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const clampDays = (n: number) => Math.min(6, Math.max(2, n))

/** The ⋯ popover holding the lifecycle pair. Closes on Escape and on an outside press. */
function LifecycleMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  // Closing disarms: an armed confirm must never survive out of sight and fire on the
  // next visit to the menu.
  useEffect(() => { if (!open) setConfirmDelete(false) }, [open])

  return (
    <div className="tpl-menuwrap" ref={wrap}>
      <button
        type="button"
        className="tpl-more"
        aria-label="További műveletek"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ···
      </button>
      {open && (
        <div className="tpl-menu">
          <button type="button" onClick={() => { setOpen(false); onDuplicate() }}>
            <Icon name="plus" size={12} /> Duplikálás
          </button>
          <button
            type="button"
            className="tpl-menu-warn"
            onClick={() => {
              if (!confirmDelete) { setConfirmDelete(true); return }
              setOpen(false)
              onDelete()
            }}
          >
            <Icon name="trash" size={12} color="var(--warning)" />
            {confirmDelete ? 'Biztos? Törlés' : 'Törlés'}
          </button>
        </div>
      )}
    </div>
  )
}

export function MesoTemplateCard({ template, onEdit, onStart, onDuplicate, onDelete }: MesoTemplateCardProps) {
  // Training-day count via the shared off-day rule (rest/sport days don't count toward the
  // split) — the chip reads the CURRENT band-model split label off that count, not the raw
  // `template.split` free-text field (which can predate this vocabulary entirely).
  const dayCount = template.days.filter((d) => !isOffDay(d)).length
  const splitChip = dayCount > 0 ? `${dayCount} nap · ${SPLIT_LABELS[clampDays(dayCount)]}` : null
  const starLabels = TIER_GROUPS
    .filter((g) => tierOf(template.musclePriorities, g) === 'emphasize')
    .map((g) => BUDGET_GROUP_LABELS[g] ?? g)
  const weeksChip = template.weeks > 1 ? `${template.weeks - 1} + 1 deload` : null
  const legacy = isLegacyPlan(template)
  const wash = templateWash(template)
  const arc = weekArc(template)
  const spine = daySpine(template.days)
  const eyebrow = legacy ? 'Sablon · régi modell'
    : starLabels.length > 0 ? 'Sablon · fókuszált'
      : 'Sablon · kiegyensúlyozott'
  const peak = arc.findIndex((w) => w.height === 1)

  return (
    <div className={cn('tpl-poster', `mz-w-${wash}`)}>
      {/* The face IS the button: a template's own page is its editor. */}
      <button type="button" className="tpl-face" onClick={onEdit} aria-label={`${template.title} — szerkesztés`}>
        <span className="tpl-head">
          <span className="tpl-head-text">
            <span className="mz-eyebrow">{eyebrow}</span>
            <span className="tpl-title">{template.title}</span>
            {template.goal ? <span className="tpl-goal">{template.goal}</span> : null}
          </span>
          <span className="tpl-disc"><ClayIcon name={legacy ? 'i-polc' : 'i-meso'} size={28} /></span>
        </span>

        {/* The block, drawn: the ramp of weekly bars with the deload's step-down. */}
        <span className="tpl-arcrow">
          <span className="tpl-arc" aria-hidden="true">
            {arc.map((w, i) => (
              <i
                key={i}
                className={cn(w.deload && 'tpl-arc-deload')}
                style={{ '--h': `${w.height * 100}%`, '--d': `${260 + i * 40}ms` } as CSSProperties}
              />
            ))}
          </span>
          {weeksChip ? (
            <span className="tpl-arclab">
              <b>{weeksChip}</b>
              {peak >= 0 ? `csúcs a W${peak + 1}-en` : 'nincs deload hét'}
            </span>
          ) : null}
        </span>

        {/* The split, readable: the week's seven slots, training days lettered. */}
        <span className="tpl-spine" aria-hidden="true">
          {spine.map((s) => (
            <i key={s.day} className={cn(s.letter && 'tpl-spine-on')}>{s.letter ?? ''}</i>
          ))}
        </span>

        <span className="tpl-chips">
          {splitChip ? <Chip>{splitChip}</Chip> : null}
          {starLabels.map((label) => (
            <Chip key={label} style={{ color: 'var(--coral)' }}>{`★ ${label}`}</Chip>
          ))}
          {/* the weeks live in the arc label now — the row would only repeat them */}
          {legacy ? (
            <Chip style={{ border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)', background: 'transparent' }}>
              régi modell
            </Chip>
          ) : null}
        </span>
        {legacy ? (
          <span className="tpl-legacy-note">indításkor az új modellre konvertálódik</span>
        ) : null}
      </button>

      {/* One action on the face; the lifecycle pair lives behind ⋯. */}
      <div className="tpl-foot">
        <span className="tpl-runs label-mono">{template.runCount}× futtatva</span>
        <LifecycleMenu onDuplicate={onDuplicate} onDelete={onDelete} />
        <button type="button" className="cta-primary tpl-start" onClick={onStart}>
          <Icon name="check" size={14} /> Indítás
        </button>
      </div>
    </div>
  )
}
