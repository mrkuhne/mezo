import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useGamificationDay, useNeedsSummary, useProgressionProfile } from '@/data/hooks'
import { skillDisplay } from '@/features/progression/logic/levelUpMeta'
import { harvestStages } from '@/features/ritual/logic/harvestStages'
import { CountUp } from '@/shared/ui/CountUp'
import { localDateString } from '@/shared/lib/dates'
import { CLAY_TO_3D } from '@/shared/ui/clay'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import { Btn, Card, Hero, Level, Note, Row, Section } from '@/shared/ui/folyadek'
import { RitualFoot } from '@/features/ritual/components/RitualFoot'

type KnownSource = 'GYM' | 'RUN' | 'SPORT' | 'QUEST' | 'ACTIVITY' | 'HABIT'

// HU label per source. GamificationDay.xpBySource[].source is the closed XpEventType union, but it
// has 5 members OTHER than the ones mapped here (MEAL/WEIGHT/SLEEP/CHECKIN/MEDICATION) — those are
// defensively skipped rather than rendered unlabelled.
const SOURCE_LABEL_HU: Record<KnownSource, string> = {
  QUEST: 'Küldetések',
  HABIT: 'Rutin',
  ACTIVITY: 'Napló',
  GYM: 'Edzés',
  RUN: 'Futás',
  SPORT: 'Sport',
}

function isKnownSource(source: string): source is KnownSource {
  return Object.prototype.hasOwnProperty.call(SOURCE_LABEL_HU, source)
}

/** „egy / két / … forrásból" — the count as a word, the way the sentence reads it. */
const COUNT_HU = ['nulla', 'egy', 'két', 'három', 'négy', 'öt', 'hat']

/** A skill's icon as a Folyadék-jel name: a Titanium name as is, a clay name through `CLAY_TO_3D`. */
const glyphOf = (art: Icon3DName | ClayIconName): Icon3DName =>
  art.startsWith('t-') ? (art as Icon3DName) : CLAY_TO_3D[art as ClayIconName] ?? 't-spark'

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Napzárás act 5 — A mai termés (mezo-ilsj, spec §4, Task 6; Folyadék mezo-n4wf5.2, prototype
 * `napzaras.5`). The peak of the flow: the XP total counts up (the shared `CountUp` primitive) as
 * the verdict, and the day's harvest stands in ONE vessel, a layer per source, each as tall as the
 * XP it brought — the list beside it names them. Under it: where the day leaves you (the LIFE skill
 * closest to its next level, the coins, the streak, the days alive). The layers settle in
 * `harvestStages()`'s fixed cadence (inline `animationDelay`; the animation itself is opt-in under
 * `prefers-reduced-motion: no-preference`). The confetti burst of the dark skin is gone: the
 * filling vessel is the celebration.
 *
 * Skill hint honesty: the spec's "még N XP a Lv M-ig" hint is DELIBERATELY DROPPED.
 * `SkillLevel` (the wire type) only carries `level` + `progressPct` (the within-level
 * fill) — no per-skill xp-to-next-level curve. `gamification/levelCurve.ts`'s `xpToNext`
 * is the ACCOUNT level curve (spec §5.2), not a per-skill one, and nowhere else in the FE
 * (SkillBandCard, GrowthPage) derives a skill "N XP to next level" figure either.
 * Fabricating N from progressPct alone would require an assumed xp-per-level that the FE
 * cannot honestly know — so this renders only the bar + `Lv N` (the honest-absence rule),
 * never a made-up count. The title-unlock beat is deferred too (see Task 8's doc note).
 *
 * Streak read: from `useGamificationDay(date)`, NOT `useGamification()`. `GamificationDay`
 * carries its own `streakDays`/`streakAlive` — its type doc comment ties them explicitly to
 * "the ritual Harvest read" — and the two mocks deliberately diverge (the day seed: 12/
 * alive vs. the account profile mock: 6/alive), so the Harvest act reports the day's own
 * snapshot, not the (potentially stale-relative-to-today) account-level read.
 */
export function HarvestStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { data: day } = useGamificationDay(date)
  const { data: progression } = useProgressionProfile()
  const { data: needsSummary } = useNeedsSummary()

  const visibleSources = day.xpBySource.filter(
    (e): e is { source: KnownSource; xp: number } => isKnownSource(e.source),
  )

  // The LIFE skill with the highest within-level progress that hasn't already maxed out.
  const skill = useMemo(
    () => [...progression.life].filter((s) => s.progressPct < 100).sort((a, b) => b.progressPct - a.progressPct)[0] ?? null,
    [progression.life],
  )

  const stages = harvestStages({
    sources: visibleSources.length,
    coins: day.coinEvents.length,
    hasSkillHighlight: skill != null,
  })
  const sourceStages = stages.filter((s) => s.kind === 'source')
  // Largest at the bottom of the vessel: the layers stack upwards from the heaviest source.
  const layers = [...visibleSources].sort((a, b) => b.xp - a.xp)
  const coinSum = day.coinEvents.reduce((sum, c) => sum + c.amount, 0)
  const meta = skill ? skillDisplay(skill.skillKey, 'LIFE') : null

  return (
    <>
      <Hero
        label="A mai termés"
        verdict={<span className="nrz-vbig">+<CountUp to={day.xpTotal} /> XP</span>}
        sub={layers.length > 0
          ? `Ennyit gyűjtöttél ma, ${COUNT_HU[layers.length] ?? layers.length} forrásból. Egy edényben, rétegenként:`
          : undefined}
      >
        <div className="nrz-strata">
          <span className="v" aria-hidden="true">
            {layers.map((s, i) => (
              <i key={s.source} style={{ flex: s.xp, '--m': `${Math.max(15, 100 - i * 17)}%`, animationDelay: `${sourceStages[i].delayMs}ms` } as CSSProperties} />
            ))}
          </span>
          <ol>
            {layers.map((s, i) => (
              <li key={s.source} style={{ flex: s.xp, animationDelay: `${sourceStages[i].delayMs}ms` }}>
                <b>+{s.xp}</b>{SOURCE_LABEL_HU[s.source]}
              </li>
            ))}
          </ol>
        </div>
        {layers.length === 0 && <Note>Ma ennyi fért bele. Az is számít.</Note>}
      </Hero>

      <Section n={1} title="Hol tartasz" />
      <Card>
        {skill && meta && (
          <Row
            icon={glyphOf(meta.art3d)}
            title={<>{meta.name} · <span>Lv {skill.level}</span></>}
            sub="a következő szintig"
            value={<>{Math.round(clampPct(skill.progressPct))}<small>%</small></>}
            more={<Level pct={clampPct(skill.progressPct)} height={10} />}
          />
        )}
        {day.coinEvents.length > 0 && (
          <Row icon="t-coin" title="Érme" sub="a mai jutalmakból" value={`+${coinSum}`} className="nrz-coins" />
        )}
        <Row
          icon="t-flame"
          state={day.streakAlive ? undefined : 'dim'}
          className="nrz-streak"
          title={`${day.streakDays} napos sorozat${day.streakAlive ? ' él' : ' — megszakadt'}`}
        />
        {needsSummary.streakDays > 0 && <Row icon="t-sprout" title={`${needsSummary.streakDays} napja életben`} />}
      </Card>

      <RitualFoot><Btn grow onClick={onNext}>Tovább</Btn></RitualFoot>
    </>
  )
}
