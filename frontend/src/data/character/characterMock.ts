// Mock seeds for the Karakter dossier (mezo-1gim.13) — mirrored VERBATIM from the approved
// v2.2 prototype, docs/design_2.0/prototypes/src/karakter-body.html (search `var DIMS`,
// `var CSAPAT`, `var FEED`, `var KONZ`, `var TRANSCRIPT`), mapped onto the real backend DTO
// shapes from api.gen.ts. Confidence is stored as the NUMBER that produces the prototype's
// displayed word through confidenceWord()'s 0.75/0.5 thresholds — never the word itself.
import type {
  CharacterClaimDto,
  CharacterConferenceResponse,
  CharacterConferenceSummary,
  CharacterDimensionResponse,
  CharacterDimensionSummary,
  CharacterExpertDto,
  CharacterFeedItem,
  CharacterOverviewResponse,
  ConferenceTurn,
} from '@/data/character/characterApi'

// conf tier -> a representative number that maps back to the same word via confidenceWord().
const BIZTOS = 0.8
const VALOSZINU = 0.6
const FIGYELJUK = 0.35

interface ExpertColors {
  name: string
  role: string
  voiceLine: string
  watch: string[]
  color: string
  wash: string
}

// EXPERTS (prototype's `var EXPERTS`) — the 7 CORE-dimension owners, plus watch/voice copy from
// `var CSAPAT`. Colors/wash aren't part of the DTO (that's a FE styling concern the components
// derive elsewhere) but are kept here as the one place the mock's visual identity lives.
export const CHARACTER_EXPERTS: Record<string, ExpertColors> = {
  doki: {
    name: 'Doki',
    role: 'orvos',
    voiceLine: 'Tárgyilagos, orvosi hangon, röviden fogalmaz.',
    watch: ['testkompozíció, egészségjelek', 'súlytrend', 'gyógyszerciklus jelei'],
    color: '#3E7396',
    wash: '#DCEBF4',
  },
  edzo: {
    name: 'Edző',
    role: 'edzés',
    voiceLine: 'Direkt, számokban beszél.',
    watch: ['edzésprofil, erősségek-gyengeségek', 'RIR-kalibráció', 'niggle-mintázatok'],
    color: '#A84A26',
    wash: '#FFE3D4',
  },
  taplalkozo: {
    name: 'Táplálkozó',
    role: 'táplálkozás',
    voiceLine: 'Gyakorlatias, ítélkezésmentes.',
    watch: ['étkezési minták', 'kajához való viszony', 'logolt vs valós bevitel eltérése'],
    color: '#4E6B42',
    wash: '#E4EEDD',
  },
  szomnologus: {
    name: 'Szomnológus',
    role: 'alvás & regeneráció',
    voiceLine: 'Halk, precíz hangon ír.',
    watch: ['alvásminőség és -ritmus', 'regenerációs jelek'],
    color: '#5D4FA0',
    wash: '#EBE6F8',
  },
  pszichologus: {
    name: 'Pszichológus',
    role: 'mentális',
    voiceLine: 'Meleg, kérdező hangon ír.',
    watch: ['hangulati mintázatok', 'stresszorok', 'a napló érzelmi jelei'],
    color: '#8E3F6F',
    wash: '#FAE3ED',
  },
  drill: {
    name: 'Drill',
    role: 'fegyelem',
    voiceLine: 'Szigorú, de fair — sosem szégyenít.',
    watch: ['logolási fegyelem, kihagyások', 'streak-viselkedés', 'ígéret–teljesítés rés'],
    color: '#A8801F',
    wash: '#FBEBCB',
  },
  antropologus: {
    name: 'Antropológus',
    role: 'élet & kapcsolatok',
    voiceLine: 'Megfigyelő, narratív hangon ír.',
    watch: ['életesemények, emberek', 'hétköznap–hétvége minták', 'kontextus'],
    color: '#2E7D6B',
    wash: '#DCEFE9',
  },
  szkeptikus: {
    name: 'Szkeptikus',
    role: 'kontra',
    voiceLine: 'Száraz kontrás hang.',
    // Fix round (final review, I4): missing the backend's trailing period
    // (CharacterService.experts()) — a bare mock/backend byte-diff on text the FE never
    // touches, so it silently drifted.
    watch: [
      'minden javaslatot megtámad, mielőtt a dossziéba kerül — gyenge bizonyíték, túlzott ' +
        'általánosítás, egy adatpontból levont következtetés.',
    ],
    color: '#4A4038',
    wash: '#E4DED4',
  },
  // Fix round (final review, I4): `role` must match CharacterService.experts()'s literal
  // "Elnök · Integrátor" (exact casing) — the mock had it lowercased. `watch` was empty here
  // though the backend serves one entry for Mezo too; `voiceLine` is left as this mock's own
  // distinct copy (CsapatPage's CHAIR subtitle already renders off `role`, never `voiceLine`,
  // so this text isn't a duplicate-on-screen concern — see CsapatPage.tsx's header comment).
  mezo: {
    name: 'Mezo',
    role: 'Elnök · Integrátor',
    voiceLine: 'ő összegez feléd — a csapat az ő fejében dolgozik.',
    watch: ['ő összegez feléd — a csapat az ő fejében dolgozik.'],
    color: '#FF5B36',
    wash: '#FFE0D4',
  },
}

