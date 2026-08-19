export function DailyQuestsChip({ done, total, rerollsLeft, open, onOpen }: {
  done: number
  total: number
  rerollsLeft: number
  open: boolean
  onOpen: () => void
}) {
  const empty = total === 0
  const rerollCopy = rerollsLeft === 1 ? '1 újrasorsolás' : `${rerollsLeft} újrasorsolás`

  return (
    <button
      type="button"
      className="td-chip td-quest-chip np-press"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={empty
        ? 'Napi küldetések, nincs mai küldetés'
        : `Napi küldetések, ${done}/${total} kész, ${rerollCopy}`}
      onClick={onOpen}
    >
      <span className="td-av td-quest-av" aria-hidden="true">⚡</span>
      <span className="td-chip-t">
        <b>Napi küldetések</b>
        <i>{empty ? 'Nincs mai küldetés' : `${done}/${total} kész · ${rerollCopy}`}</i>
      </span>
      <span className="td-chev" aria-hidden="true">›</span>
    </button>
  )
}
