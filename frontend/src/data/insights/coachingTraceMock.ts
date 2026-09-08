import { addDays, localDateString } from '@/shared/lib/dates'
import type { CoachingRule, CoachingTraceDay } from '@/data/types'

/**
 * The demo observer day (mezo-6269.2, spec 2026-09-05 §5). The companion feed mock is `[]`, so
 * without this the observer pages are blank in `pnpm dev` and in the visual job. Deliberately
 * exercises ALL FIVE screen states — Jelzett, Rendben, Nem mérhető, Pihenőn, Nyertes — plus two
 * transitions, so a rendering regression in any one of them shows up in a golden.
 */
const RULES: Omit<CoachingRule, 'changedAt'>[] = [
  { flagKey: 'acute_bad_day', label: 'Rossz nap', domain: 'recovery', rank: 1,
    outcome: 'clear', reasonText: '1,0 rossz check-in ma — a jelzéshez 2,0 kellene.',
    facts: ['1,0 rossz check-in ma — a jelzéshez 2,0 kellene.', 'Mért érték: 1,0 · küszöb: 2,0'] },
  { flagKey: 'load_fuel_mismatch', label: 'Terhelés–táplálás', domain: 'nutrition', rank: 2,
    outcome: 'raised', disposition: 'logged', cardOutcome: 'won',
    reasonText: '7 napos terhelés 412 perc, kcal a cél 71%-án',
    facts: ['7 napos terhelés 412 perc, kcal a cél 71%-án', 'Alvásátlag: 6,8 óra (padló 7,0 óra)'] },
  { flagKey: 'rapid_weight_loss', label: 'Gyors fogyás', domain: 'body', rank: 3,
    outcome: 'unavailable', reasonCode: 'no_active_goal',
    reasonText: 'Nincs aktív cél — a trajektória nem olvasható.', facts: [] },
  { flagKey: 'joint_overuse', label: 'Vállterhelés', domain: 'training', rank: 4,
    outcome: 'clear', reasonText: 'A holnapi edzés nem vállfókuszú (láb).',
    facts: ['A holnapi edzés nem vállfókuszú (láb).'] },
  { flagKey: 'missed_workouts', label: 'Kimaradt edzések', domain: 'training', rank: 5,
    outcome: 'clear', reasonText: 'A leghosszabb kihagyott sorozat 1,0 nap — a jelzéshez 3,0 kellene.',
    facts: ['A leghosszabb kihagyott sorozat 1,0 nap — a jelzéshez 3,0 kellene.',
      'Mért érték: 1,0 · küszöb: 3,0'] },
  { flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
    outcome: 'raised', disposition: 'logged', cardOutcome: 'lost',
    // Mirrors backend FlagFactRenderer.sleepDebt VERBATIM — keep the two in sync by hand, there
    // is no gate comparing them. This fixture froze the pre-fix copy ("1,4 óra/éjszaka") and drifted:
    // that number is the WINDOW TOTAL, so the per-night unit made the mock-mode observer state
    // something false, and mock mode is the DEFAULT (bd mezo-btmc + the mock-parity issue).
    reasonText: 'Alvásadósság: összesen 1,4 óra hiány a rögzített éjszakákon '
      + '(átlagosan 0,2 óra/éjszaka, cél 8,0 óra/éjszaka, 6 rögzített éjszaka a 7 közül)',
    facts: ['Alvásadósság: összesen 1,4 óra hiány a rögzített éjszakákon '
      + '(átlagosan 0,2 óra/éjszaka, cél 8,0 óra/éjszaka, 6 rögzített éjszaka a 7 közül)'] },
  { flagKey: 'logging_gap', label: 'Rögzítési hiány', domain: 'logging', rank: 7,
    outcome: 'clear', reasonText: '1,0 elavult napló — a jelzéshez 2,0 kellene (étkezés).',
    facts: ['1,0 elavult napló — a jelzéshez 2,0 kellene (étkezés).', 'Mért érték: 1,0 · küszöb: 2,0'] },
  { flagKey: 'ignored_nudge', label: 'Elengedett emlékeztető', domain: 'sleep', rank: 8,
    outcome: 'unavailable', reasonCode: 'no_sleep_goal_row',
    reasonText: 'Nincs alváscél rögzítve — a lefekvési horgony ismeretlen.', facts: [] },
  { flagKey: 'late_eating', label: 'Késői evés', domain: 'nutrition', rank: 9,
    outcome: 'raised', disposition: 'suppressed_by_cooldown',
    reasonText: 'Késői vacsora 3 napból 2-n (küszöb: lefekvés előtt 120 perc)',
    facts: ['Késői vacsora 3 napból 2-n (küszöb: lefekvés előtt 120 perc)'] },
  { flagKey: 'protocol_lapse', label: 'Kihagyott protokoll', domain: 'nutrition', rank: 10,
    outcome: 'clear', reasonText: '1,0 kihagyott esedékes nap a Magnézium-ra — a jelzéshez 2,0 kellene.',
    facts: ['1,0 kihagyott esedékes nap a Magnézium-ra — a jelzéshez 2,0 kellene.',
      'Mért érték: 1,0 · küszöb: 2,0'] },
  { flagKey: 'recovery_needed', label: 'Regeneráció kell', domain: 'recovery', rank: 11,
    outcome: 'clear', reasonText: '2,0 regenerációs jel a szükséges 3,0-ból (hiányzik: stressz).',
    facts: ['2,0 regenerációs jel a szükséges 3,0-ból (hiányzik: stressz).',
      'Mért érték: 2,0 · küszöb: 3,0'] },
  { flagKey: 'sustained_stress', label: 'Tartós stressz', domain: 'recovery', rank: 12,
    outcome: 'clear', reasonText: '1,0 nap a stresszküszöb fölött — a jelzéshez 3,0 kellene.',
    facts: ['1,0 nap a stresszküszöb fölött — a jelzéshez 3,0 kellene.', 'Mért érték: 1,0 · küszöb: 3,0'] },
  { flagKey: 'momentum_at_risk', label: 'Lendület veszélyben', domain: 'habits', rank: 13,
    outcome: 'unavailable', reasonCode: 'no_habit_baseline',
    reasonText: 'Nincs szokás-alapvonal — nincs honnan visszaesni.', facts: [] },
  { flagKey: 'all_healthy', label: 'Minden rendben', domain: 'habits', rank: 14,
    outcome: 'clear', reasonText: 'Ma más szabály jelzett, így a „minden rendben" nem áll fenn.',
    facts: ['Ma más szabály jelzett, így a „minden rendben" nem áll fenn.'] },
]

