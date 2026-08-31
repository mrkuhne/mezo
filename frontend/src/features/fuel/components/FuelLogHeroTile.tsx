// ============================================================
// Mezo · FuelLogHeroTile — the hub's live Logolás hero tile (mezo-byo1)
// Replaces the WindowLane swimlane on FuelMaiPage: one full-width coral tile
// under the KeretHero that opens /fuel/log (the Huawei „tile → own page" idiom).
// Prototype: fuel-logolas.html `.logtile`.
//
// State-driven off the SAME WindowLaneVM the blocks page uses, honest at every
// state: a NOW window leads with its label/time + plan meal; otherwise the next
// upcoming window; all-done flips the wash to sage and celebrates quietly; an
// empty day names the gap ("nincs mai terv") instead of fabricating windows.
// Below: one dot per window (sage=done, coral pulse=now, amber=missed) + the
// `{done}/{n} ablak kész · {m} pótolható` status line — the pótolható count only
// when it is real.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import type { WindowLaneVM } from '@/features/fuel/logic/fuelSwimlane'

export interface FuelLogHeroTileProps {
  vm: WindowLaneVM
  onOpen: () => void
}

export function FuelLogHeroTile({ vm, onOpen }: FuelLogHeroTileProps) {
  const tiles = vm.tiles
  const now = tiles.find(t => t.state === 'now')
  const next = tiles.find(t => t.state === 'future')
  const missed = tiles.filter(t => t.state === 'missed').length
  const done = tiles.filter(t => t.state === 'done').length
  const allDone = tiles.length > 0 && done === tiles.length

  let big: string
  let sub: string
  if (now) {
    big = `${now.label} · ${now.time}`
    sub = now.ghost ? 'mit ettél?' : `a tervből: ${now.name}`
  } else if (allDone) {
    big = 'Minden ablak kész ✓'
    sub = 'szép nap volt — nézd meg a részleteket'
  } else if (next) {
    big = `köv. ${next.label} · ${next.time}`
    sub = next.ghost ? 'mit eszel majd?' : `a tervből: ${next.name}`
  } else if (tiles.length === 0) {
    big = 'Logolás'
    sub = 'nincs mai terv — tervezz és logolj'
  } else {
    big = 'Ablakon kívül'
    sub = 'logolj bármit, bármikor'
  }

  return (
    <button type="button" className={`fh-logtile${allDone ? ' is-alldone' : ''}`}
      onClick={onOpen} aria-label="Logolás">
      <span className="fh-lt-eyebrow">
        {now && <i className="fh-lt-nowdot" aria-hidden="true" />}
        {now ? 'Logolás · MOST' : 'Logolás'}
      </span>
      <span className="fh-lt-main">
        <ClayIcon name={now?.icon ?? next?.icon ?? 'i-fuel'} size={45} />
        <span className="fh-lt-txt">
          <span className="fh-lt-big">{big}</span>
          <span className="fh-lt-sub">{sub}</span>
        </span>
        <span className="fh-lt-chev" aria-hidden="true">›</span>
      </span>
      {tiles.length > 0 && (
        <>
          <span className="fh-lt-dots" aria-hidden="true">
            {tiles.map(t => (
              <i key={t.key} className={
                t.state === 'done' ? 'is-f' : t.state === 'now' ? 'is-nw' : t.state === 'missed' ? 'is-ms' : ''
              } />
            ))}
          </span>
          <span className="fh-lt-dline">
            {done}/{tiles.length} ablak kész{missed > 0 ? ` · ${missed} pótolható` : ''}
          </span>
        </>
      )}
    </button>
  )
}
