import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** A ref kind (wire string, any case) → its Titanium 3D icon + a Hungarian accessible word
 *  (üveg, mezo-me75u.8). The machine kind never reaches the screen in the glass variant
 *  (bible rule 48): the icon carries it, the word goes to screen readers. */
const REF_KIND: Record<string, [Icon3DName, string]> = {
  pr: ['t-record', 'rekord'],
  medication: ['t-syringe', 'szedés'],
  sleep: ['t-sleep', 'alvás'],
  sleeplog: ['t-sleep', 'alvás'],
  workout: ['t-dumbbell', 'edzés'],
  workoutnote: ['t-dumbbell', 'edzés'],
  meal: ['t-bowl', 'étkezés'],
  fuelday: ['t-bowl', 'étkezés'],
  journal: ['t-journal', 'napló'],
  pattern: ['t-pattern', 'minta'],
  checkin: ['t-checkin', 'check-in'],
  memory: ['t-album', 'emlék'],
  lifeevent: ['t-flag', 'életesemény'],
}

export function refKind3D(kind: string): [Icon3DName, string | null] {
  return REF_KIND[kind.toLowerCase()] ?? ['t-anchor', null]
}

/** `glass` (opt-in, üveg): a flat chip with the kind's 3D icon and the label — no `[kind]`
 *  bracket text. Without it the classic `[kind] label` toolchip every other caller renders. */
export function RefTag({ kind, label, glass = false }: { kind: string; label: string; glass?: boolean }) {
  if (glass) {
    const [icon, word] = refKind3D(kind)
    return (
      <span className="reftag-3d" data-kind={kind}>
        <Icon3D name={icon} size={16} />
        {word && <span className="sr-only">{word}: </span>}
        {label}
      </span>
    )
  }
  return (
    <span className="toolchip" style={{ padding: '2px 6px', fontSize: 9 }}>
      [{kind}]&nbsp;{label}
    </span>
  )
}