// The 9-persona catalog for the Csapat page, in catalog order (7 experts, szkeptikus, mezo) —
// mirrors CharacterExpertDto exactly. `dimensionKey` null for szkeptikus/mezo (not CORE owners).
const EXPERT_ORDER = [
  'doki',
  'edzo',
  'taplalkozo',
  'szomnologus',
  'pszichologus',
  'drill',
  'antropologus',
] as const

export const MOCK_EXPERTS: CharacterExpertDto[] = [
  ...EXPERT_ORDER.map(
    (key): CharacterExpertDto => ({
      key,
      displayName: CHARACTER_EXPERTS[key].name,
      role: CHARACTER_EXPERTS[key].role,
      voiceLine: CHARACTER_EXPERTS[key].voiceLine,
      watch: CHARACTER_EXPERTS[key].watch,
      dimensionKey: key,
      kind: 'EXPERT',
    }),
  ),
  {
    key: 'szkeptikus',
    displayName: CHARACTER_EXPERTS.szkeptikus.name,
    role: CHARACTER_EXPERTS.szkeptikus.role,
    voiceLine: CHARACTER_EXPERTS.szkeptikus.voiceLine,
    watch: CHARACTER_EXPERTS.szkeptikus.watch,
    dimensionKey: null,
    kind: 'SKEPTIC',
  },
  {
    key: 'mezo',
    displayName: CHARACTER_EXPERTS.mezo.name,
    role: CHARACTER_EXPERTS.mezo.role,
    voiceLine: CHARACTER_EXPERTS.mezo.voiceLine,
    watch: CHARACTER_EXPERTS.mezo.watch,
    dimensionKey: null,
    kind: 'CHAIR',
  },
]

function claim(
  dimKey: string,
  i: number,
  text: string,
  conf: number,
  opts?: { sensitive?: boolean; proposedBy?: string },
): CharacterClaimDto {
  return {
    id: `${dimKey}-claim-${i}`,
    text,
    confidence: conf,
    sensitive: opts?.sensitive ?? false,
    proposedBy: opts?.proposedBy,
    evidence: [{ kind: 'observation', label: text.length > 60 ? `${text.slice(0, 57)}...` : text }],
  }
}

interface DimSeed {
  key: string
  title: string
  kind: 'CORE' | 'CHAPTER'
  expertKey: string | null
  maturity: number
  portrait: string
  claims: CharacterClaimDto[]
}

