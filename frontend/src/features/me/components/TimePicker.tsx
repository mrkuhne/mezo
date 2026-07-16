const SELECT_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  padding: '6px 8px',
  fontFamily: 'var(--ff-display)',
  fontSize: 16,
} as const

// Deliberate SMALLER variant (9px/.04em) of the shared SECTION_LABEL idiom — kept
// LOCAL (not hoisted to @/shared/ui/sectionLabel) because it matches the row-label
// idiom used alongside time anchors elsewhere in Me (see EditGoalSheet's Napi ritmus row labels).
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}

export function TimePicker({
  label,
  val,
  onChange,
  hours,
}: {
  label: string
  val: string
  onChange: (next: string) => void
  hours: number[]
}) {
  const [h, m] = val.split(':')
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <span style={SECTION_LABEL}>{label}</span>
      <div className="row gap-xs mt-sm">
        <select
          aria-label={`${label} óra`}
          value={parseInt(h)}
          onChange={e => onChange(String(e.target.value).padStart(2, '0') + ':' + m)}
          style={SELECT_STYLE}
        >
          {hours.map(hh => <option key={hh} value={hh}>{String(hh).padStart(2, '0')}</option>)}
        </select>
        <span style={{ color: 'var(--text-tertiary)', lineHeight: '32px' }}>:</span>
        <select
          aria-label={`${label} perc`}
          value={parseInt(m)}
          onChange={e => onChange(h + ':' + String(e.target.value).padStart(2, '0'))}
          style={SELECT_STYLE}
        >
          {[0, 30].map(mm => <option key={mm} value={mm}>{String(mm).padStart(2, '0')}</option>)}
        </select>
      </div>
    </div>
  )
}
