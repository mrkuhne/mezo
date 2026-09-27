// ============================================================
// Mezo · PatternRuleCard — a minta-részlet „A szabály" lapos kártyája (mezo-rstt7,
// prototypes/uveg-minta-body.html `.rule`). A szabály ELŐRE rögzített (falszifikálhatóság):
// a mondat a `testPlan`-ból (vagy hiányában a katalógus-párból) jön, sosem a mai adatból; a
// chip-sor a napokat, a vizsgált eltolást és az ablakot mondja ki egy pillantásra.
// ============================================================
import { Icon3D } from '@/shared/ui/clay'
import { lagWord, ruleSentence, type Reading } from '@/features/insights/logic/patternReading'
import { Bold } from '@/features/insights/components/PatternAnswerHero'
import { cn } from '@/shared/lib/cn'
import type { PatternMonitorPair, PatternTestPlan } from '@/data/types'

export function PatternRuleCard({ pair, plan, reading, windowDays }: {
  pair: PatternMonitorPair
  plan: PatternTestPlan | null
  reading: Reading
  windowDays: number | null
}) {
  const n = reading.dayCount
  const minN = reading.minN
  const enough = n >= minN
  const lag = lagWord(plan?.lagDays ?? pair.lagDays)

  return (
    <div className="pmx-rule">
      <p><Bold text={ruleSentence(pair, plan)} /></p>
      <div className="pmx-facts">
        <span className={cn(enough && 'ok')}>
          <Icon3D name={enough ? 't-tick' : 't-clock'} size={18} />
          {enough ? `${n} nap · elég (${minN} kell)` : `${n} / ${minN} nap`}
        </span>
        <span><Icon3D name="t-calendar" size={18} />{lag} nézem a hatást</span>
        {windowDays != null && (
          <span><Icon3D name="t-history" size={18} />az utolsó {windowDays} napból</span>
        )}
      </div>
    </div>
  )
}
