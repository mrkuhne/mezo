// ============================================================
// Mezo · EnHubPage — „Hol tartok", the Én tab's hub (mezo-lhqw7; was the identity-hero +
// 6-tile mosaic face of mezo-d20.6.1 / mezo-me75u.6)
// Source of truth: docs/design_2.0/prototypes/elo/en.html `hub()`.
// Anatomy, top to bottom: the shell fejléc (app/AppHeader.tsx) → the IDENTITY STRIP (flat row:
// monogram, name, title chip, Lv · XP · streak · coin → /me/growth) → the WEEK HERO (the last
// closed week's score ring, delta, „Jól ment / Figyelj rá", → /me/week) → ÉLETVONAL (the
// 12-week weight curve with stations and the sleep band → /me/weight) → CÉLOK ÁLLÁSA (the
// weight goal + the active life goals → /me/goals) → the Fejlődés and Emberek tiles, plus the
// wide Rutin tile. Súly / Alvás / Célok / Napló are bottom-bar tabs now (Test · Célok · Napló),
// so they have no tile here; the biometrics line lives at the bottom of the Test tab (BioRow).
// Each unit reads its OWN hooks (components/hub/*) — this page only composes them and computes
// the three tile lines. Persistent settings live in the shared /settings center.
// Honest states (en-audit §6) are the contract, not the face — each unit's header spells out
// its own; the ones this page owns:
//  · a tile line vanishes while its source is unresolved/empty — no page ever shows a
//    fabricated number (no habits → no „0 / 0", no people → no count);
//  · a line is `undefined` rather than `0`; `insufficient` is never a direction; pending ≠
//    error ≠ empty; a regression is never red.
// Üveg (bible §3.4): the week hero is the one loud thing — a frameless lavender halo; the
// identity strip is flat; Életvonal (sky), Célok állása (coral) and every tile wear `.glass`
// in ONE accent with flat rows inside; empty doors are dashed. CSS: prototype.css
// `── uveg en hub (`.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useHabitDay, useHabitSummary, usePeople, useProgressionProfile } from '@/data/hooks'
import { EnIdentityStrip } from '@/features/me/components/hub/EnIdentityStrip'
import { WeekHeroCard } from '@/features/me/components/hub/WeekHeroCard'
import { LifelineCard } from '@/features/me/components/hub/LifelineCard'
import { GoalStandingCard } from '@/features/me/components/hub/GoalStandingCard'
import { localDateString } from '@/shared/lib/dates'

export function EnHubPage() {
  const navigate = useNavigate()

  // ── tile bottom lines — each from its page's own hook ────────────────
  const { data: progression } = useProgressionProfile()
  const growthBits = [
    progression?.traits.disciplinePct != null ? `${progression.traits.disciplinePct}% fegyelem` : null,
    progression != null && progression.traits.consistencyWeeks > 0 ? `${progression.traits.consistencyWeeks} hét` : null,
  ].filter((b): b is string => b !== null)
  const growthLine = growthBits.length > 0 ? growthBits.join(' · ') : undefined

  const { people } = usePeople()
  const topPerson = [...people].sort((a, b) => b.mentionsThisWeek - a.mentionsThisWeek)[0]
  const emberekLine = people.length === 0
    ? undefined
    : topPerson != null && topPerson.mentionsThisWeek > 0
      ? `${topPerson.name} ${topPerson.mentionsThisWeek}× · e héten`
      : `${people.length} kapcsolat`

  const todayIso = localDateString()
  const { habits: todayHabits } = useHabitDay(todayIso)
  const { data: habitSummary } = useHabitSummary()
  const strengthOf = (keys: string[]) => {
    const values = habitSummary.habits
      .filter((h) => keys.includes(h.key) && h.strengthPct != null)
      .map((h) => h.strengthPct as number)
    return values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null
  }
  const morningPct = strengthOf(todayHabits.filter((h) => h.chain === 'MORNING').map((h) => h.key))
  const eveningPct = strengthOf(todayHabits.filter((h) => h.chain === 'EVENING').map((h) => h.key))
  const doneToday = todayHabits.filter((h) => h.status === 'done').length
  // No habits at all → no line. A fabricated "0 / 0" would read as a real standing.
  const rutinLine = todayHabits.length === 0 ? undefined : (
    <>
      {doneToday} / {todayHabits.length} ma
      {(morningPct != null || eveningPct != null) && (
        <small>
          {[morningPct != null ? `reggel ${morningPct}%` : null,
            eveningPct != null ? `este ${eveningPct}%` : null].filter(Boolean).join(' · ')}
        </small>
      )}
    </>
  )

  return (
    <div className="enh-hub">
      <EntranceGroup className="mz-panel-stack">
        <EnIdentityStrip />
        <WeekHeroCard />
        <LifelineCard />
        <GoalStandingCard />
        <Mosaic>
          <Tile wash="lav" art="t-up" iconSize={44} eyebrow="Fejlődés" delayMs={250} className="glass enh-tile enh-t-growth"
            line={growthLine} onClick={() => navigate('/me/growth')} aria-label="Fejlődés" />
          <Tile wash="rose" art="t-people" iconSize={44} eyebrow="Emberek" delayMs={290} className="glass enh-tile enh-t-emberek"
            line={emberekLine} onClick={() => navigate('/me/people')} aria-label="Emberek" />
          <Tile wide wash="gold" art="t-chain" iconSize={44} eyebrow="Rutin" delayMs={330} className="glass enh-tile enh-t-rutin"
            line={rutinLine} onClick={() => navigate('/me/rutin')} aria-label="Rutin" />
        </Mosaic>
      </EntranceGroup>
    </div>
  )
}
