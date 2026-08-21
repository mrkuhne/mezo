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
        {/* pale-lavender moon — token-mixed (Rule 1), matches the arrival moon's mid-stop */}
        <circle className="rz-circle-moon" cx="50" cy="50" r="17" fill="color-mix(in srgb, var(--dv-lav) 45%, var(--text-primary))" />
      </svg>
      <p className="rz-end">A nap le van zárva. Elengedheted. 🌙</p>
      {closingNote != null && (
        <p className="rz-note">
          <span className="rz-note-eyebrow">Mezo · napzárás</span>
          „{closingNote}"
        </p>
      )}
      <div className="rz-handoff">
        <div className="rz-handoff-eyebrow">MOST JÖN · ALVÁS-ELŐKÉSZÍTÉS</div>
        <div className="rz-handoff-steps">
          <span>🌌 Lecsendesítés — képernyők le · {prepStartsAt}</span>
          <span>🛏 Villanyoltás · {bedTime}</span>
        </div>
        <button className="rz-handoff-cta" onClick={onFinish}>Esti rutin indítása →</button>
      </div>
    </div>
  )
}