/** The demo day for `date`. Timestamps are anchored to that day so the pager reads sensibly. */
export function mockCoachingDay(date: string): CoachingTraceDay {
  return {
    date,
    // Anchored to TODAY, not to `date` (the day being viewed): the floor must be a fixed point
    // in time so paging back can actually reach it. Anchoring to `date` made `canBack = date >
    // earliestDate` (= `date > date-13`) always true — the floor was unreachable, in every
    // golden and in `pnpm dev` alike. It also can't be a fixed calendar literal, because the
    // visual harness freezes the clock in a different month (MAY) — a fixed August floor was
    // dead there too. `localDateString()` (today, at call time) is neither: a real 13-day-back
    // boundary that moves with the clock the harness actually runs under.
    earliestDate: addDays(localDateString(), -13),
    winner: { flagKey: 'load_fuel_mismatch', rank: 2, cardId: 'mock-card-1' },
    rules: RULES.map((rule) => ({ ...rule, changedAt: `${date}T07:00:00Z` })),
    transitions: [
      { at: `${date}T07:00:00Z`, flagKey: 'load_fuel_mismatch', label: 'Terhelés–táplálás',
        from: 'clear', to: 'raised', reasonText: 'A szabály jelzett.' },
      { at: `${date}T14:00:00Z`, flagKey: 'late_eating', label: 'Késői evés',
        from: 'raised', to: 'suppressed',
        reasonText: 'A szabály igaz, de nemrég szólt már — most csendben maradt.' },
    ],
  }
}
