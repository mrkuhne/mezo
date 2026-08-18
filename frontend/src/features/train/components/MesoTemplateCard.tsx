// ============================================================
// Mezo · MesoTemplateCard (mezo-meyc.1) — one reusable mesocycle blueprint in
// the library's `Sablonok` section: `Sablon` eyebrow + `n× futtatva` badge,
// Display title, goal, {weeks} hét + split chips, and the two actions
// (Szerkesztés → the template editor, Indítás → MesoStartSheet).
// A template is timeless — no dates, no status, no progress (that's the run's
// job), which is why this card carries actions instead of PlannedMesoCard's
// whole-card navigation.
// ============================================================
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import type { MesoTemplate } from '@/data/types'

interface MesoTemplateCardProps {
  template: MesoTemplate
  onEdit: () => void
  onStart: () => void
}

export function MesoTemplateCard({ template, onEdit, onStart }: MesoTemplateCardProps) {
  const splitHead = template.split?.split(' · ')[0]
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
    </div>
  )
}