// DIMS (prototype's `var DIMS`) — the 7 CORE dimensions + 1 CHAPTER, portraits and claims
// copied verbatim; confidence words -> numbers via the tiers above.
const DIM_SEEDS: DimSeed[] = [
  {
    key: 'physical',
    title: 'Fizikai',
    kind: 'CORE',
    expertKey: 'doki',
    maturity: 58,
    portrait:
      'A testösszetételed lassan, de biztosan javul — a testzsír-trend nagyjából három hónap alatt ' +
      'csökken, miközben a testsúlyod közben gyakorlatilag helyben áll. Ez arra utal, hogy a ' +
      'hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.',
    claims: [
      claim('physical', 0, 'A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.', BIZTOS, { proposedBy: 'doki' }),
      claim('physical', 1, 'A gyógyszerciklus hetei egyelőre nem mutatnak kimutatható hatást a súlytrenden.', FIGYELJUK, { sensitive: true, proposedBy: 'doki' }),
      claim('physical', 2, 'A reggeli mérések szórása alacsony — a mérési fegyelmed stabil alapot ad a trendnek.', VALOSZINU, { proposedBy: 'doki' }),
    ],
  },
  {
    key: 'athletic',
    title: 'Sportolói',
    kind: 'CORE',
    expertKey: 'edzo',
    maturity: 71,
    portrait:
      'Az edzésprofilod tiszta: heti öt teremedzés és öt röplabda-alkalom, a hipertrófia-blokkok ' +
      'szisztematikusan haladnak MEV-től MRV felé. A legjobb heteid mindig azok, ahol a RIR-célok ' +
      'tartása szoros.',
    claims: [
      claim('athletic', 0, 'A RIR-kalibrációd megbízható — a becsléseid ritkán térnek el 1-nél többel a tényleges teljesítménytől.', BIZTOS, { proposedBy: 'edzo' }),
      claim('athletic', 1, 'A vállízület időnként jelez röplabda után — eddig mindig magától rendeződött néhány napon belül.', VALOSZINU, { sensitive: true, proposedBy: 'edzo' }),
      claim('athletic', 2, 'Hétvégi röplabda-meccsek utáni napokon rendszeresen elmarad a tervezett teremedzés.', VALOSZINU, { proposedBy: 'edzo' }),
    ],
  },
  {
    key: 'nutrition',
    title: 'Táplálkozási',
    kind: 'CORE',
    expertKey: 'taplalkozo',
    maturity: 45,
    portrait:
      'A táplálkozási mintád gyakorlatias: a hétköznapok stabilak, a hétvégék lazábbak. A fehérjecél ' +
      'hétköznap szinte mindig teljesül, hétvégén viszont gyakran alulmarad.',
    claims: [
      claim('nutrition', 0, 'Hétköznap a fehérjecélod szinte mindig teljesül.', VALOSZINU, { proposedBy: 'taplalkozo' }),
      claim('nutrition', 1, 'Hétvégén a logolási fegyelmed lazább — inkább kényelem, mint tudatos döntés.', FIGYELJUK, { proposedBy: 'taplalkozo' }),
      claim('nutrition', 2, 'A késői vacsorák és a másnapi alváshossz között összefüggést sejtünk — még korai kijelenteni.', FIGYELJUK, { proposedBy: 'taplalkozo' }),
    ],
  },
  {
    key: 'recovery',
    title: 'Alvás & regeneráció',
    kind: 'CORE',
    expertKey: 'szomnologus',
    maturity: 66,
    portrait:
      'Az alvásod ritmusa hétköznap stabil, a hétvégi eltolódás viszont rendszeres — átlagosan 40 ' +
      'perccel később fekszel le. A jó mélyalvású éjszakák és az edzésteljesítmény közötti kapcsolat ' +
      'egyre világosabb.',
    claims: [
      claim('recovery', 0, 'Hétvégén átlag 40 perccel később fekszel le, mint hétköznap.', BIZTOS, { proposedBy: 'szomnologus' }),
      claim('recovery', 1, 'Jó mélyalvású éjszakák után a másnapi edzésen jellemzően magasabb a teljesített volumen.', VALOSZINU, { proposedBy: 'szomnologus' }),
      claim('recovery', 2, 'A késő esti képernyőidő és az elalvási idő között gyenge, de következetes összefüggést látunk.', FIGYELJUK, { proposedBy: 'szomnologus' }),
    ],
  },
  {
    key: 'mental',
    title: 'Mentális & érzelmi',
    kind: 'CORE',
    expertKey: 'pszichologus',
    maturity: 39,
    portrait:
      'A naplóbejegyzéseid hangneme többnyire kiegyensúlyozott, a stresszcsúcsok jellemzően ' +
      'munkahetek végén jelennek meg. Még csak néhány hete figyelünk, ez inkább körvonal, mint kész kép.',
    claims: [
      claim('mental', 0, 'A hét vége felé gyakrabban írsz feszültségről a naplóban.', VALOSZINU, { proposedBy: 'pszichologus' }),
      claim('mental', 1, 'Az edzés utáni bejegyzések hangneme következetesen pozitívabb.', VALOSZINU, { proposedBy: 'pszichologus' }),
      claim('mental', 2, 'Néha halasztod a nehezebb érzelmi témák leírását.', FIGYELJUK, { sensitive: true, proposedBy: 'pszichologus' }),
    ],
  },
  {
    key: 'discipline',
    title: 'Motiváció & fegyelem',
    kind: 'CORE',
    expertKey: 'drill',
    maturity: 74,
    portrait:
      'A logolási fegyelmed erős — ritkán maradsz ki, és amikor mégis, gyorsan visszaállsz. Az ígéret ' +
      'és a teljesítés között kicsi a rés: amit kitűzöl egy hétre, azt többnyire be is tartod.',
    claims: [
      claim('discipline', 0, 'A logolási kihagyások ritkák, és 1–2 napon belül mindig helyreállnak.', BIZTOS, { proposedBy: 'drill' }),
      claim('discipline', 1, 'A kitűzött heti fókuszaid teljesítési aránya magas.', BIZTOS, { proposedBy: 'drill' }),
      claim('discipline', 2, 'Hosszabb kihagyás után egy kicsit óvatosabban indulsz vissza — ez természetes, nem gyengeség.', VALOSZINU, { proposedBy: 'drill' }),
    ],
  },
  {
    key: 'life',
    title: 'Élet & kapcsolatok',
    kind: 'CORE',
    expertKey: 'antropologus',
    maturity: 33,
    portrait:
      'Az életeseményeid és a kapcsolataid térképe még csak most rajzolódik ki. Petra a leggyakrabban ' +
      'említett személy, a hétvégéid jellemzően köré és a röplabda köré szerveződnek.',
    claims: [
      claim('life', 0, 'Petra a leggyakrabban említett személy a naplóban és a chatben.', VALOSZINU, { proposedBy: 'antropologus' }),
      claim('life', 1, 'A hétvégéid struktúrája a röplabda köré épül.', VALOSZINU, { proposedBy: 'antropologus' }),
      claim('life', 2, 'Munkahetek és utazások mintázatát még csak gyűjtjük.', FIGYELJUK, { proposedBy: 'antropologus' }),
    ],
  },
  {
    key: 'chapter-work',
    title: 'Munka-stressz ciklus',
    kind: 'CHAPTER',
    expertKey: null,
    maturity: 21,
    portrait:
      'Egy ismétlődő minta rajzolódik ki: amikor a munkahetek különösen sűrűek, három dolog együtt ' +
      'csúszik — a logolás, az esti lefekvés és a hangulat. A csapat ezt külön fejezetként nyitotta ' +
      'meg a vasárnapi konzíliumon — még korai szakasz.',
    claims: [
      claim('chapter-work', 0, 'Sűrű munkahetek után jellemzően egyszerre csúszik a logolás és a lefekvés.', FIGYELJUK),
      claim('chapter-work', 1, 'A ciklus egyelőre 3 megfigyelt esetből áll — korai szakasz, még nem elég egy szilárd szabályhoz.', FIGYELJUK),
    ],
  },
]

