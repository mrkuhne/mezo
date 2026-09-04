// ============================================================
// Mezo · EnHubPage — the Én tab's hub Mozaik face (mezo-d20.6.1)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html hub section
// (values ×1.18). The Me shell (AppHero + SubNavDropdown) dissolves: this page
// IS the /me index, the former sub-tabs are full-page siblings on their stable
// routes (they keep their current faces until their own F5 slices land).
// Anatomy: the shell fejléc (app/AppHeader.tsx, mezo-atry) → identity hero (in-level XP ring around
// the initial, name, equipped title chip, Lv · XP · 🔥 · 🪙, bio line) → the
// ÉLETCÉL-HERO (mezo-iizd.4: the active life goals' dimension chips + the engine's
// ↗ / → / ↘ counters, opening /me/goals) → the 6-tile mosaic
// with live bottom lines — Beállítások is a tile opening /me/beallitasok
// (hub-tile-reorg: the AI tiles moved to the Mezo hub, Értesítés + AI-napló under
// Beállítások).
// The hero used to be the WEIGHT goal's coral track (with GoalMiniCard's maintain→„tartás"
// rule) navigating to /me/goals/weight; mezo-iizd.4 retired that face — the weight goal's
// entry point is now the Súlycél row on the Célok hub (CelokPage), and the daily weight
// number stays on the mosaic's Súly tile.
// Honest states (en-audit §6) are the contract, not the face:
//  · the bio line renders only the bits that exist and vanishes at zero bits;
//    with nothing set at all the hero offers BiometricCard's own CTA instead,
//    so the write path survives the card's retirement;
//  · an unresolved/failed `today` never becomes a fabricated „0↗ · 0→ · 0↘" — the hero
//    falls back to the plain active-goal count (CelokPage's `todayHonest` idiom);
//  · no active life goal at all → no invented ring, just the ＋ Új cél door;
//  · null statistics render `—` in a mini-cell, never 0;
//  · a tile line vanishes while its source is unresolved/empty — no page ever
//    shows a fabricated number.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MCells, Mosaic, Tile, type MCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import {
  useBiometricProfile, useDecisions, useGamification, useLifeGoals, useLifeGoalToday,
  useGratitudeEntries, useHabitDay, useHabitSummary, usePeople, useProfile, useProgressionProfile, useSleep, useTitles, useWeight,
} from '@/data/hooks'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { DIMENSIONS, ARROW_GLYPH } from '@/features/me/logic/lifegoalLabels'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'
import { useTheme } from '@/app/ThemeProvider'
import { addDays, localDateString } from '@/shared/lib/dates'
import { hu1, huInt } from '@/shared/lib/huNum'

const THEME_LABEL = { light: 'világos', dark: 'sötét', auto: 'cirkadián' } as const

/** Signed Hungarian 1-decimal rate — `fmtSigned`'s sign rule with `hu1`'s comma separator
 *  (the prototype writes `−0,5`, never `-0.5`). */
const huSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${hu1(Math.abs(n))}`

export function EnHubPage() {
  const navigate = useNavigate()
  const { mode: themeMode } = useTheme()
  // F7.4 (mezo-d20.8.4.1): the progression moved HOME — the title chip and the
  // streak/coin stats deep-link to /me/growth/kituntetesek (StreakCard + TitlesSection,
  // mezo-rmi0.1: the Growth hub's sibling route, was the ?tab=awards deep link);
  // the two standalone sheets are retired.
  const [sheet, setSheet] = useState<'biometric' | 'energy' | null>(null)

  // ── identity hero ───────────────────────────────────────────────────
  const { user: profile } = useProfile()
  const { profile: gam } = useGamification()
  const { titles } = useTitles()
  const equipped = titles.find((t) => t.equipped)
  const xpPct = gam.xpForNext > 0 ? Math.min(100, Math.round((gam.xpInLevel / gam.xpForNext) * 100)) : 0
  const initial = (profile?.name ?? '').trim().charAt(0).toUpperCase()

  const { profile: biometric } = useBiometricProfile()
  // Split-TDEE door (me.md §9): BiometricCard was the only Én-side entry into the
  // shared EnergyBreakdownSheet. The row now lives inside BiometricSheet; null
  // bootstrap (engine not run) → no row, no fabricated number.
  const tdeeBreakdown = biometric != null ? buildTdeeBreakdown(biometric) : null
  const { weightLog, weightTrends } = useWeight()
  const latestKg = weightLog.length > 0 ? weightLog[weightLog.length - 1].value : null
  // MeBioRow's rule, verbatim: `·`-joined non-null bits, nothing at zero bits. Each bit is
  // guarded on its OWN field rather than on `biometric` alone (mezo-5cmq): the contract now
  // types every profile field nullable, so a present profile is no longer a promise that
  // birthDate/heightCm are filled — an unguarded read would print „null cm".
  const bioBits = [
    biometric?.birthDate ? `${ageFromBirthDate(biometric.birthDate)} év` : null,
    biometric?.heightCm != null ? `${biometric.heightCm} cm` : null,
    latestKg != null ? `${hu1(latestKg)} kg` : null,
    biometric?.bodyFatPct != null ? `${biometric.bodyFatPct}% testzsír` : null,
  ].filter((b): b is string => b !== null)

  // ── életcél-hero (mezo-iizd.4) ───────────────────────────────────────
  // A hero mostanáig a SÚLYCÉL adata volt és /me/goals/weight-re vitt — az Én-hubról így
  // semmi nem nyílt a /me/goals Célok hubra, pedig a spec D5 szerint a hosszú cél ott lakik.
  // A súlycél parancsnoksága a Célok hub saját sorára költözött (mezo-iizd.4, CelokPage);
  // a napi súly-szám a mozaik Súly-csempéjén marad.
  // A korábbi bare `useGoal()` hívás („a cache-t melegen tartjuk a `rate`-hez") ELDOBOTT
  // eredményű, és az indoklása sem állt: a `rate` a `weightTrends`-ból jön, a `weightLog`
  // cache-t a fenti `useWeight` már meghúzza, a súlycél parancsnoksága pedig a Célok hubra
  // költözött (mezo-iizd.4) — az Én-hubon semmi nem olvassa. Ezért kikerült.
  const rate = weightTrends.last4w.weeklyRate
  const { goals: lifeGoals, isPending: lifeGoalsPending } = useLifeGoals()
  const { today: lifeToday, isPending: lifeTodayPending, isError: lifeTodayError } = useLifeGoalToday()
  const activeGoals = lifeGoals.filter((g) => g.status === 'active')
  // `insufficient` kimarad: túl kevés adat sosem irány (a CelokPage/LifeGoalTile guardrailje).
  const arrows = lifeToday.goals.reduce(
    (acc, s) => { if (s.arrow !== 'insufficient') acc[s.arrow] += 1; return acc },
    { up: 0, flat: 0, down: 0 } as Record<'up' | 'flat' | 'down', number>,
  )
  // Feloldatlan/hibás `today` üres listája alakilag azonos a „még nincs iránya" esettel —
  // számolni belőle kitalált „0↗ · 0→ · 0↘"-t adna (CelokPage `todayHonest` idióma).
  const arrowsHonest = lifeTodayPending || lifeTodayError

  let goalCard: React.ReactNode = null
  if (!lifeGoalsPending && activeGoals.length > 0) {
    const cells: MCell[] = arrowsHonest
      ? [{ label: 'aktív cél', value: `${activeGoals.length}`, tone: 'coral' }]
      : [
          { label: 'emelkedik', value: `${ARROW_GLYPH.up} ${arrows.up}`, tone: 'sage' },
          { label: 'tartja', value: `${ARROW_GLYPH.flat} ${arrows.flat}`, tone: 'lav' },
          { label: 'csúszik', value: `${ARROW_GLYPH.down} ${arrows.down}`, tone: 'coral' },
        ]
    goalCard = (
      <button type="button" className="enh-goalcard enh-lgcard rise" style={{ '--d': '70ms' } as React.CSSProperties}
        aria-label="Célok" onClick={() => navigate('/me/goals')}>
        <div className="enh-goalhead">
          <span className="mz-eyebrow"><ClayIcon name="i-cel" size={15} /> Célok</span>
          <span className="enh-stch">{activeGoals.length} aktív</span>
        </div>
        <div className="enh-lgdims">
          {activeGoals.slice(0, 4).map((g) => (
            <span key={g.id} className={`lg-goalchip ${DIMENSIONS[g.dimension].cls}`}><i />{g.title}</span>
          ))}
        </div>
        <MCells cells={cells} />
      </button>
    )
  } else if (!lifeGoalsPending) {
    // Nincs aktív életcél — nincs kitalált gyűrű. Az ajtó a varázslóra nyílik.
    goalCard = (
      <button type="button" className="enh-newgoal rise" style={{ '--d': '70ms' } as React.CSSProperties}
        onClick={() => navigate('/me/goals/new')}>
        ＋ Új cél
      </button>
    )
  }

  // ── tile bottom lines — each from its page's own hook ────────────────
  const sulyLine = latestKg == null
    ? undefined
    : `${hu1(latestKg)} kg${rate !== 0 ? ` · ${huSigned(rate)} / hét` : ''}`

  const { lastNight } = useSleep()
  const alvasLine = lastNight == null
    ? undefined
    : `${hu1(lastNight.duration)} h${lastNight.quality != null ? ` · Q${lastNight.quality}` : ''}`

  const { data: progression } = useProgressionProfile()
  const growthBits = [
    progression?.traits.disciplinePct != null ? `${progression.traits.disciplinePct}% fegyelem` : null,
    progression != null && progression.traits.consistencyWeeks > 0 ? `${progression.traits.consistencyWeeks} hét` : null,
  ].filter((b): b is string => b !== null)
  const growthLine = growthBits.length > 0 ? growthBits.join(' · ') : undefined

  const todayIso = localDateString()
  const { data: gratitude, isPending: gratitudePending } = useGratitudeEntries(addDays(todayIso, -30), todayIso)
  const gratitudeStreak = gratitudePending ? 0 : gratitudeStreakDays(gratitude.map((e) => e.occurredOn), todayIso)
  const { data: decisions } = useDecisions()
  const openDecisions = decisions.filter((d) => d.reviewedAt === null).length
  const naploBits = [
    !gratitudePending && gratitudeStreak > 0 ? `${gratitudeStreak} napos hála-sorozat` : null,
    openDecisions > 0 ? `${openDecisions} nyitott döntés` : null,
  ].filter((b): b is string => b !== null)
  const naploLine = naploBits.length > 0 ? naploBits.join(' · ') : undefined

  const { people } = usePeople()
  const topPerson = [...people].sort((a, b) => b.mentionsThisWeek - a.mentionsThisWeek)[0]
  const emberekLine = people.length === 0
    ? undefined
    : topPerson != null && topPerson.mentionsThisWeek > 0
      ? `${topPerson.name} ${topPerson.mentionsThisWeek}× · e héten`
      : `${people.length} kapcsolat`

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
        {/* ===== identity hero ===== */}
        <div className="enh-idhero rise" data-kalauz-anchor="me-idhero" style={{ '--d': '0ms' } as React.CSSProperties}>
          <div className="enh-idring" style={{ '--xp': xpPct } as React.CSSProperties}
            role="img" aria-label={`Szint ${gam.level} — ${xpPct}% a következő szintig`}>
            <i aria-hidden="true">{initial}</i>
          </div>
          <div className="enh-nm">{profile?.name ?? ''}</div>
          <button type="button" className={equipped != null ? 'enh-titlech' : 'enh-titlech is-none'}
            aria-label={equipped != null ? `Viselt cím: ${equipped.name} — cím-bolt` : 'Cím-bolt'}
            onClick={() => navigate('/me/growth/kituntetesek')}>
            {equipped != null ? equipped.name : 'Válassz címet'}
          </button>
          <div className="enh-idstats">
            <span>Lv {gam.level}</span>
            <span>{huInt(gam.totalXp)} XP</span>
            <button type="button" className="enh-idstat" aria-label="Sorozat részletei"
              style={{ opacity: gam.streakAlive === false ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 3 }}
              onClick={() => navigate('/me/growth/kituntetesek')}><ClayIcon name="i-lang" size={13} /> {gam.streakDays} nap</button>
            <button type="button" className="enh-idstat" aria-label="Érme — címek"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
              onClick={() => navigate('/me/growth/kituntetesek')}><ClayIcon name="i-erme" size={13} /> {gam.coins}</button>
          </div>
          {bioBits.length > 0 ? (
            <button type="button" className="enh-bio" aria-label="Biometria szerkesztése"
              onClick={() => setSheet('biometric')}>
              {bioBits.join(' · ')}
            </button>
          ) : (
            /* zero bits: the bio line itself vanishes (MeBioRow's contract) — but the
               biometrics write path must not vanish with it, so the hero carries
               BiometricCard's own empty-state CTA copy instead. */
            <button type="button" className="enh-bio" onClick={() => setSheet('biometric')}>
              Állítsd be a biometriád
            </button>
          )}
        </div>

        {/* ===== goal card ===== */}
        {goalCard}

        {/* ===== 6-tile mosaic ===== */}
        <Mosaic>
          <Tile wash="sky" icon="i-suly" eyebrow="Súly" delayMs={130} className="enh-eb-sky"
            line={sulyLine} onClick={() => navigate('/me/weight')} aria-label="Súly" />
          <Tile wash="lav" icon="i-alvas" eyebrow="Alvás" delayMs={170} className="enh-eb-lav"
            line={alvasLine} onClick={() => navigate('/me/sleep')} aria-label="Alvás" />
          <Tile wash="lav" icon="i-growth" eyebrow="Growth" delayMs={210} className="enh-t-minta enh-eb-lav"
            line={growthLine} onClick={() => navigate('/me/growth')} aria-label="Growth" />
          <Tile wash="white" icon="i-naplo" eyebrow="Napló" delayMs={250} className="enh-t-kreed enh-eb-coral"
            line={naploLine} onClick={() => navigate('/me/naplo')} aria-label="Napló" />
          <Tile wash="rose" icon="i-emberek" eyebrow="Emberek" delayMs={290} className="enh-eb-rose"
            line={emberekLine} onClick={() => navigate('/me/people')} aria-label="Emberek" />
          <Tile wash="sage" icon="i-beallitas" eyebrow="Beállítások" delayMs={330} className="enh-eb-sage"
            line={`téma: ${THEME_LABEL[themeMode]}`} onClick={() => navigate('/me/beallitasok')} aria-label="Beállítások" />
          <Tile wide wash="gold" icon="i-rend" iconSize={34} eyebrow="Rutin" delayMs={370}
            line={rutinLine} onClick={() => navigate('/me/rutin')} aria-label="Rutin" />
        </Mosaic>
      </EntranceGroup>

      {sheet === 'biometric' && (
        <BiometricSheet onClose={() => setSheet(null)} profile={biometric}
          onExplainEnergy={tdeeBreakdown != null ? () => setSheet('energy') : undefined} />
      )}
      {sheet === 'energy' && tdeeBreakdown != null && (
        <EnergyBreakdownSheet breakdown={tdeeBreakdown} initial="base" onClose={() => setSheet(null)} />
      )}
    </div>
  )
}
