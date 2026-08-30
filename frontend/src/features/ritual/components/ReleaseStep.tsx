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
import { ClayIcon } from '@/shared/ui/clay'

export function ReleaseStep({ prepStartsAt, bedTime, closingNote, onFinish }: {
  prepStartsAt: string
  bedTime: string
  closingNote: string | null
  onFinish: () => void
}) {
  return (
    <div className="rz-act rz-release">
      <svg className="rz-circle" viewBox="0 0 100 100" width="110" aria-hidden="true">
        <circle className="rz-ring" cx="50" cy="50" r="42" />
        {/* The same clay moon act 1 opened on, now at the centre of the closed circle: the
            arc the day drew in act 2 comes back round it, which is the whole gesture of the act. */}
        <g className="rz-circle-moon" transform="translate(28 28)">
          <ClayIcon name="i-hold" size={44} />
        </g>
      </svg>
      <p className="rz-end">A nap le van zárva. Elengedheted.</p>
      {closingNote != null && (
        <p className="rz-note rz-nw">
          <span className="rz-note-eyebrow">Mezo · napzárás</span>
          „{closingNote}"
        </p>
      )}
      <div className="rz-handoff rz-nw">
        <div className="rz-handoff-eyebrow">MOST JÖN · ALVÁS-ELŐKÉSZÍTÉS</div>
        <div className="rz-handoff-steps">
          <span className="rz-handoff-step">
            <ClayIcon name="i-alvas" size={15} /> Lecsendesítés — képernyők le
            <span className="rz-handoff-time">{prepStartsAt}</span>
          </span>
          <span className="rz-handoff-step">
            <ClayIcon name="i-alvas" size={15} /> Villanyoltás
            <span className="rz-handoff-time">{bedTime}</span>
          </span>
        </div>
        <button className="rz-handoff-cta" onClick={onFinish}>Esti rutin indítása →</button>
      </div>
    </div>
  )
}
