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
import type { ConferenceThread } from '@/data/character/characterApi'

// C1 (mezo-sp9w branch-review): only WEEKLY runs a cross-talk round — MONTHLY and BOOTSTRAP
// never do (CharacterMonthlyService / CharacterBootstrapService both assemble their stored
// envelope with an honestly empty reaction list, exactly because there is no such round for
// them). The WEEKLY copy is the only one allowed to say the team "megvitatja egymás
// felvetéseit" — the other two must not promise a debate that never happens.
const WHAT_IS: Record<'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP', string> = {
  WEEKLY: 'Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  MONTHLY: 'Havonta a szakértői csapat átnézi a hónap egészét, felvetéseit a Szkeptikus '
    + 'kikérdezi, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  BOOTSTRAP: 'Az első beolvasáskor a szakértői csapat átnézte a teljes eddigi történetedet, '
    + 'felvetéseit a Szkeptikus kikérdezte, és Mezo döntött arról, mi került be a rólad szóló '
    + 'dossziéba.',
}

export function KonziliumWhatIs({ kind }: { kind: 'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP' }) {
  return (
    <div className="kr-konzcard">
      <div className="kr-konzcap">Mi ez</div>
      <p className="kr-whatis">{WHAT_IS[kind]}</p>
    </div>
  )
}

function RoundCell({ n, label, value, hot }: { n: number; label: string; value: string; hot?: boolean }) {
  return (
    <div className={`kr-rst${hot === true ? ' hot' : ''}`}>
      <span className="kr-rn">{n}</span>
      <b>{label}</b>
      <i>{value}</i>
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
    <div className="kr-konzcard">
      <div className="kr-konzcap">Hogyan zajlott</div>
      <div className="kr-rail">
        <RoundCell n={1} label="Javaslat" value={`${stats.proposals} felvetés`} />
        <RoundCell n={2} label="Kereszt-vita" value={crossTalkValue} hot={crossTalkRan && stats.reactions > 0} />
        <RoundCell n={3} label="Szkeptikus" value={`${stats.skepticVerdicts} vizsgálat`} />
        {/* I1 (mezo-sp9w branch-review): this cell describes the meeting's DECISIONS, not dossier
            effects — "be" read as "bekerült" (admitted), but the count includes accepted
            retirements, which contradicts the outcome card's own "nyugdíjazva" label for the
            very same item. "elfogadva/elvetve" is true regardless of what kind of change a
            decision was. */}
        <RoundCell n={4} label="Mezo dönt" value={`${stats.accepted} elfogadva · ${stats.rejected} elvetve`} />
      </div>
    </div>
  )
}
