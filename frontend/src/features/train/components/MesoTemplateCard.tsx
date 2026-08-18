// ============================================================
// Mezo · MesoTemplateCard (mezo-meyc.1) — one reusable mesocycle blueprint on
// the dedicated `Sablonok` tab (moved off the run library in mezo-tlwa):
// `Sablon` eyebrow + `n× futtatva` badge, Display title, goal, {weeks} hét +
// split chips, then TWO action rows — the primary pair (Szerkesztés → the
// template editor, Indítás → MesoStartSheet) over the lifecycle pair
// (Duplikálás → a `(másolat)` copy, Törlés → delete).
// A template is timeless — no dates, no status, no progress (that's the run's
// job), which is why this card carries actions instead of PlannedMesoCard's
// whole-card navigation.
//
// Törlés is a **two-tap confirm** (`CatalogExerciseSheet`'s idiom): the first tap
// arms the button („Biztos? Törlés"), the second one deletes — no modal for a
// soft-delete that leaves every past run and report untouched. The armed state is
// card-local, so scrolling away and back re-arms nothing; a second card's arm
// does not disarm the first (each owns its own state), which is fine because the
// label itself is the confirmation.
// ============================================================
import { useState } from 'react'
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import type { MesoTemplate } from '@/data/types'

interface MesoTemplateCardProps {
  template: MesoTemplate
  onEdit: () => void
  onStart: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function MesoTemplateCard({ template, onEdit, onStart, onDuplicate, onDelete }: MesoTemplateCardProps) {
  const splitHead = template.split?.split(' · ')[0]
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="card col" style={{ padding: 'var(--sp-4)', width: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow text-tertiary">Sablon</span>
        <span className="label-mono text-tertiary">{template.runCount}× futtatva</span>
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
        {template.title}
      </div>
      {template.goal ? (
        <span className="text-secondary mt-sm" style={{ fontSize: 14, lineHeight: 1.4 }}>
          {template.goal}
        </span>
      ) : null}
      <div className="row gap-sm mt-md">
        <Chip>{template.weeks} hét</Chip>
        {splitHead ? <Chip>{splitHead}</Chip> : null}
      </div>
      <div className="row gap-sm mt-md">
        <button type="button" className="cta-ghost flex-1" onClick={onEdit}>
          <Icon name="pencil" size={14} /> Szerkesztés
        </button>
        <button type="button" className="cta-primary flex-1" onClick={onStart}>
          <Icon name="check" size={14} /> Indítás
        </button>
      </div>
      {/* Lifecycle row — quieter chips, deliberately below the two things you came for. */}
      <div className="row gap-sm mt-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="chip tapchip" onClick={onDuplicate}>
          <Icon name="plus" size={10} /> Duplikálás
        </button>
        <button
          type="button"
          className="chip tapchip"
          onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); return }
            onDelete()
          }}
          style={{ color: 'var(--warning)' }}
        >
          <Icon name="trash" size={10} color="var(--warning)" />
          {confirmDelete ? 'Biztos? Törlés' : 'Törlés'}
        </button>
      </div>
    </div>
  )
}
