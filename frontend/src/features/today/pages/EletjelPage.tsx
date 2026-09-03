// ============================================================
// Mezo · EletjelPage — the Nap hub's Életjel tile opened into its own page
// (mezo-d20.2.6). Source of truth: nap-body.html #page-vital (p-rose tone):
// hero = the SEGMENTED six-arc ring (shared needRingGradient) + the big
// average %, then SIX need tiles — eyebrow + clay icon + mini conic ring + %.
// Each tile's CTA dispatches EXACTLY what TodayPage's onNeedCta does: Víz
// logs +2,5 dl in place, Étel/Alvás/Kapcsolat open the existing log sheets,
// Mozgás navigates to /train; Rend has no Today log surface (NeedRingSheet
// doctrine) so its tile is non-interactive. Honest states: while the needs
// sim is pending NOTHING numeric renders — no fabricated percentages.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, Mosaic, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useSleep, useWaterActions } from '@/data/hooks'
import { needRingGradient, NEED_ICON, type NeedKey, type NeedState } from '@/features/today/logic/needs'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'

/** Prototype #page-vital tile skins, verbatim (eyebrow ink · mini-ring color ·
 *  wash · icon · aria). Labels differ from NEED_META's sheet names on purpose —
 *  the page speaks the prototype's tile language (Étel, Kapcsolat). The `icon` per key
 *  comes from `NEED_ICON` (needs.ts, mezo-z4h4) — the SAME map the küszöb-nudge cards use
 *  (needsNudges.ts), so the two surfaces can never drift apart. */
export const VITAL_TILE: Record<NeedKey, {
  eyebrow: string; ink: string; ring: string; wash: string; icon: ClayIconName; aria: string
}> = {
  energia: { eyebrow: 'Étel', ink: '#4E6B42', ring: '#6E8B5E', wash: 'mz-w-sage', icon: NEED_ICON.energia, aria: 'Étel logolása' },
  hidratacio: { eyebrow: 'Víz', ink: '#3E7396', ring: '#4E8FB8', wash: 'mz-w-sky', icon: NEED_ICON.hidratacio, aria: 'Víz +2,5 dl' },
  pihenes: { eyebrow: 'Alvás', ink: '#6C5FA3', ring: '#6C5FA3', wash: 'mz-w-lav', icon: NEED_ICON.pihenes, aria: 'Alvás logolása' },
  mozgas: { eyebrow: 'Mozgás', ink: '#A84A26', ring: '#FF6B4A', wash: 'mz-w-coral', icon: NEED_ICON.mozgas, aria: 'Mozgás — edzéshez' },
  lelek: { eyebrow: 'Kapcsolat', ink: '#B0567E', ring: '#C46FA0', wash: 'mz-w-rose', icon: NEED_ICON.lelek, aria: 'Kapcsolat logolása' },
  rend: { eyebrow: 'Rend', ink: '#A8801F', ring: '#C9962E', wash: 'mz-w-gold', icon: NEED_ICON.rend, aria: 'Rend' },
}

export function EletjelPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)
  const { logWater } = useWaterActions(date)
  const { logSleep } = useSleep()
  const { checkins, saveCheckIn } = useCheckins()

  const [mealOpen, setMealOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  const avg = needs.isPending || needs.states.length === 0
    ? 0
    : Math.round(needs.states.reduce((s, n) => s + n.pct, 0) / needs.states.length)
  const avgCount = useCountUp(avg)

  // The SAME dispatch TodayPage's onNeedCta performs — water in place, the rest
  // open/navigate; `rend` intentionally has no branch (no log surface today).
  const onTile = (key: NeedKey) => {
    if (key === 'energia') setMealOpen(true)
    else if (key === 'hidratacio') logWater(250)
    else if (key === 'pihenes') setSleepOpen(true)
    else if (key === 'mozgas') navigate('/train')
    else if (key === 'lelek') {
      const idx = checkins.findIndex(isFillableSlot)
      if (idx >= 0) setCheckInIdx(idx)
    }
  }

  const tile = (s: NeedState, i: number) => {
    const meta = VITAL_TILE[s.key]
    const attention = s.band === 'red' || s.band === 'critical'
    const inner = (
      <>
        <span className="mz-eyebrow" style={{ color: meta.ink }}>{meta.eyebrow}</span>
        <div className="mz-spotwrap"><ClayIcon name={meta.icon} size={47} /></div>
        <div className="ej-row">
          <span className="ej-rr" style={{ '--v': s.pct, '--c': meta.ring } as React.CSSProperties} aria-hidden="true" />
          <span className={cn('ej-pct', attention && 'is-warn')}>{s.pct}%</span>
        </div>
      </>
    )
    const cls = cn('mz-tile', meta.wash, 'rise', attention && 'ej-warn')
    const style = { '--d': `${40 + i * 40}ms` } as React.CSSProperties
    if (s.key === 'rend') return <div key={s.key} className={cls} style={style}>{inner}</div>
    return (
      <button key={s.key} type="button" className={cls} style={style}
        onClick={() => onTile(s.key)} aria-label={meta.aria}>
        {inner}
      </button>
    )
  }

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      <EntranceGroup>
        <div className="mz-page-hero">
          {!needs.isPending && (
            <div className="ej-hero-row">
              <div className="ej-bigring" style={{ background: needRingGradient(needs.states) }}>
                <span className="ej-ringhole"><ClayIcon name="i-eletjel" size={30} /></span>
              </div>
              <span className="mz-bignum">{avgCount}%</span>
            </div>
          )}
        </div>
        <PageBody principle="Koppints egy jelre a logolásához. A gyűrűk nem büntetnek — csak jelzik, mi kér figyelmet.">
          {!needs.isPending && <Mosaic>{needs.states.map(tile)}</Mosaic>}
        </PageBody>
      </EntranceGroup>

      {mealOpen && <LogFlowPage onClose={() => setMealOpen(false)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
      {checkInIdx !== null && (
        <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)} onSave={(d) => saveCheckIn(checkInIdx, d)} />
      )}
    </MozaikPage>
  )
}
