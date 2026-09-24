// A napom · "most érdemes" — the one next step for today (prototype uveg-napod-body.html
// `.lead`, owner OK 2026-09-24). A glass card whose accent follows the action's kind (workout
// coral, check-in sky, napzárás lavender), its 3D icon, and a flat CTA pill (never glass in
// glass). The action itself comes from `nextBestAction` — pure rules, no LLM.
import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import type { NextAction, NextActionKind } from '@/features/today/logic/napom'

const LOOK: Record<NextActionKind, { icon: Icon3DName; color: string }> = {
  workout: { icon: 't-dumbbell', color: 'var(--dv-coral)' },
  checkin: { icon: 't-checkin', color: 'var(--dv-sky)' },
  napzaras: { icon: 't-moon', color: 'var(--dv-lav)' },
}

export function NapomLeadCard({ action, onGo, i }: { action: NextAction; onGo: (to: string) => void; i: number }) {
  const look = LOOK[action.kind]
  return (
    <div className="napom-lead glass rise" style={{ '--c': look.color, '--i': i } as CSSProperties}>
      <Icon3D name={look.icon} size={44} />
      <span className="napom-lead-grow">
        <span className="uv-eyebrow">{action.eyebrow}</span>
        <strong>{action.title}</strong>
        <small>{action.sub}</small>
      </span>
      <button type="button" className="napom-go" onClick={() => onGo(action.to)}>
        {action.cta} <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
