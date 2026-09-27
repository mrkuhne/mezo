import type { FactMuteReason, FactSource, PersonFact } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'
import { huMonthDay } from '@/shared/lib/dates'

/** A Tudástár hub MINDEN magyar szövege (S6, mezo-d6ivw.6) — a factCopy/roladCopy idióma:
 *  tiszta, tesztelt modul; a komponensek csak ebből olvasnak. Forrás: a jóváhagyott
 *  docs/design_2.0/prototypes/uveg-tudastar-hub.html (a negyedéves újraellenőrzés szóhasználata
 *  a valós ütemhez igazítva). */

const day = (iso: string | null) => (iso ? huMonthDay(iso.slice(0, 10)) : null)

export const VERB = {
  source: 'Honnan tudom?', unmute: 'Visszakapcsolom', mute: 'Elhallgattatom', forget: 'Elfelejtem',
  edit: 'Javítom', save: 'Mentés', cancel: 'Mégse', more: 'További műveletek', undo: 'Visszavonom',
} as const

export const TOAST = {
  muted: 'Elhallgattattam — megőrzöm, de nem használom',
  unmuted: 'Visszakapcsoltam — újra használhatom',
  forgotten: 'Végleg elfelejtve',
  undone: 'Visszavonva — minden a helyén',
  edited: 'Javítottam',
} as const

export const undoTitle = (label: string) => `Elfelejtettem: „${label}”`
export const undoSub = (computed: boolean) =>
  computed ? 'többé nem mutatom és nem használom' : 'ugyanebből a forrásból nem tanulom meg újra'

export function stripNote(kind: 'active' | 'muted' | 'effect'): string {
  if (kind === 'muted') return 'Elhallgattatva: megőrzöm, de semmire nem használom.'
  if (kind === 'effect') return 'Elhallgattatva nem mutatom és nem használom, de bármikor visszakapcsolhatod. Elfelejtve soha többé.'
  return 'Elhallgattatva megőrzöm, de semmire nem használom. Elfelejtve törlöm — pár másodpercig visszavonható.'
}

const WHY_LABEL: Record<FactMuteReason, string> = {
  user: 'te hallgattattad el', refuted: 'később nem igazolódott', superseded: 'felülírta egy újabb észrevétel',
}
export const WHY_ICON: Record<FactMuteReason, Icon3DName> = { user: 't-mute', refuted: 't-down', superseded: 't-history' }

export function whyText(reason: FactMuteReason, at: string | null): string {
  const d = day(at)
  if (!d) return WHY_LABEL[reason]
  return reason === 'superseded' ? `${WHY_LABEL.superseded}, ${d}` : `${WHY_LABEL[reason]} · ${d}`
}

export interface ObsStatusInput {
  recheckedAt: string | null
  confirmedAt: string
  factMutedReason: FactMuteReason | null
  factMutedAt: string | null
  replacesPatternId: string | null
}
export function obsStatus(o: ObsStatusInput): { text: string; tone: 'ok' | 'gold' | 'off' } {
  if (o.factMutedReason === 'superseded') return { text: whyText('superseded', o.factMutedAt), tone: 'off' }
  if (o.factMutedReason === 'refuted') return { text: `elhallgattatva · ${WHY_LABEL.refuted}`, tone: 'off' }
  if (o.factMutedReason === 'user') {
    const d = day(o.factMutedAt)
    return { text: `elhallgattatva · ${WHY_LABEL.user}${d ? `, ${d}` : ''}`, tone: 'off' }
  }
  if (o.replacesPatternId) return { text: `ez váltotta a régit · ${day(o.confirmedAt)}`, tone: 'gold' }
  if (o.recheckedAt) return { text: `legutóbb ellenőrizve ${day(o.recheckedAt)} · még igaz`, tone: 'ok' }
  return { text: `még nem ellenőriztem újra · megerősítve ${day(o.confirmedAt)}`, tone: 'ok' }
}

export const OBS_FILTERS = [['mind', 'Mind'], ['igaz', 'Még igaz'], ['felul', 'Felülírva'], ['elh', 'Elhallgattatva']] as const
export type ObsFilter = (typeof OBS_FILTERS)[number][0]

