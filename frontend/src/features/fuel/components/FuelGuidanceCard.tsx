// ============================================================
// Mezo · FuelGuidanceCard — the Fuel Mai during illness / stomach bug (Kihagyás S3, mezo-q4xt2.3;
// Folyadék F5, mezo-n4wf5.5 — prototype vilagos/fuel.js `mai()` GUIDANCE branch). In GUIDANCE mode the day
// has no calorie target: this face replaces the bowl hero, „Miből jön össze?" and the macro vials.
//   the amber hero — the water glass (the one level that matters now, a button to the water sheet) · the
//     label · „Ma nincs kalóriacél." · the calm lead and the plain kcal total, never measured against
//     anything · on the liquid: „+ Víz" and „Mikor fordulj orvoshoz?"
//   section 1 „Most ez segít" — three tips, for a stomach bug the „könnyebben mennek le" chips, the note
// Calm, never graded: nothing here compares, counts down or turns red. The copy is guidance, not medicine —
// and says so.
// ============================================================
import { useState } from 'react'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Btn, Card, Chips, Hero, Lab, Lk, Note, Section } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { Glass, MACRO_COLOR, Tip } from '@/features/fuel/components/folyadek'
import { DoctorSheet, type DoctorCategory } from '@/features/fuel/sheets/DoctorSheet'
import { withBold } from '@/features/fuel/components/FuelEnergyHero'

/** The glyph and colour of each tip, in the order of the catalog's `gentle.tips` lists. */
const TIP_ART: Record<DoctorCategory, readonly { icon: Icon3DName; color?: string }[]> = {
  STOMACH: [{ icon: 't-water', color: MACRO_COLOR.water }, { icon: 't-tea' }, { icon: 't-skip', color: 'var(--fo-warn)' }],
  ILLNESS: [{ icon: 't-water', color: MACRO_COLOR.water }, { icon: 't-tea' }, { icon: 't-meat' }],
}

export function FuelGuidanceCard({ category, day, waterMl, waterTargetMl, eatenKcal, onWater }: {
  category: DoctorCategory
  /** 1-based day of the recovery period; null when unknown (the label drops it). */
  day: number | null
  waterMl: number
  waterTargetMl: number
  /** What was logged so far — shown plain, never compared. */
  eatenKcal: number
  /** „+ Víz" — opens the existing water sheet. */
  onWater: () => void
}) {
  const M = useM()
  const G = M.fuelMai.gentle
  const [doctorOpen, setDoctorOpen] = useState(false)
  const stomach = category === 'STOMACH'
  const pct = waterTargetMl > 0 ? Math.min(100, (waterMl / waterTargetMl) * 100) : 0
  const label = [M.fuelKozos.gentle, G.who[category], ...(day != null ? [G.day(day)] : [])].join(' · ')
  return (
    <>
      <Hero warn className="fa-gh" aria-label={G.cardAria} label={label} verdict={G.noTarget}
        sub={<>{G.lead} {eatenKcal > 0 ? withBold(G.eaten(fmtGrouped(eatenKcal))) : G.eatenNone}</>}
        left={(
          <button type="button" className="fa-gl" onClick={onWater} aria-label={G.waterAria}>
            <Glass pct={pct} size={74} />
            <small>{G.waterValue(fmtNum(waterMl / 1000), fmtNum(waterTargetMl / 1000))}<i>{G.waterToday}</i></small>
          </button>
        )}
        actions={(
          <>
            <Btn onClick={onWater}>{G.addWater}</Btn>
            <Lk onClick={() => setDoctorOpen(true)}>{G.doctor}</Lk>
          </>
        )} />
      <Section n={1} title={G.helps} />
      <Card className="fa-gtips">
        {G.tips[category].map((t, i) => (
          <Tip key={t.title} icon={TIP_ART[category][i].icon} color={TIP_ART[category][i].color} title={t.title}>{t.body}</Tip>
        ))}
        {stomach && (
          <>
            <Lab>{G.easyLabel}</Lab>
            <Chips className="fa-easy" items={[...G.easy]} />
            <Note>{G.easyNote}</Note>
          </>
        )}
        <Note>{G.closeNote}</Note>
      </Card>
      {doctorOpen && <DoctorSheet category={category} onClose={() => setDoctorOpen(false)} />}
    </>
  )
}