function toSummary(d: DimSeed): CharacterDimensionSummary {
  return {
    key: d.key,
    title: d.title,
    kind: d.kind,
    expertKey: d.expertKey,
    maturity: d.maturity,
    portrait: d.portrait,
    topClaims: d.claims.slice(0, 3),
  }
}

function toDimensionResponse(d: DimSeed): CharacterDimensionResponse {
  return {
    key: d.key,
    title: d.title,
    kind: d.kind,
    expertKey: d.expertKey,
    maturity: d.maturity,
    portrait: d.portrait,
    claims: d.claims,
    revisions: [{ version: 1, portrait: d.portrait, createdAt: '2026-08-30T09:00:00Z' }],
  }
}

/** Overview seed — full dossier, 7 CORE + 1 CHAPTER, all with maturity/portrait/topClaims. */
export const MOCK_OVERVIEW: CharacterOverviewResponse = { dimensions: DIM_SEEDS.map(toSummary) }

/** The pre-bootstrap honest empty state (spec §2): CORE dimensions exist but are unread. */
export const MOCK_OVERVIEW_EMPTY: CharacterOverviewResponse = {
  dimensions: DIM_SEEDS.filter((d) => d.kind === 'CORE').map((d) => ({
    key: d.key,
    title: d.title,
    kind: d.kind,
    expertKey: d.expertKey,
    maturity: 0,
    portrait: '',
    topClaims: [],
  })),
}