export const DRIFT_EYEBROW = {
  bothOn: 'A RÉGI IS BE VAN KAPCSOLVA',
  older: (confirmedAt: string) => `KORÁBBAN · MEGERŐSÍTVE ${String(day(confirmedAt)).toUpperCase()}`,
  bothOnLine: 'újra bekapcsoltad — mindkettőt használom',
} as const

export const HERO = {
  title: 'dolgot tud rólad Mezo', sub: 'és te döntöd el, mit használhat belőle.', on: 'bekapcsolva', off: 'elhallgattatva',
  /** No section is available to count (all failed / switched off): no number at all, never a 0. */
  unavailable: 'Most egyik szakaszt sem sikerült betölteni.',
} as const
export function heroNote(state: 'ok' | 'off' | 'partial'): string {
  if (state === 'off') return 'A társ most ki van kapcsolva: a tények, az észrevételek és a hatások most nem elérhetők, ezért a szám csak az embereket számolja.'
  if (state === 'partial') return 'Néhány szakasz most nem töltődött be, ezért a szám nélkülük áll.'
  return 'Egy észrevételt a belőle tanult ténnyel együtt egyszer számolok.'
}

export const TILE = { facts: 'Rólad', people: 'Emberek', observations: 'Észrevételek', effects: 'Hatások' } as const
export const tileSub = {
  facts: (on: number, muted: number) => `${on} bekapcsolva · ${muted} elhallgattatva`,
  people: (people: number, muted: number) => `${people} ember · ${muted} elhallgattatva`,
  observations: (holds: number, superseded: number, muted: number) => `${holds} még igaz · ${superseded} felülírva · ${muted} elhallgattatva`,
  effects: (people: number, events: number, muted: number) => `${people} ember · ${events} esemény · ${muted} elhallgattatva`,
}
export const TILE_STATE = {
  off: 'A társ most nincs bekapcsolva.',
  offFacts: 'A társ most nincs bekapcsolva — a tények most nem elérhetők.',
  error: 'Most nem sikerült betölteni.',
  retry: 'Újrapróbálom ›',
  loading: 'Betöltés…',
} as const

export const LINKS = {
  pending: (n: number) => `${n} javaslat vár rád a Rólad oldalon`,
  pendingSub: 'ott döntesz róluk',
  kategoriak: 'Kategóriák', kategoriakSub: 'ugyanennek a tudásnak a térképe',
  hogyan: 'Hogyan tanul?', hogyanSub: 'honnan jön, amit tud, és mi kerül a beszélgetésbe',
  dossier: 'A csapat véleménye rólad', dossierSub: 'a karakterek dossziéjában — ebben a körben csak megnézni lehet',
  teamSection: 'A csapatról',
} as const

export const lead = {
  facts: (total: number, topics: number, on: number, muted: number) => `${total} tény, ${topics} témában · ${on} bekapcsolva · ${muted} elhallgattatva`,
  people: (people: number, facts: number) => `${people} ember · ${facts} tény — ábécérendben, nincs rangsor. Keresni névre és arra is lehet, amit tudok róluk.`,
  observations: 'Amit a napjaidból vettem észre, és te megerősítetted — témák szerint. Negyedévente újra megnézem, igaz-e még.',
  effects: 'Milyenek a napjaid — hangulatban, energiában, nyugalomban —, amikor valaki vagy valami felbukkan bennük.',
} as const
export const FACTS_NOTE = 'Ami be van kapcsolva, azt a társ minden beszélgetésben és üzenetben tudja rólad.'
export const FOOT = {
  people: ['Az ember lapja változatlan', 'ott továbbra is kapcsolóval és „Visszavonom”-mal kezelheted ugyanezeket.'],
  observations: ['Javítani itt nem lehet', 'egy észrevétel a napjaidból számolódik — elhallgattatni vagy elfelejteni lehet. A belőle tanult mondatot a Tények között javíthatod.'],
  effects: ['Együttjárás, nem ok-okozat', 'azt mutatja, mi szokott együtt járni a napjaidban — nem azt, hogy mi okozza. Két külön jelzés: mennyire jár együtt (telt pöttyök), és mennyi nap támasztja alá (üres karikák).'],
} as const

