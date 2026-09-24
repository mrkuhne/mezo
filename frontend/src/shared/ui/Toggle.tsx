export function Toggle({
  on,
  onToggle,
  ariaLabel,
  disabled = false,
  glass = false,
}: {
  on: boolean
  onToggle: () => void
  ariaLabel: string
  disabled?: boolean
  /** Üveg variant (mezo-me75u.7): no inline skin — the track and knob are drawn by the page's
   *  üveg block (`.uv-tgl`, lit in the surface's `--c` accent when on). The inline default
   *  below would outrank any stylesheet, so a glass page opts out here instead. */
  glass?: boolean
}) {
  if (glass) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onToggle}
        className={on ? 'uv-tgl is-on' : 'uv-tgl'}
      >
        <span className="uv-tgl-knob" aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: 999,
        background: on ? 'var(--sage)' : 'var(--surface-3)',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: on ? 21 : 1,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--text-primary)',
          transition: 'left 0.2s cubic-bezier(0.2,0.8,0.2,1)',
        }}
      />
    </button>
  )
}
