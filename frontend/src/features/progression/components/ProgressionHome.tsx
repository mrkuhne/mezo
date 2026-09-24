// ============================================================
// Mezo · ProgressionHome (F7.4 — mezo-d20.8.4.1, en-mely.html)
// The progression's HOME: the streak card + the titles section, moved OUT of the
// retired StreakSheet/TitleShopSheet onto the Growth page's Kitüntetések tab —
// one place, one mental model (the hub's streak/coin chips navigate here). The
// buy/equip/saver logic and the `canMutate` shop gating moved verbatim.
// Üveg re-dress (mezo-me75u.7, prototype uveg-en2.html `kitunt()`): the streak is a frameless
// coral halo with the big t-flame, the saver a flat row (t-shield, t-coin price), the titles ONE
// gold glass card. Only GrowthAwardsPage renders these, so the skin lives in `.gra-page`.
// ============================================================
import { useState } from 'react'
import { useGamification, useGamificationActions, useTitles } from '@/data/hooks'
import { MAX_SAVERS, SAVER_PRICE, STREAK_MILESTONE_COINS } from '@/data/gamification/gamificationStore'
import type { Title } from '@/data/gamification/gamificationTypes'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'

const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)

function SaverRow({ compact }: { compact?: boolean }) {
  const { profile } = useGamification()
  const { buyStreakSaver, canMutate } = useGamificationActions()
  return (
    <div className={cn('gr-saver', compact && 'compact')}>
      <Icon3D name="t-shield" size={34} className="gr-saver-art" />
      <div className="gr-saver-grow">
        <div className="gr-saver-nm">Streak-mentő</div>
        <div className="gr-saver-sub">
          <Icon3D name="t-coin" size={14} className="gr-coin" /><span className="sr-only">érme: </span>{SAVER_PRICE} · nálad: {profile.streakSavers}/{MAX_SAVERS}
        </div>
      </div>
      <button
        type="button"
        className="gr-titact buy"
        disabled={!canMutate || profile.coins < SAVER_PRICE || profile.streakSavers >= MAX_SAVERS}
        onClick={buyStreakSaver}
      >
        Megveszem
      </button>
    </div>
  )
}

/** The daily-streak card — a frameless coral halo, the big 3D flame, milestone bar + saver row. */
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
        opacity: profile.streakAlive === false ? 0.6 : 1,
      } as React.CSSProperties}
    >
      <Icon3D name="t-flame" size={86} className="gr-flame" />
      <div className="gr-streak-body">
        <div className="gr-streak-num">
          <span className="gr-streak-n">{profile.streakDays}</span>
          <span className="gr-streak-u">napos sorozat</span>
        </div>
        <div className="gr-msbar">
          <i style={{ '--w': `${pct}%` } as React.CSSProperties} />
        </div>
        <div className="gr-streak-next">
          {next != null
            ? <>következő mérföldkő: <b>{next} nap</b> — +{STREAK_MILESTONE_COINS[next]} érme</>
            : 'Minden mérföldkő megvan'}
        </div>
        <p className="gr-streak-p">
          A sorozatot bármilyen mai log életben tartja — étkezés, súly, alvás, edzés vagy quest.
          Ha kimarad egy nap, egy streak-mentő automatikusan megmenti.
        </p>
      </div>
      <SaverRow compact />
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
      <span className="nm">{t.name}</span>
      <span className="sub">
        {t.kind === 'LADDER' ? `LV ${t.unlockLevel}` : <><Icon3D name="t-coin" size={14} className="gr-coin" /><span className="sr-only">érme: </span>{t.priceCoins}</>}
      </span>
      {t.equipped ? (
        <span className="gr-titact worn">Viselve</span>
      ) : t.owned ? (
        <button type="button" className="gr-titact" disabled={!canMutate} onClick={() => onEquip(t.key)}>
          Felvesz
        </button>
      ) : t.kind === 'SHOP' ? (
        <button
          type="button"
          className="gr-titact buy"
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
    <div className="gr-titles rise" data-testid="titles-section" style={{ '--d': `${delayMs ?? 0}ms` } as React.CSSProperties}>
      <div className="gr-h3">
        <span className="mz-eyebrow">Címek</span>
        <span className="gr-h3-em gr-coins">
          <Icon3D name="t-coin" size={16} className="gr-coin" /><span className="sr-only">érme: </span>{profile.coins}
        </span>
      </div>
      <div className="gr-band gr-titcard glass" style={{ '--c': 'var(--dv-amber)' } as React.CSSProperties}>
        {equipped && (
          <div className="gr-titworn">
            <Icon3D name="t-record" size={34} className="gr-titworn-art" />
            <span>Viselt cím: <b>{equipped.name}</b></span>
          </div>
        )}
        <div className="gr-seg" role="tablist">
          <button type="button" role="tab" aria-selected={seg === 'ladder'} className={cn(seg === 'ladder' && 'on')} onClick={() => setSeg('ladder')}>
            Létra
          </button>
          <button type="button" role="tab" aria-selected={seg === 'shop'} className={cn(seg === 'shop' && 'on')} onClick={() => setSeg('shop')}>
            Bolt
          </button>
        </div>
        {seg === 'shop' && !canMutate ? (
          <p className="gr-titnote">
            A bolt a backend-szelettel érkezik.
          </p>
        ) : (
          <div className="gr-titlist">
            {shown.map((t) => (
              <TitleRow key={t.key} t={t} coins={profile.coins} canMutate={canMutate} onBuy={buyTitle} onEquip={equipTitle} />
            ))}
            {seg === 'shop' && <SaverRow />}
          </div>
        )}
      </div>
    </div>
  )
}
