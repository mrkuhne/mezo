/** HU copy + pacing for the NightPage calm tools (spec D6). No audio assets by design. */

export interface ScanStep { part: string; text: string }

export const BODY_SCAN_STEP_MS = 40_000
export const BODY_SCAN_STEPS: ScanStep[] = [
  { part: 'A fejbőröd', text: 'Kezdd legfelül. Érezd a fejbőröd — engedd, hogy a homlokod kisimuljon.' },
  { part: 'Az arcod', text: 'Lazítsd el az állkapcsod, a nyelved essen el a szájpadlásról. A szemhéjad nehéz.' },
  { part: 'A vállaid', text: 'Engedd le őket a füledtől. Vedd észre, hol tartasz feszültséget — és kilégzéssel hagyd, hogy kioldódjon.' },
  { part: 'A karjaid', text: 'A felkartól az ujjbegyekig. Nehezek, melegek, elengedettek.' },
  { part: 'A mellkasod', text: 'Figyeld a légzésed — nem irányítod, csak nézed, ahogy jön és megy.' },
  { part: 'A hasad', text: 'Engedd el a hasfalad. A lélegzet hulláma szabadon mozog.' },
  { part: 'A hátad', text: 'Érezd, ahogy a matrac megtart. Minden kilégzéssel jobban belesüllyedsz.' },
  { part: 'A csípőd és a combjaid', text: 'Nehezek és melegek. Az ágy tart téged — neked már nem kell.' },
  { part: 'A lábszárad', text: 'A vádlid puha, a bokád laza. A feszültség lefelé csorog és elfogy.' },
  { part: 'A lábfejed', text: 'A talpadtól a lábujjakig. Az egész tested nehéz, meleg, nyugodt.' },
]

export const WALK_CARD_MS = 90_000
export const WALK_SETUP = {
  title: 'Válassz egy jól ismert utat',
  text: 'A séta a házatok körül, az út a régi iskolába, egy ösvény, amit ezerszer bejártál. Indulj el rajta — fejben, lépésről lépésre.',
}
export const WALK_CARDS: string[] = [
  '„Meséld magadnak, mint egy filmet — 4K-ban. Milyen színű a kapu? Mit hallasz? Milyen a levegő?"',
  '„Haladj lassan. Egy-egy részletnél időzz el — a járda mintázata, egy ismerős fa, a fény az ablakokon."',
  '„Ha elkalandozol, csak térj vissza az útra. Nem baj — ez a séta lényege."',
]
