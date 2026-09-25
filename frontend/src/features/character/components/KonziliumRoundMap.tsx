// ============================================================
// Mezo · Karakter — a Konzílium kontextus-rétege (mezo-sp9w)
// Két kártya, ami belépéskor megválaszolja a két kérdést, amire a szál-nézet nem tudott
// válaszolni: MI EZ, és HOGYAN ZAJLOTT.
//
// Őszinteség: a négy kör minden száma a megnyitott konzílium saját szálaiból számolódik
// (`deliberationStats`). Egy kör, ami nem hozott semmit, 0-t mutat — DE egy kör, ami akkor még
// nem is létezett (visszafejtett szál), "nem volt ilyen kör"-t, mert a 0 azt sugallná, hogy
// lefutott és senki nem szólt hozzá.
// ============================================================
import { deliberationStats } from '@/features/character/deliberationStats'
import type { ConferenceThread, CharacterConferenceSummary } from '@/data/character/characterApi'

// Daily and weekly editions run a cross-talk round — MONTHLY and BOOTSTRAP
// never do (CharacterMonthlyService / CharacterBootstrapService both assemble their stored
// envelope with an honestly empty reaction list, exactly because there is no such round for
// them). The WEEKLY copy is the only one allowed to say the team "megvitatja egymás
// felvetéseit" — the other two must not promise a debate that never happens.
const WHAT_IS: Record<CharacterConferenceSummary['kind'], string> = {
  DAILY: 'Naponta a csapat átnézi az új megfigyeléseket, megbeszéli a felvetéseket, és jelzi, mire jutott. Ha nincs érdemi újdonság, nem készít új történetet.',
  WEEKLY: 'Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  MONTHLY: 'Havonta a szakértői csapat átnézi a hónap egészét, felvetéseit a Szkeptikus '
    + 'kikérdezi, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  BOOTSTRAP: 'Az első beolvasáskor a szakértői csapat átnézte a teljes eddigi történetedet, '
    + 'felvetéseit a Szkeptikus kikérdezte, és Mezo döntött arról, mi került be a rólad szóló '
    + 'dossziéba.',
}

/** Üvegesítés U9 (mezo-me75u.9): a „Mi ez” bekezdés sima bevezető szöveg — nem kártya (bible §3). */
export function KonziliumWhatIs({ kind }: { kind: CharacterConferenceSummary['kind'] }) {
  return <p className="kz-lede">{WHAT_IS[kind]}</p>
}

type RoundAccent = 'lav' | 'sky' | 'slate' | 'sage'

/** Egy kör: lapos `tf-case` kártya, a kör sorszáma + neve `tf-st` chipben, az értéke nagy sorban.
 *  A kiemelt (hot) kereszt-vita kör kap fényt — a többi csendes. */
function RoundCell({ n, label, value, accent, hot }: {
  n: number
  label: string
  value: string
  accent: RoundAccent
  hot?: boolean
}) {
  return (
    <div className={`tf-case tf-flatc kz-round tf-s-${accent}${hot === true ? ' hot' : ''}`}>
      <span className="tf-crow"><span className="tf-st">{`${n} · ${label}`}</span></span>
      <span className="kz-rval">{value}</span>
    </div>
  )
}

export function KonziliumRoundMap({ threads, crossTalkRan }: {
  threads: ConferenceThread[] | null
  crossTalkRan: boolean
}) {
  const stats = deliberationStats(threads)
  const crossTalkValue = crossTalkRan ? `${stats.reactions} hozzászólás` : 'nem volt ilyen kör'
  return (
    <div className="kz-rounds">
      <div className="tf-sec"><h2>Hogyan zajlott</h2><span className="tf-hint">4 forduló</span></div>
      <div className="tf-rows">
        <RoundCell n={1} label="Javaslat" accent="lav" value={`${stats.proposals} felvetés`} />
        <RoundCell n={2} label="Kereszt-vita" accent="sky" value={crossTalkValue} hot={crossTalkRan && stats.reactions > 0} />
        <RoundCell n={3} label="Szkeptikus" accent="slate" value={`${stats.skepticVerdicts} vizsgálat`} />
        {/* I1 (mezo-sp9w branch-review): this cell describes the meeting's DECISIONS, not dossier
            effects — "be" read as "bekerült" (admitted), but the count includes accepted
            retirements, which contradicts the outcome card's own "nyugdíjazva" label for the
            very same item. "elfogadva/elvetve" is true regardless of what kind of change a
            decision was. */}
        <RoundCell n={4} label="Mezo dönt" accent="sage" value={`${stats.accepted} elfogadva · ${stats.rejected} elvetve`} />
      </div>
    </div>
  )
}
