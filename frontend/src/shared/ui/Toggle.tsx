export function Toggle({
  on,
  onToggle,
  ariaLabel,
}: {
  on: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onToggle}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        border: 'none',
        cursor: 'pointer',
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
