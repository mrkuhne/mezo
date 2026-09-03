// ============================================================
// Mezo · Karakter — Gépterem run copy (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html — `ejszakaLede`, `QUIET_LEDE`,
// `QUIET_MSG`, `NOT_CALLED_LINE`, `runRowHTML`. Every sentence here derives ONLY from the
// run's REAL counts on `CharacterRunSummary` (the plan's Global Constraints honesty rule) —
// never a fabricated number, never a call count for a kind the DTO doesn't track it for.
// ============================================================
import type { CharacterRunSummary } from '@/data/character/characterApi'
import { huMonthDay } from '@/shared/lib/dates'

export const KIND_BADGE: Record<CharacterRunSummary['kind'], string> = {
  NIGHTLY: 'ÉJSZAKAI',
  WEEKLY: 'HETI',
  MONTHLY: 'HAVI',
  BOOTSTRAP: 'BOOTSTRAP',
}

export const KIND_LABEL: Record<CharacterRunSummary['kind'], string> = {
  NIGHTLY: 'Éjszakai kör',
  WEEKLY: 'Konzílium',
  MONTHLY: 'Havi mélyolvasás',
  BOOTSTRAP: 'Bootstrap',
}

export const QUIET_LEDE = 'Csendes éjszaka — egyetlen jel sem tüzelt, senkit sem hívtunk.'
export const QUIET_MSG = 'Nulla LLM-hívás, nulla token, nulla költség. Ez nem hiányos futás — ez a '
  + 'rendszer pontosan azt csinálta, amit kell: nem talált ki jelet, ahol nem volt.'
export const NOT_CALLED_LINE = 'A többi szakértő ma nem kapott hívást — az ő jeleik a heti '
  + 'konzíliumon érkeznek.'
/** Final review (mezo-1gim.14, I3): a NIGHTLY run can have `observationCount === 0` while
 *  `detectorKeys` is non-empty — a catch-up re-run whose detectors fired but whose experts were
 *  skipped (e.g. the day's observations were already produced by an earlier run). That is NOT a
 *  quiet night (nothing fired) and must never render the proud QUIET_MSG page — it gets this
 *  distinct, honest line instead. */
export const CATCHUP_MSG = 'A jelek korábban már feldolgozásra kerültek — erre a futásra nincs új megfigyelés.'
/** FutasokPage's honest state for a day with NO run row at all (never a fabricated quiet
 *  night — a quiet night IS a real zero-count row and renders as its own proud row instead). */
export const MISSING_DAY_LINE = 'nincs adat erről az éjszakáról'
/** FutasokPage's honest state for a FUTURE day inside the browsed (current) week — there is no
 *  run row yet because the night hasn't happened, which is a different fact than
 *  {@link MISSING_DAY_LINE}'s "a past night that genuinely produced no row" (final review,
 *  mezo-1gim.14, M8). */
export const FUTURE_DAY_LINE = 'még nem jött el'

/** Final review (mezo-1gim.14, I3): the ONE quiet-night predicate — a NIGHTLY run is quiet only
 *  when NEITHER a detector fired NOR an observation was written. `observationCount === 0` alone
 *  is not enough (see CATCHUP_MSG above); shared here so the narrative hero, the run-detail page,
 *  and the Futások list row can never drift from each other. */
export function isQuietNightly(run: CharacterRunSummary): boolean {
  return run.kind === 'NIGHTLY' && run.observationCount === 0 && run.detectorKeys.length === 0
}

/** The catch-up counterpart of {@link isQuietNightly}: detectors fired but no observation came
 *  out of this run (see CATCHUP_MSG). */
export function isCatchUpNightly(run: CharacterRunSummary): boolean {
  return run.kind === 'NIGHTLY' && run.observationCount === 0 && run.detectorKeys.length > 0
}

// index = Date#getDay() (0=Sunday). Hungarian weekday ADJECTIVE forms ("hétfői napodat") —
// kept as a literal table rather than stemmed from HU_DOW_FULL (shared/lib/dates.ts), since
// the adjective suffix isn't a regular transform of the noun (kedd -> keddi, szerda -> szerdai).
const DOW_ADJECTIVE = ['vasárnapi', 'hétfői', 'keddi', 'szerdai', 'csütörtöki', 'pénteki', 'szombati']

function dowAdjective(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return DOW_ADJECTIVE[new Date(y, m - 1, d).getDay()]
}

/** The run-detail hero's narrative sentence — derives ONLY from the run's real counts.
 *  `expertName` resolves an expert key to its display name (CharacterExpertDto catalog);
 *  defaults to the raw key so this stays usable before the catalog has loaded. */
export function runHeroLede(run: CharacterRunSummary, expertName: (key: string) => string = (k) => k): string {
  if (run.kind === 'NIGHTLY') {
    if (isQuietNightly(run)) return QUIET_LEDE
    if (isCatchUpNightly(run)) {
      return `Átnéztük a ${dowAdjective(run.day)} napodat — ${CATCHUP_MSG}`
    }
    const names = run.expertKeys.map(expertName).join(', ')
    // I3 (final review): the ONLY real "jel" count on the DTO is `detectorKeys.length` —
    // observationCount is a signal ≠ observation count (fabricated before this fix); the
    // narrative now derives from a detector count, not the observation count doing double duty.
    return `Átnéztük a ${dowAdjective(run.day)} napodat — ${run.detectorKeys.length} detektor tüzelt, ebből `
      + `${run.observationCount} megfigyelés készült (${names}).`
  }
  if (run.kind === 'WEEKLY') {
    return `A hét ${run.observationCount} megfigyelését dolgoztuk fel a konzíliumon.`
  }
  if (run.kind === 'MONTHLY') {
    return `Havonta egyszer az egész eddigi képet újranézzük — ezúttal ${run.observationCount} `
      + 'állítást mérlegeltünk újra.'
  }
  return 'Ez volt az első nap — a csapat elolvasta a teljes addigi történetedet, és felépítette az '
    + `első portrékat (${run.observationCount} kezdő állítás).`
}

/** Futások list row's one-line count. BINDING RULING (task-4 brief): callCount is honest
 *  ONLY for NIGHTLY — conference-kind rows never surface a call number here either (their
 *  callCount is 0 by design, see characterMock.ts's ruling comment; the AI-napló row is the
 *  call-level truth for those kinds). */
export function runRowSubline(run: CharacterRunSummary): string {
  if (run.kind === 'NIGHTLY') {
    if (isQuietNightly(run)) return 'csendes nap · 0 hívás'
    if (isCatchUpNightly(run)) return 'jelek korábban feldolgozva'
    return `${run.observationCount} megfigyelés · ${run.expertKeys.length} szakértő hívva`
  }
  if (run.kind === 'WEEKLY') return `${run.observationCount} megfigyelés feldolgozva`
  if (run.kind === 'MONTHLY') return `${run.observationCount} állítás újramérlegelve`
  return `${run.observationCount} kezdő állítás`
}

/** KarakterHubPage's thin Gépterem row + GeptermPage hero — one plain-language line naming
 *  the most recent run. `undefined` when there is nothing to show (an empty range) — the hub
 *  row renders nothing rather than inventing a line. */
export function lastRunLine(run: CharacterRunSummary | undefined): string | undefined {
  if (run == null) return undefined
  return `${huMonthDay(run.day)}. · ${runRowSubline(run)}`
}
