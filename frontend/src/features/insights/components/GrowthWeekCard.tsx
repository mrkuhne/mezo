import type { WeeklyGrowth } from '@/data/types'

const fmtHuf = (v: number) => `${v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} Ft`

/** One label→value row in the score-card idiom (label left, value right). */
function GrowthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="text-secondary" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

/** Weekly growth summary card (E3): quests, LIFE XP, activities, savings. */
export function GrowthWeekCard({ growth }: { growth: WeeklyGrowth | null }) {
  const empty = !growth || (growth.questClosed === 0 && growth.lifeXp === 0 && growth.activities === 0)
  return (
    <div className="card" style={{ padding: 18 }}>
      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Growth — heti</span>
      {empty ? (
        <p className="text-tertiary" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Még nincs growth-adat ezen a héten.
        </p>
      ) : growth && (
        <div className="col gap-md mt-md">
          <GrowthRow label="Küldetések" value={`${growth.questCompleted}/${growth.questClosed}`} />
          <GrowthRow label="LIFE XP" value={`+${growth.lifeXp}`} />
          <GrowthRow label="Tevékenységek" value={`${growth.activities}`} />
          {growth.savingsHuf > 0 && <GrowthRow label="Megtakarítás" value={fmtHuf(growth.savingsHuf)} />}
        </div>
      )}
    </div>
  )
}
