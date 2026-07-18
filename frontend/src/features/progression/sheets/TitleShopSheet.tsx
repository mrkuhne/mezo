import { useState } from 'react'
import { useGamification, useGamificationActions, useTitles } from '@/data/hooks'
import { MAX_SAVERS, SAVER_PRICE } from '@/data/gamification/gamificationStore'
import type { Title } from '@/data/gamification/gamificationTypes'
import { cn } from '@/shared/lib/cn'
import { Sheet } from '@/shared/ui/Sheet'

function TitleRow({ t, coins, canMutate, onBuy, onEquip }: {
  t: Title
  coins: number
  canMutate: boolean
  onBuy: (key: string) => void
  onEquip: (key: string) => void
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: t.owned ? 'var(--ink)' : 'var(--faint)' }}>
          {t.name}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
          {t.kind === 'LADDER' ? `LV ${t.unlockLevel}` : `🪙 ${t.priceCoins}`}
        </div>
      </div>
      {t.equipped ? (
        <span className="chip brand">Viselve</span>
      ) : t.owned ? (
        <button type="button" className="chip np-press" disabled={!canMutate} onClick={() => onEquip(t.key)}>
          Felvesz
        </button>
      ) : t.kind === 'SHOP' ? (
        <button
          type="button"
          className="chip np-press"
          disabled={!canMutate || coins < (t.priceCoins ?? 0)}
          onClick={() => onBuy(t.key)}
        >
          Megveszem
        </button>
      ) : (
        <span className="chip" aria-label="Zárolva">🔒</span>
      )}
    </div>
  )
}

/** Title ladder + coin shop (spec §9). Opened from AppHero's title line / 🪙 chip. */
export function TitleShopSheet({ onClose }: { onClose: () => void }) {
  const [seg, setSeg] = useState<'ladder' | 'shop'>('ladder')
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { buyTitle, equipTitle, buyStreakSaver, canMutate } = useGamificationActions()
  const shown = titles.filter((t) => (seg === 'ladder' ? t.kind === 'LADDER' : t.kind === 'SHOP'))
  return (
    <Sheet onClose={onClose} labelledBy="titleshop-title">
      <div className="col gap-md" style={{ padding: '4px 4px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="titleshop-title" className="h-display size-md">Title-ök</h2>
          <span className="chip">🪙 {profile.coins}</span>
        </div>
        <div className="row gap-sm">
          <button type="button" className={cn('chip np-press', seg === 'ladder' && 'brand')} onClick={() => setSeg('ladder')}>
            Létra
          </button>
          <button type="button" className={cn('chip np-press', seg === 'shop' && 'brand')} onClick={() => setSeg('shop')}>
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
            {seg === 'shop' && (
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
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
