// ============================================================
// Mezo · ProgressionHome (F7.4 — mezo-d20.8.4.1, en-mely.html)
// The progression's HOME: the streak card + the titles section, moved OUT of the
// retired StreakSheet/TitleShopSheet onto the Growth page's Kitüntetések tab —
// one place, one mental model (the hub's 🔥/🪙 chips navigate here). The
// buy/equip/saver logic and the `canMutate` shop gating moved verbatim.
// ============================================================
import { useState } from 'react'
import { useGamification, useGamificationActions, useTitles } from '@/data/hooks'
import { MAX_SAVERS, SAVER_PRICE, STREAK_MILESTONE_COINS } from '@/data/gamification/gamificationStore'
import type { Title } from '@/data/gamification/gamificationTypes'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'

const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)

function SaverRow({ compact }: { compact?: boolean }) {
  const { profile } = useGamification()
  const { buyStreakSaver, canMutate } = useGamificationActions()
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: compact ? 12 : 13 }}>🧊 Streak-mentő</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
          🪙 {SAVER_PRICE} · nálad: {profile.streakSavers}/{MAX_SAVERS}
        </div>
      </div>
      <button
        type="button"
        className="gr-titact"
        disabled={!canMutate || profile.coins < SAVER_PRICE || profile.streakSavers >= MAX_SAVERS}
        onClick={buyStreakSaver}
      >
        Megveszem
      </button>
    </div>
  )
}

/** The daily-streak card — coral wash, clay flame, milestone bar + saver row. */
export function StreakCard({ delayMs }: { delayMs?: number }) {
  const { profile } = useGamification()
  const next = MILESTONES.find((m) => m > profile.streakDays)
  const prev = [...MILESTONES].reverse().find((m) => m <= profile.streakDays) ?? 0
  const pct = next ? Math.round(((profile.streakDays - prev) / (next - prev)) * 100) : 100
  return (
    <div
      className="gr-band rise gr-streak"
      data-testid="streak-card"
      style={{
        '--d': `${delayMs ?? 0}ms`,
        background: 'var(--mz-wash-coral)',
        opacity: profile.streakAlive === false ? 0.6 : 1,
      } as React.CSSProperties}
    >
      <ClayIcon name="i-lang" size={45} className="gr-flame" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
          <span className="gr-streak-n">{profile.streakDays}</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>napos sorozat</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--mz-ink-soft)', marginTop: 2 }}>
          {next != null
            ? <>következő mérföldkő: {next} nap — +{STREAK_MILESTONE_COINS[next]} érme</>
            : 'Minden mérföldkő megvan 💪'}
        </div>
        <div className="gr-msbar">
          <i style={{ '--w': `${pct}%` } as React.CSSProperties} />
        </div>
        <p style={{ fontSize: 10, color: 'var(--mz-ink-soft)', marginTop: 6, lineHeight: 1.4 }}>
          A sorozatot bármilyen mai log életben tartja — étkezés, súly, alvás, edzés vagy quest.
          Ha kimarad egy nap, egy streak-mentő automatikusan megmenti.
        </p>
        <div style={{ marginTop: 8 }}>
          <SaverRow compact />
        </div>
      </div>
    </div>
  )
}

function TitleRow({ t, coins, canMutate, onBuy, onEquip }: {
  t: Title
  coins: number
  canMutate: boolean
  onBuy: (key: string) => void
  onEquip: (key: string) => void
}) {
  return (
    <div className={cn('gr-titrow', !t.owned && 'lock')}>
      <div>
        <span className="nm">{t.name}</span>
        <span className="sub">
          {t.kind === 'LADDER' ? `LV ${t.unlockLevel}` : <><ClayIcon name="i-erme" size={11} /> {t.priceCoins}</>}
        </span>
      </div>
      {t.equipped ? (
        <span className="gr-titact worn">Viselve</span>
      ) : t.owned ? (
        <button type="button" className="gr-titact" disabled={!canMutate} onClick={() => onEquip(t.key)}>
          Felvesz
        </button>
      ) : t.kind === 'SHOP' ? (
        <button
          type="button"
          className="gr-titact"
          disabled={!canMutate || coins < (t.priceCoins ?? 0)}
          onClick={() => onBuy(t.key)}
        >
          Megveszem
        </button>
      ) : (
        <span className="gr-lockmk">LV {t.unlockLevel}-TŐL</span>
      )}
    </div>
  )
}

/** Title ladder + coin shop as a Growth section (the TitleShopSheet's content, re-homed). */
export function TitlesSection({ delayMs }: { delayMs?: number }) {
  const [seg, setSeg] = useState<'ladder' | 'shop'>('ladder')
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { buyTitle, equipTitle, canMutate } = useGamificationActions()
  const equipped = titles.find((t) => t.equipped)
  const shown = titles.filter((t) => (seg === 'ladder' ? t.kind === 'LADDER' : t.kind === 'SHOP'))
  return (
    <div className="gr-band rise" data-testid="titles-section" style={{ '--d': `${delayMs ?? 0}ms` } as React.CSSProperties}>
      <div className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
        <span className="mz-eyebrow">Címek</span>
        <span className="row" style={{ marginLeft: 'auto', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
          <ClayIcon name="i-erme" size={15} /> {profile.coins}
        </span>
      </div>
      {equipped && (
        <div style={{ fontSize: 11, marginBottom: 8 }}>
          <span style={{ color: 'var(--mz-ink-soft)' }}>Viselt cím: </span>
          <b style={{ color: 'var(--mz-cell-amber-ink, var(--warning))' }}>{equipped.name}</b>
        </div>
      )}
      <div className="gr-seg" role="tablist" style={{ marginBottom: 6 }}>
        <button type="button" className={cn(seg === 'ladder' && 'on')} onClick={() => setSeg('ladder')}>
          Létra
        </button>
        <button type="button" className={cn(seg === 'shop' && 'on')} onClick={() => setSeg('shop')}>
          Bolt
        </button>
      </div>
      {seg === 'shop' && !canMutate ? (
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sub)' }}>
          A bolt a backend-szelettel érkezik.
        </p>
      ) : (
        <div className="col gap-sm">
          {shown.map((t) => (
            <TitleRow key={t.key} t={t} coins={profile.coins} canMutate={canMutate} onBuy={buyTitle} onEquip={equipTitle} />
          ))}
          {seg === 'shop' && <SaverRow />}
        </div>
      )}
    </div>
  )
}