export const MOCK_DIMENSIONS: Record<string, CharacterDimensionResponse> = Object.fromEntries(
  DIM_SEEDS.map((d) => [d.key, toDimensionResponse(d)]),
)

// FEED (prototype's `var FEED`) — grouped-by-day rows flattened chronologically, newest first.
export const MOCK_FEED: CharacterFeedItem[] = [
  { kind: 'OBSERVATION', at: '2026-08-30T08:10:00Z', expertKey: 'doki', text: 'A reggeli mérések három hete makulátlanul pontosak — ez ritka fegyelem.' },
  { kind: 'OBSERVATION', at: '2026-08-30T08:05:00Z', expertKey: 'drill', text: 'A tegnapi kihagyott logolást ma reggelre már pótoltad — ez a minta ismerős nálad.' },
  { kind: 'CONFERENCE_CHANGE', at: '2026-08-30T07:00:00Z', expertKey: null, dimensionKeys: [], text: 'Vasárnapi konzílium: 2 új állítás · 1 portré átírva' },
  { kind: 'OBSERVATION', at: '2026-08-29T19:30:00Z', expertKey: 'edzo', text: 'A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült.' },
  { kind: 'OBSERVATION', at: '2026-08-29T07:15:00Z', expertKey: 'szomnologus', text: 'Az elalvási idő 23:10-re csúszott — 35 perccel a szokásos után.' },
  { kind: 'OBSERVATION', at: '2026-08-27T20:00:00Z', expertKey: 'pszichologus', text: 'A szerdai bejegyzés hangneme feszültebb volt a hét eddigi napjainál.' },
  { kind: 'OBSERVATION', at: '2026-08-27T12:00:00Z', expertKey: 'taplalkozo', text: 'Három egymást követő napon a fehérjecél 5 g-on belül teljesült.' },
  { kind: 'CONFERENCE_CHANGE', at: '2026-08-27T07:00:00Z', expertKey: null, dimensionKeys: ['recovery'], text: 'Portré frissült: Alvás & regeneráció — a hétvégi eltolódás mostantól „biztos” szintű állítás.' },
  { kind: 'OBSERVATION', at: '2026-08-24T18:00:00Z', expertKey: 'antropologus', text: 'Petra harmadik alkalommal jelenik meg a hét naplóiban.' },
  { kind: 'OBSERVATION', at: '2026-08-24T09:00:00Z', expertKey: 'drill', text: 'A heti fókuszok mindhárma teljesült — negyedik egymást követő hete.' },
]

// KONZ (prototype's `var KONZ`) — conference summaries, newest first.
export const MOCK_CONFERENCES: CharacterConferenceSummary[] = [
  { id: 'w2', kind: 'WEEKLY', weekStart: '2026-08-24', generatedAt: '2026-08-30T07:00:00Z' },
  { id: 'w1', kind: 'WEEKLY', weekStart: '2026-08-17', generatedAt: '2026-08-23T07:00:00Z' },
  { id: 'm1', kind: 'MONTHLY', weekStart: null, generatedAt: '2026-08-01T07:00:00Z' },
  { id: 'b0', kind: 'BOOTSTRAP', weekStart: null, generatedAt: '2026-07-15T09:00:00Z' },
]

