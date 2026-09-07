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

const WHAT_IS: Record<'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP', string> = {
  WEEKLY: 'Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  MONTHLY: 'Havonta a szakértői csapat átnézi a hónap egészét, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  BOOTSTRAP: 'Az első beolvasáskor a szakértői csapat átnézte a teljes eddigi történetedet, '
    + 'megvitatta egymás felvetéseit, a Szkeptikus kikérdezte őket, és Mezo döntött arról, '
    + 'mi került be a rólad szóló dossziéba.',
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
        <RoundCell n={4} label="Mezo dönt" value={`${stats.accepted} be · ${stats.rejected} el`} />
      </div>
    </div>
  )
}
