import { useGamification, useGamificationActions } from '@/data/hooks'
import {
  MAX_SAVERS,
  SAVER_PRICE,
  STREAK_MILESTONE_COINS,
} from '@/data/gamification/gamificationStore'
import { Sheet } from '@/shared/ui/Sheet'

const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)

/** Daily-streak detail + saver purchase (spec §9). Opened from AppHero's 🔥 chip. */
export function StreakSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useGamification()
  const { buyStreakSaver, canMutate } = useGamificationActions()
  const next = MILESTONES.find((m) => m > profile.streakDays)
  return (
    <Sheet onClose={onClose} labelledBy="streak-title">
      <div className="col gap-md" style={{ padding: '4px 4px 8px' }}>
        <h2 id="streak-title" className="h-display size-md">🔥 {profile.streakDays} napos sorozat</h2>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--coral-deep)' }}>
          {next != null
            ? `Következő mérföldkő: ${next} nap — +${STREAK_MILESTONE_COINS[next]} 🪙`
            : 'Minden mérföldkő megvan 💪'}
        </p>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sub)' }}>
          A sorozatot bármilyen mai log életben tartja — étkezés, súly, alvás, edzés vagy quest.
          Ha kimarad egy nap, egy streak-mentő automatikusan megmenti.
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>🧊 Streak-mentő</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
              🪙 {SAVER_PRICE} · nálad: {profile.streakSavers}/{MAX_SAVERS}
            </div>
          </div>
          <button
            type="button"
            className="chip np-press"
            disabled={!canMutate || profile.coins < SAVER_PRICE || profile.streakSavers >= MAX_SAVERS}
            onClick={buyStreakSaver}
          >
            Megveszem
          </button>
        </div>
      </div>
    </Sheet>
  )
}