// TRANSCRIPT (prototype's `var TRANSCRIPT`) — the latest weekly konzílium (w2), full turn-by-turn
// exchange as it actually ran. `changes` synthesizes the Kimenet outcome (2 elfogadva · 1
// nyugdíjazva · 3 portré átírva) into itemized entries the FE can list.
//
// The pszichologus turn's second line carries the real "DANIEL VÁLASZA — " prefix
// (`KonziliumProposalRound.USER_FEEDBACK_PREFIX`, backend service/KonziliumProposalRound.java) —
// this is how a user-feedback observation actually surfaces inside a persisted turn's free
// text (no structured `userQuote` field exists on `ConferenceTurn`), mirroring what the
// prototype's design-only `userQuote` shows without inventing an API shape that doesn't exist.
const TRANSCRIPT_TURNS: ConferenceTurn[] = [
  { persona: 'doki', text: 'Javaslat: a testzsír-trend és a stagnáló testsúly rekompozícióra utal — a bizonyíték három egymást követő heti mérés.' },
  { persona: 'drill', text: 'Javaslat: a heti fókuszok teljesítési aránya az elmúlt négy hétben végig 80% felett — ez stabil fegyelem-jel.' },
  { persona: 'taplalkozo', text: 'Javaslat: a hétvégi fehérje-elmaradás három hete következetes mintázat — érdemes „figyeljük” szinten felvenni.' },
  {
    persona: 'pszichologus',
    text: 'Megfigyelés: néha halasztod a nehezebb érzelmi témák leírását a naplóban.\n'
      + 'DANIEL VÁLASZA — Nem szándékosan halasztom — inkább nem mindig találok rá szavakat gyorsan.',
  },
  {
    persona: 'szkeptikus',
    text:
      'Doki állítása három adatpontra épül — ez kevés egy "biztos" minősítéshez, javaslom "valószínű"-re fokozni, amíg nem ' +
      'látunk egy negyedik hetet is. Drill állítása erősebb, de a mintaidőszak rövid a heti fókuszok bevezetése óta. A ' +
      'Táplálkozó javaslata elfogadható, de csak "figyeljük" szinten — három hét kevés egy erősebb szóhoz.',
  },
  {
    persona: 'mezo',
    text:
      'Elfogadom Doki állítását "valószínű" szinttel — a Szkeptikus érve helytálló. Drill állítását elfogadom "biztos" ' +
      'szinttel — négy egymást követő hét konzisztens jel. A Táplálkozó javaslatát "figyeljük" szinten veszem fel. A ' +
      'Pszichológus megfigyelését tükröző fogalmazással veszem fel, "figyeljük" szinten — nem ítélet, csak jelzés, amit ' +
      'Daniel is pontosított.',
    refIds: ['physical-claim-0', 'discipline-claim-0', 'nutrition-claim-1', 'mental-claim-2'],
  },
]

export const MOCK_CONFERENCE_DETAIL: Record<string, CharacterConferenceResponse> = {
  w2: {
    id: 'w2',
    kind: 'WEEKLY',
    weekStart: '2026-08-24',
    generatedAt: '2026-08-30T07:00:00Z',
    transcript: TRANSCRIPT_TURNS,
    changes: [
      { kind: 'CLAIM_ACCEPTED', dimensionKey: 'physical', summary: 'Doki állítása elfogadva "valószínű" szinttel.' },
      { kind: 'CLAIM_ACCEPTED', dimensionKey: 'discipline', summary: 'Drill állítása elfogadva "biztos" szinttel.' },
      { kind: 'PORTRAIT_REWRITTEN', dimensionKey: 'recovery', summary: 'Portré átírva: a hétvégi eltolódás mostantól „biztos” szintű állítás.' },
      { kind: 'CLAIM_RETIRED', dimensionKey: 'nutrition', summary: 'Egy korábbi táplálkozási állítás nyugdíjazva — a csapat nem viszi tovább.' },
    ],
  },
}

/** The bootstrap ceremony's result — the konzílium the very first read stands up. */
export const MOCK_BOOTSTRAP_CONFERENCE: CharacterConferenceResponse = {
  id: 'b0',
  kind: 'BOOTSTRAP',
  weekStart: null,
  generatedAt: '2026-07-15T09:00:00Z',
  transcript: [
    { persona: 'mezo', text: 'A teljes eddigi történet beolvasva — 9 kezdő állítás felvéve a dossziéba.' },
  ],
  changes: [{ kind: 'BOOTSTRAP', dimensionKey: null, summary: 'a teljes eddigi történet beolvasva · 9 kezdő állítás' }],
}
