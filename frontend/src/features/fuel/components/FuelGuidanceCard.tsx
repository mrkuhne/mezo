// ============================================================
// Mezo · FuelGuidanceCard — the Fuel Mai during illness / stomach bug (Kihagyás S3,
// mezo-q4xt2.3; prototype elo/fuel.html `guidance()`). In GUIDANCE mode the day has no kalória-
// cél: this ONE glass card replaces the hero, „Miből jön össze?" and the macro rings. Inside it
// everything is flat (no glass in glass): the category icon + title, the water row (the one
// number that matters now), three tips, for a stomach bug the „könnyebben mennek le" chips, the
// „Mikor fordulj orvoshoz?" door and a plain kcal total that is never measured against anything.
// Calm, never graded: nothing here compares, counts down or turns red. The copy is guidance, not
// medicine — and says so, twice.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { hu1, huInt } from '@/shared/lib/huNum'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { DoctorSheet, type DoctorCategory } from '@/features/fuel/sheets/DoctorSheet'

export const GUIDANCE_WHO: Record<DoctorCategory, string> = { ILLNESS: 'Beteg vagy', STOMACH: 'Gyomorrontás' }
const GUIDANCE_ICON: Record<DoctorCategory, Icon3DName> = { ILLNESS: 't-ill', STOMACH: 't-digestion' }

const TIPS: Record<DoctorCategory, readonly { icon: Icon3DName; title: string; body: string }[]> = {
  STOMACH: [
    { icon: 't-water', title: 'Kis kortyokban, gyakran', body: 'Víz, gyenge tea, húsleves. Ha hánytál, várj egy kicsit, és kortyonként kezdd újra.' },
    { icon: 't-tea', title: 'Egyél, amikor megkívánod', body: 'Nem kell erőltetni. Ha megjön az étvágyad, kezdd kis adaggal.' },
    { icon: 't-skip', title: 'Ezeket most hagyd ki', body: 'Zsíros és csípős étel, gyümölcslé, szénsavas üdítő.' },
  ],
  ILLNESS: [
    { icon: 't-water', title: 'Igyál sokat', body: 'Víz, tea, leves. A folyadék most fontosabb, mint a kalória.' },
    { icon: 't-tea', title: 'Könnyű, meleg étel', body: 'Egyél, amikor megy. Egy leves, pirítós, joghurt vagy gyümölcs is elég.' },
    { icon: 't-meat', title: 'Ha megy, egy kis fehérje', body: 'Tojás, túró, csirke: segít, hogy ne gyengülj le. Nem kötelező.' },
  ],
}

export const EASY_FOODS = ['Banán', 'Főtt rizs', 'Pirítós', 'Főtt krumpli', 'Sós keksz', 'Húsleves', 'Almapüré'] as const

const R = 21
const CIRC = 2 * Math.PI * R

export function FuelGuidanceCard({ category, day, waterMl, waterTargetMl, eatenKcal, onWater }: {
  category: DoctorCategory
  /** 1-based day of the recovery period; null when unknown (the eyebrow drops it). */
  day: number | null
  waterMl: number
  waterTargetMl: number
  /** What was logged so far — shown plain, never compared. */
  eatenKcal: number
  /** „＋ Víz" — opens the existing water sheet. */
  onWater: () => void
}) {
  const [doctorOpen, setDoctorOpen] = useState(false)
  const stomach = category === 'STOMACH'
  const pct = waterTargetMl > 0 ? Math.min(100, (waterMl / waterTargetMl) * 100) : 0
  return (
    <section className="fmx-gcard glass" style={{ '--c': 'var(--dv-lav)' } as CSSProperties}
      aria-label="Kímélő mód · ma nincs kalóriacél">
      <div className="fmx-ghead">
        <Icon3D name={GUIDANCE_ICON[category]} size={56} />
        <span>
          <span className="fmx-geb">KÍMÉLŐ MÓD · {GUIDANCE_WHO[category].toLocaleUpperCase('hu')}{day != null ? ` · ${day}. NAP` : ''}</span>
          <h2>Ma nincs kalóriacél</h2>
          <p>Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük.</p>
        </span>
      </div>

      <button type="button" className="fmx-gwater" onClick={onWater} aria-label="Víz logolása">
        <span className="fmx-gw" aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle className="fmx-gw-track" cx="26" cy="26" r={R} />
            <circle className="fmx-gw-prog" cx="26" cy="26" r={R}
              style={{ strokeDasharray: `${(pct / 100) * CIRC} ${CIRC}` }} />
          </svg>
          <Icon3D name="t-water" size={26} />
        </span>
        <span className="fmx-gw-t">
          <b>{hu1(waterMl / 1000)} l</b>
          <small>/ {hu1(waterTargetMl / 1000)} l folyadék ma</small>
        </span>
        <em>＋ Víz</em>
      </button>

      <div className="fmx-gtips">
        {TIPS[category].map(t => (
          <div key={t.title} className="fmx-gtip">
            <Icon3D name={t.icon} size={32} />
            <span><b>{t.title}</b><small>{t.body}</small></span>
          </div>
        ))}
      </div>

      {stomach && (
        <div className="fmx-geasy">
          <span className="fmx-geb">EZEK KÖNNYEBBEN MENNEK LE</span>
          <div className="fmx-gchips">{EASY_FOODS.map(n => <span key={n}>{n}</span>)}</div>
          <small>Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen.</small>
        </div>
      )}

      <button type="button" className="fmx-gdoc" onClick={() => setDoctorOpen(true)}>
        <Icon3D name="t-info" size={22} />
        <span>Mikor fordulj orvoshoz?</span>
        <b aria-hidden="true">›</b>
      </button>

      <p className="fmx-gtotal">
        {eatenKcal > 0
          ? <>Ma eddig <b>{huInt(eatenKcal)} kcal</b> · nem mérjük semmihez</>
          : 'Amit megeszel, beírhatod. Nem mérjük semmihez.'}
      </p>
      <p className="fmx-gfine">Ez nem orvosi tanács.</p>

      {doctorOpen && <DoctorSheet category={category} onClose={() => setDoctorOpen(false)} />}
    </section>
  )
}