export const SEARCH = {
  facts: 'Keresés a tények között…', people: 'Keresés név vagy tény szerint…',
  person: (name: string) => `Keresés ${name} tényei között…`,
  observations: 'Keresés az észrevételek között…', effects: 'Keresés ember vagy esemény szerint…',
} as const
export const noHits = (q: string) => `Nincs találat erre: „${q}”.`
export const CLEAR_SEARCH = 'Keresés törlése'
export const groupCount = (q: string, n: number) => (q.trim() ? `${n} találat` : String(n))
export const MUTED_GROUP = 'Elhallgattatott'
export const MUTED_HINT = { facts: 'megőrzöm, de semmire nem használom', effects: 'nem mutatom és nem használom' } as const
export const onHint = (n: number) => (n ? `${n} bekapcsolva` : '')

export const EMPTY = {
  personNone: 'Most egy tényt sem használok róla.',
  obsState: 'Ebben az állapotban most nincs észrevétel.',
  effectsPeople: 'Most egy emberről sem mutatok hatást.',
  effectsEvents: 'Most egy eseményről sem mutatok hatást.',
  facts: 'Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.',
  people: 'Még senkiről nem tudok semmit — ahogy mesélsz róluk, itt jelennek meg.',
  observations: 'Még nincs megerősített észrevétel.',
  effects: 'Még nincs elég nap ahhoz, hogy együttjárást mutassak.',
} as const

export const ORIGIN: Record<FactSource, string> = {
  pattern: 'Megerősített észrevételből tanultam — amikor az egyik változik, a másik jellemzően követi.',
  chat: 'A beszélgetéseitekből szűrtem ki.',
  manual: 'Te vetted fel kézzel.',
  weekly_review: 'A heti áttekintésből derült ki.',
  question: 'Egy kérdésre válaszoltál rá.',
}
export const CHIP: Record<FactSource, string> = {
  pattern: 'észrevételből', chat: 'beszélgetésből', manual: 'kézzel', weekly_review: 'heti áttekintésből', question: 'kérdésre válaszoltál',
}
export const OBS_ORIGIN = 'A napjaidból számoltam ki, és te erősítetted meg. Ezekből a napokból látszik:'
export const GO_TO_OBSERVATION = 'Az észrevétel, amiből tanultam ›'
export const SOURCE_EYEBROW = 'HONNAN TUDOM'
export const EVIDENCE_UNAVAILABLE = 'A részletes forrás most nem elérhető.'
export const reinforced = (n: number) => `${n}× visszaigazolva`
export const confirmedOn = (iso: string) => `megerősítve ${day(iso)}`

export function personFactOrigin(kind: PersonFact['sourceKind']): string {
  return kind === 'chat_turn' ? 'A beszélgetéseitekből szűrtem ki.' : 'Egy éjszakai jegyzetből szűrtem ki.'
}
export function personFactSub(kindLabel: string, f: Pick<PersonFact, 'sourceKind' | 'createdAt'>): string {
  return `${kindLabel} · ${f.sourceKind === 'chat_turn' ? 'chatből' : 'éjszakai jegyzetből'} · ${day(f.createdAt)}`
}
export const personRowSub = (on: number, muted: number) => ({ main: `${on} tény`, muted: muted ? `${muted} elhallgattatva` : '' })
export const PERSON_PAGE_LINK = 'A lapja ›'
export const personHead = (on: number, muted: number) => `${on} tény bekapcsolva${muted ? ` · ${muted} elhallgattatva` : ''}`

export const EFFECT_GROUPS = { people: 'Emberek', peopleHint: 'ábécérendben', events: 'Események', eventsHint: 'erősség szerint' } as const
export const effectSubjectKindLabel = (kind: 'person' | 'event', n: number) => `${kind === 'person' ? 'ember' : 'esemény'} · ${n} jelzés`
export const EFFECT_SIGNAL = { strength: 'EGYÜTTJÁRÁS', confidence: 'BIZONYOSSÁG', foot: 'Együttjárás, nem ok-okozat.' } as const
export const DEGRADED = {
  facts: 'A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.',
  section: 'A társ most nincs bekapcsolva — ez a szakasz most nem elérhető.',
  error: 'Most nem sikerült betölteni ezt a szakaszt.',
  loading: 'A szakasz betöltése…',
} as const
