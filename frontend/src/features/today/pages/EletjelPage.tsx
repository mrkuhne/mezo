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
// ÜVEG (mezo-me75u.3, prototypes/uveg-nap.html `eletjel()`): the hero is frameless — the six-arc
// ring as glowing svg segments in the need hues around a lit inner disc (3D heart + avg %); each
// tile is ONE glass in its need's hue with a 3D icon and a mini ring; an attention tile turns
// coral with a stronger glow. The skin map lives in `EJ_GLASS`; `VITAL_TILE` stays the label/aria
// source (EletjelStrip reads its ink/ring too).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { MozaikPage, Mosaic, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useSleep, useWaterActions } from '@/data/hooks'
import { NEED_ICON, type NeedKey, type NeedState } from '@/features/today/logic/needs'
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

/** Üveg skin per need (uveg-nap.html `NEEDS`): the glass hue (`--c`) and the 3D icon — the
 *  same meanings as `NEED_ICON` (i-fuel → bowl, i-viz → water, i-alvas → sleep, i-edzes →
 *  dumbbell, i-emberek → people, i-rend → chain). */
const EJ_GLASS: Record<NeedKey, { c: string; icon: Icon3DName }> = {
  energia: { c: 'var(--dv-sage)', icon: 't-bowl' },
  hidratacio: { c: 'var(--dv-sky)', icon: 't-water' },
  pihenes: { c: 'var(--dv-lav)', icon: 't-sleep' },
  mozgas: { c: 'var(--dv-coral)', icon: 't-dumbbell' },
  lelek: { c: 'var(--dv-rose)', icon: 't-people' },
  rend: { c: 'var(--dv-amber)', icon: 't-chain' },
}

/** The hero's six-arc ring (uveg-nap.html `eletjel()` bigring): one track + one glowing
 *  progress arc per need, 10 units of gap between segments. */
const RING_R = 84
const RING_C = 2 * Math.PI * RING_R
const RING_SEG = RING_C / 6
function SegmentRing({ states }: { states: NeedState[] }) {
  return (
    <svg viewBox="0 0 196 196" aria-hidden="true">
      {states.map((s, i) => (
        <circle key={`t-${s.key}`} className="ej-seg-track" cx="98" cy="98" r={RING_R}
          strokeDasharray={`${RING_SEG - 10} ${RING_C}`} strokeDashoffset={-i * RING_SEG} />
      ))}
      {states.map((s, i) => (
        <circle key={`p-${s.key}`} className="ej-seg" cx="98" cy="98" r={RING_R}
          style={{ '--c': EJ_GLASS[s.key].c } as React.CSSProperties}
          strokeDasharray={`${Math.max(2, ((RING_SEG - 10) * Math.max(0, Math.min(100, s.pct))) / 100)} ${RING_C}`}
          strokeDashoffset={-i * RING_SEG} />
      ))}
    </svg>
  )
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
    const skin = EJ_GLASS[s.key]
    const attention = s.band === 'red' || s.band === 'critical'
    const inner = (
      <>
        <span className="ej-eb">{meta.eyebrow}</span>
        <span className="ej-trow">
          <Icon3D name={skin.icon} size={46} />
          <span className="ej-mring">
            <svg className="uv-ring" viewBox="0 0 80 80" aria-hidden="true">
              <circle className="uv-ring-track" cx="40" cy="40" r="32" pathLength={100} />
              <circle className="uv-ring-prog" cx="40" cy="40" r="32" pathLength={100}
                strokeDasharray={`${Math.max(0, Math.min(100, s.pct))} 100`} />
            </svg>
            <b className={cn('ej-pct', attention && 'is-warn')}>{s.pct}%</b>
          </span>
        </span>
      </>
    )
    const cls = cn('ej-tile glass rise', attention && 'ej-warn', s.key === 'rend' && 'is-static')
    const style = {
      '--d': `${40 + i * 40}ms`, '--i': i, '--c': attention ? 'var(--dv-coral)' : skin.c,
    } as React.CSSProperties
    if (s.key === 'rend') return <div key={s.key} className={cls} style={style}>{inner}</div>
    return (
      <button key={s.key} type="button" className={cls} style={style}
        onClick={() => onTile(s.key)} aria-label={meta.aria}>
        {inner}
      </button>
    )
  }

  return (
    <MozaikPage tone="rose" className="nap-oldal ej-page">
      <div className="mz-page-head nap-backrow">
        <button type="button" className="mz-backbtn glass nap-back" onClick={() => navigate(-1)} aria-label="Vissza">
          <b aria-hidden="true">‹</b> Ma
        </button>
      </div>
      <EntranceGroup>
        <section className="nap-hero ej-hero uv-halo" data-kalauz-anchor="eletjel-gyuru"
          style={{ '--c': 'var(--dv-rose)', '--c2': 'var(--dv-amber)' } as React.CSSProperties}>
          {!needs.isPending && (
            <div className="ej-bigring">
              <SegmentRing states={needs.states} />
              <div className="ej-core">
                <Icon3D name="t-heart" size={40} />
                <strong className="ej-avg">{avgCount}%</strong>
                <small>ÉLETJELEK</small>
              </div>
            </div>
          )}
        </section>
        <PageBody principle="Koppints egy jelre a logolásához. A gyűrűk nem büntetnek — csak jelzik, mi kér figyelmet.">
          {!needs.isPending && <Mosaic className="ej-mosaic">{needs.states.map(tile)}</Mosaic>}
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
