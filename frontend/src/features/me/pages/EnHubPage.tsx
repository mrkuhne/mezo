// ============================================================
// Mezo · EnHubPage — the Én tab's hub Mozaik face (mezo-d20.6.1)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html hub section
// (values ×1.18). The Me shell (AppHero + SubNavDropdown) dissolves: this page
// IS the /me index, the former sub-tabs are full-page siblings on their stable
// routes (they keep their current faces until their own F5 slices land).
// Anatomy: the shell fejléc (app/AppHeader.tsx, mezo-atry) → identity hero (in-level XP ring around
// the initial, name, equipped title chip, Lv · XP · 🔥 · 🪙, bio line) → the
// coral-ringed GOAL CARD (animated track + Hátra/Tempó/ETA cells) → the 6-tile mosaic
// with live bottom lines — Beállítások is a tile opening /me/beallitasok
// (hub-tile-reorg: the AI tiles moved to the Mezo hub, Értesítés + AI-napló under
// Beállítások).
// Honest states (en-audit §6) are the contract, not the face:
//  · the bio line renders only the bits that exist and vanishes at zero bits;
//    with nothing set at all the hero offers BiometricCard's own CTA instead,
//    so the write path survives the card's retirement;
//  · a maintain goal (total range 0) drops the track and reads „tartás" —
//    GoalMiniCard's rule, verbatim;
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
  useBiometricProfile, useDecisions, useGamification, useGoal,
  useGratitudeEntries, usePeople, useProfile, useProgressionProfile, useSleep, useTitles, useWeight,
} from '@/data/hooks'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'
import { etaWeeks } from '@/features/me/logic/weightStats'
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
  const { user } = useProfile()
  const { profile: gam } = useGamification()
  const { titles } = useTitles()
  const equipped = titles.find((t) => t.equipped)
  const xpPct = gam.xpForNext > 0 ? Math.min(100, Math.round((gam.xpInLevel / gam.xpForNext) * 100)) : 0
  const initial = user.name.trim().charAt(0).toUpperCase()

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

  // ── goal card ───────────────────────────────────────────────────────
  const { goal, goalResponse, pending: goalPending } = useGoal()
  const rate = weightTrends.last4w.weeklyRate
  let goalCard: React.ReactNode = null
  if (!goalPending && goal != null && goalResponse != null) {
    // Signed math so bulk (negative/negative) still lands in 0..100; maintain (total 0)
    // hides the track and reads „tartás" — GoalMiniCard's contract.
    const total = goal.startWeight - goal.targetWeight
    const progressed = goal.startWeight - goal.currentWeight
    const p = total !== 0 ? Math.min(100, Math.max(0, (progressed / total) * 100)) : 0
    const remaining = Math.abs(goal.currentWeight - goal.targetWeight)
    const eta = etaWeeks(goal.currentWeight, goal.targetWeight, rate)
    // The prototype eyebrow is „trajektória · cím"; a seeded title that already opens with its
    // own trajectory („Fogyás · Nyári forma") must not be prefixed twice.
    const trajectory = TRAJECTORY_LABEL[goalResponse.trajectory]
    const goalHeadline = goalResponse.title.toLowerCase().startsWith(trajectory.toLowerCase())
      ? goalResponse.title
      : `${trajectory} · ${goalResponse.title}`
    const cells: MCell[] = total !== 0
      ? [
          { label: 'hátra', value: `${hu1(remaining)} kg`, tone: 'coral' },
          { label: 'kg / hét', value: rate !== 0 ? huSigned(rate) : '—', tone: 'sage' },
          { label: 'eta', value: eta != null ? `${eta} hét` : '—', tone: 'lav' },
        ]
      : [{ label: 'kg / hét', value: rate !== 0 ? huSigned(rate) : '—', tone: 'sage' }]
    goalCard = (
      <button type="button" className="enh-goalcard rise" style={{ '--d': '70ms' } as React.CSSProperties}
        aria-label="Hosszú cél" onClick={() => navigate('/me/goals')}>
        <div className="enh-goalhead">
          <span className="mz-eyebrow">🎯 {goalHeadline}</span>
          <span className="enh-stch">{total !== 0 ? `${Math.round(p)}% a célig` : 'tartás'}</span>
        </div>
        {total !== 0 && (
          <>
            <div className="enh-gtrack" style={{ '--p': `${p}%` } as React.CSSProperties}>
              <div className="fill" />
              <i className="dot" />
            </div>
            <div className="enh-gtlbl">
              <span>{hu1(goal.startWeight)}</span>
              <b>{hu1(goal.currentWeight)} most</b>
              <span>{hu1(goal.targetWeight)} cél</span>
            </div>
          </>
        )}
        <MCells cells={cells} />
      </button>
    )
  } else if (!goalPending) {
    // No active goal — no fabricated track. The door to /me/goals stays open, which is
    // where the real ghost state + the „＋ Új cél" planner CTA live.
    goalCard = (
      <button type="button" className="enh-newgoal rise" style={{ '--d': '70ms' } as React.CSSProperties}
        onClick={() => navigate('/me/goals')}>
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

  return (
    <div className="enh-hub">
      <EntranceGroup className="mz-panel-stack">
        {/* ===== identity hero ===== */}
        <div className="enh-idhero rise" data-kalauz-anchor="me-idhero" style={{ '--d': '0ms' } as React.CSSProperties}>
          <div className="enh-idring" style={{ '--xp': xpPct } as React.CSSProperties}
            role="img" aria-label={`Szint ${gam.level} — ${xpPct}% a következő szintig`}>
            <i aria-hidden="true">{initial}</i>
          </div>
          <div className="enh-nm">{user.name}</div>
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
