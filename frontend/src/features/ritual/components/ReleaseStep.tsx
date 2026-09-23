/**
 * Napzárás act 6 — Elengedés (mezo-ilsj, spec §4). The closing circle (np-draw reuse),
 * the fixed release line, an optional companion closingNote, then the evening handoff
 * panel that reads straight from the ritual window (Task 1) — no new data, just the
 * two remaining stops (prep + bed). `onFinish` navigates to /today, where the Este face
 * owns the sleep-prep phase from there on — the `WindDownBanner` card plus the evening
 * habit chain, which since the daypart-faces re-composition (mezo-j7u4) renders as
 * `TodoCard` rows on `FaceEvening` rather than in the retired `RoutineCard`
 * (integration, not duplication — this component never renders prep-step UI itself).
 */
import { Icon3D } from '@/shared/ui/clay'

export function ReleaseStep({ prepStartsAt, bedTime, closingNote, onFinish }: {
  prepStartsAt: string
  bedTime: string
  closingNote: string | null
  onFinish: () => void
}) {
  return (
    <div className="rz-act rz-release">
      {/* Üveg (mezo-me75u.3): the drawn lavender ring closes round the same 3D moon act 1 opened
          on — the arc the day drew in act 2 comes back round, which is the whole gesture. */}
      <div className="rz-circle" aria-hidden="true">
        <svg className="rz-circle-svg uv-ring" viewBox="0 0 100 100">
          <circle className="uv-ring-track" cx="50" cy="50" r="44" />
          <circle className="rz-ring" cx="50" cy="50" r="44" pathLength={100} />
        </svg>
        <Icon3D name="t-moon" size={80} className="rz-circle-moon" />
      </div>
      <p className="rz-end">A nap le van zárva. <span className="rz-end-soft">Elengedheted.</span></p>
      {closingNote != null && (
        <p className="rz-note glass">
          <span className="rz-note-eyebrow">Mezo · napzárás</span>
          <span className="rz-note-quote uv-voice">„{closingNote}"</span>
        </p>
      )}
      <div className="rz-handoff glass">
        <div className="rz-handoff-eyebrow">MOST JÖN · ALVÁS-ELŐKÉSZÍTÉS</div>
        <div className="rz-handoff-steps">
          <span className="rz-handoff-step">
            <Icon3D name="t-sleep" size={32} />
            <span className="rz-handoff-label">Lecsendesítés — képernyők le</span>
            <span className="rz-handoff-time">{prepStartsAt}</span>
          </span>
          <span className="rz-handoff-step">
            <Icon3D name="t-moon" size={32} />
            <span className="rz-handoff-label">Villanyoltás</span>
            <span className="rz-handoff-time">{bedTime}</span>
          </span>
        </div>
      </div>
      <button className="rz-handoff-cta" onClick={onFinish}>Esti rutin indítása →</button>
    </div>
  )
}
