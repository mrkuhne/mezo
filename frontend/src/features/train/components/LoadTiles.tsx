import type { LoadTile } from '@/features/train/logic/weeklyLoad'

const LIC: Record<LoadTile['kind'], string> = { gym: 'lic lic-gym', sport: 'lic lic-sport', run: 'lic lic-run' }

export function LoadTiles({ tiles }: { tiles: LoadTile[] }) {
  if (!tiles.length) return null
  return (
    <div className="loadrow">
      {tiles.map((t) => (
        <div key={t.label} className="loadtile">
          <div className={LIC[t.kind]} aria-hidden="true">{t.icon}</div>
          <div>
            <div className="lk">{t.label}</div>
            <div className="lva">{t.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
