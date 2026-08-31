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
  CharacterRunObservation,
  CharacterRunResponse,
  CharacterRunSummary,
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
//
// Final review (mezo-1gim.14, I1): OBSERVATION `at` timestamps mirror PRODUCTION now, not the
// observed day itself. `CharacterService#feed` sets `at` to the observation's `createdAt`
// (`obs.getCreatedAt()`), and observations are written by the nightly job, which runs AFTER
// midnight for the PREVIOUS day (spec: "processes yesterday") — so an observation about Aug 30
// is created around Aug 31 02:5x, not Aug 30 itself. The old seed faked `at` == the observed
// day, which is exactly what hid the I1 bug: the feed's ⚙ resolve-by-date join was never
// exercised against a real write-lag. CONFERENCE_CHANGE items are untouched — their `at` is a
// conference's own `generatedAt`, a different real timestamp with no such lag.
export const MOCK_FEED: CharacterFeedItem[] = [
  { kind: 'OBSERVATION', at: '2026-08-31T02:52:00Z', expertKey: 'doki', text: 'A reggeli mérések három hete makulátlanul pontosak — ez ritka fegyelem.' }, // observed Aug 30
  { kind: 'OBSERVATION', at: '2026-08-31T02:50:00Z', expertKey: 'drill', text: 'A tegnapi kihagyott logolást ma reggelre már pótoltad — ez a minta ismerős nálad.' }, // observed Aug 30
  { kind: 'CONFERENCE_CHANGE', at: '2026-08-30T07:00:00Z', expertKey: null, dimensionKeys: [], text: 'Vasárnapi konzílium: 2 új állítás · 1 portré átírva' },
  { kind: 'OBSERVATION', at: '2026-08-30T02:52:00Z', expertKey: 'edzo', text: 'A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült.' }, // observed Aug 29
  { kind: 'OBSERVATION', at: '2026-08-30T02:50:00Z', expertKey: 'szomnologus', text: 'Az elalvási idő 23:10-re csúszott — 35 perccel a szokásos után.' }, // observed Aug 29
  { kind: 'OBSERVATION', at: '2026-08-28T02:52:00Z', expertKey: 'pszichologus', text: 'A szerdai bejegyzés hangneme feszültebb volt a hét eddigi napjainál.' }, // observed Aug 27
  { kind: 'OBSERVATION', at: '2026-08-28T02:50:00Z', expertKey: 'taplalkozo', text: 'Három egymást követő napon a fehérjecél 5 g-on belül teljesült.' }, // observed Aug 27
  { kind: 'CONFERENCE_CHANGE', at: '2026-08-27T07:00:00Z', expertKey: null, dimensionKeys: ['recovery'], text: 'Portré frissült: Alvás & regeneráció — a hétvégi eltolódás mostantól „biztos” szintű állítás.' },
  { kind: 'OBSERVATION', at: '2026-08-25T02:52:00Z', expertKey: 'antropologus', text: 'Petra harmadik alkalommal jelenik meg a hét naplóiban.' }, // observed Aug 24
  { kind: 'OBSERVATION', at: '2026-08-25T02:50:00Z', expertKey: 'drill', text: 'A heti fókuszok mindhárma teljesült — negyedik egymást követő hete.' }, // observed Aug 24
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

// ---------------------------------------------------------------------------
// Gépterem (mezo-1gim.14) — the run-log timeline. Mirrored VERBATIM from the v4.3 prototype,
// docs/design_2.0/prototypes/karakter-tab.html (search `CHAIN_POOL`, `WEEKS`, `RARE_RUNS`,
// `KONZ_POOL`) — signal chains, detector keys, and observation texts are copied 1:1; the day
// numbers (Aug 10–30) are mapped onto the same 2026-08 window the rest of this file already
// uses. `who` -> CORE dimension key follows the DIM_SEEDS expertKey mapping above.
const WHO_TO_DIMENSION: Record<string, string> = Object.fromEntries(
  DIM_SEEDS.filter((d) => d.expertKey != null).map((d) => [d.expertKey as string, d.key]),
)

interface ChainSeed {
  detector: string
  code: string
  refs: string[]
  who: string
  obs: string
}

// CHAIN_POOL (prototype) — Aug day-of-month -> the night's fired signal chains. Days not listed
// here are quiet nights (zero signals, zero calls) — the v4.1-corrected honest-empty semantics.
//
// M9 (final review): `logging-gap`'s real owner is `drill`, verified against the detector source
// directly (`DetectorSignal(key, who, ...)` — same verification DetektorokPage.tsx's header
// comment documents), NOT the prototype's `taplalkozo` guess this mock originally copied
// verbatim. Every `logging-gap` chain below carries `who: 'drill'`.
//
// M4 (final review): `refs` is `[]` on every chain — production `DetectorSignal`s never carry
// refIds today (no detector populates that list yet; see SignalChainCard.tsx's header comment),
// so the mock's refCount must be 0 everywhere too, never a fabricated 1–3.
const CHAIN_POOL: Record<number, ChainSeed[]> = {
  13: [
    {
      detector: 'checkin-gap',
      code: '2 egymást követő napon elmaradt a délutáni check-in',
      refs: [],
      who: 'drill',
      obs: 'A kihagyások ritkák nálad — ezen a héten kétszer maradt el a délutáni check-in, érdemes visszaállni a ritmusba.',
    },
    {
      detector: 'journal-note',
      code: 'friss naplóbejegyzés érzékelve (aug 13., 140 karakter)',
      refs: [],
      who: 'pszichologus',
      obs: 'A keddi bejegyzés hangneme fáradtabb volt a megszokottnál.',
    },
  ],
  20: [
    {
      detector: 'logging-gap',
      code: '2. napja nincs étkezés logolva (utolsó: aug 18.)',
      refs: [],
      who: 'drill',
      obs: 'Hétfőn és kedden elmaradt az étkezés-logolás — ritka nálad ez a rés.',
    },
  ],
  24: [
    {
      detector: 'under-logging',
      code: 'a logolt bevitel két hete elmarad a súlytrendtől',
      refs: [],
      who: 'taplalkozo',
      obs: 'Két hete rendszeresen kevesebbet mutat a napló, mint amit a súlyad enged sejtetni — érdemes átnézni, mi marad ki.',
    },
  ],
  27: [
    {
      detector: 'journal-note',
      code: 'friss naplóbejegyzés érzékelve (aug 27., 210 karakter)',
      refs: [],
      who: 'pszichologus',
      obs: 'A szerdai bejegyzés hangneme feszültebb volt a hét eddigi napjainál.',
    },
    {
      detector: 'logging-gap',
      code: '3. napja nincs étkezés logolva (utolsó: aug 24.)',
      refs: [],
      who: 'drill',
      obs: 'Három napja nem logoltál étkezést — ritkán fordul elő nálad ekkora szünet.',
    },
  ],
  30: [
    {
      detector: 'logging-gap',
      code: '3. napja nincs étkezés logolva (utolsó: aug 24.)',
      refs: [],
      who: 'drill',
      obs: 'Hétvégén a logolási fegyelmed lazább — inkább kényelem, mint tudatos döntés.',
    },
    {
      detector: 'checkin-gap',
      code: '2 napja elmaradt a reggeli check-in',
      refs: [],
      who: 'drill',
      obs: 'A hétvégén kétszer maradt el a reggeli check-in — hétköznap ritkán fordul elő nálad.',
    },
    {
      detector: 'journal-note',
      code: 'friss naplóbejegyzés érzékelve (aug 30., 180 karakter)',
      refs: [],
      who: 'pszichologus',
      obs: 'A vasárnap esti bejegyzés hangneme nyugodtabb volt, mint a hét közepén.',
    },
  ],
  // Fix round 1 (mezo-1gim.14): NOT a prototype-verbatim night — added so the callCount
  // unique-expert dedup rule ("one LLM call per fired expert, not per signal") has a fixture to
  // pin: two signals, same expert (drill), two different detectors -> observationCount 2,
  // callCount 1.
  15: [
    {
      detector: 'checkin-gap',
      code: 'elmaradt a délutáni check-in',
      refs: [],
      who: 'drill',
      obs: 'A pénteki délutáni check-in elmaradt.',
    },
    {
      detector: 'checkin-gap',
      code: 'elmaradt a reggeli check-in is',
      refs: [],
      who: 'drill',
      obs: 'Ugyanaznap a reggeli check-in is elmaradt — két kihagyás egy napon belül.',
    },
  ],
}

function uniqueWho(chains: ChainSeed[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  chains.forEach((c) => {
    if (!seen.has(c.who)) {
      seen.add(c.who)
      out.push(c.who)
    }
  })
  return out
}

function nightlyRun(day: number): CharacterRunSummary {
  const chains = CHAIN_POOL[day]
  const iso = `2026-08-${String(day).padStart(2, '0')}`
  if (!chains) {
    // A quiet night — the run row IS the honest zero-signal record (spec's "csendes éjszaka"),
    // never a fabricated one and never a missing row.
    return {
      id: `ejsz-${day}`,
      kind: 'NIGHTLY',
      day: iso,
      observationCount: 0,
      callCount: 0,
      detectorKeys: [],
      expertKeys: [],
      conferenceId: null,
    }
  }
  const who = uniqueWho(chains)
  return {
    id: `ejsz-${day}`,
    kind: 'NIGHTLY',
    day: iso,
    observationCount: chains.length,
    // One LLM call per fired expert (the DTO's "honest only for NIGHTLY" callCount rule) —
    // NOT one per signal: two signals from the same expert in one night is still one call.
    callCount: who.length,
    detectorKeys: [...new Set(chains.map((c) => c.detector))],
    expertKeys: who,
    conferenceId: null,
  }
}

function nightlyDetail(day: number): CharacterRunResponse {
  const summary = nightlyRun(day)
  const chains = CHAIN_POOL[day] ?? []
  const observations: CharacterRunObservation[] = chains.map((c, i) => ({
    id: `${summary.id}-obs-${i}`,
    expertKey: c.who,
    dimensionKeys: WHO_TO_DIMENSION[c.who] != null ? [WHO_TO_DIMENSION[c.who]] : [],
    text: c.obs,
    salience: 0.6,
    signals: [{ detectorKey: c.detector, summary: c.code, refCount: c.refs.length }],
  }))
  return { summary, observations }
}

// The three seeded weeks (Aug 10–16, 17–23, 24–30) mirroring the prototype's `WEEKS` builder —
// every day in the window gets a nightly run row (quiet unless CHAIN_POOL says otherwise).
const NIGHTLY_DAYS = Array.from({ length: 21 }, (_, i) => 10 + i)

export const MOCK_RUNS_NIGHTLY: CharacterRunSummary[] = NIGHTLY_DAYS.map(nightlyRun)

// RULING (v4.1-corrected, mezo-1gim.14): conference-kind rows (WEEKLY/MONTHLY/BOOTSTRAP) carry
// `callCount: 0` by design — the AI-napló is the call-level truth for those runs, not this row.
// Never invent a non-zero callCount here.

// WEEKLY (prototype's KONZ_POOL[30] -> id 'w2') — links the existing MOCK_CONFERENCES / w2
// entry so a run-page "teljes transzkript" link resolves to real seeded conference data.
// Consumed observations = the union of the week's nightly signal chains (24 + 27 + 30).
const WEEKLY_OBSERVATIONS: CharacterRunObservation[] = [24, 27, 30].flatMap((day) => nightlyDetail(day).observations)
// Fix round 1 (mezo-1gim.14): CharacterConferenceService computes detectorKeys for a WEEKLY row
// as the union of its consumed observations' detector keys (unlike MONTHLY/BOOTSTRAP, which are
// deliberately [] backend-side — a monthly/bootstrap re-read isn't detector-driven) — derive it
// here instead of hardcoding, so it can never drift from WEEKLY_OBSERVATIONS.
const WEEKLY_DETECTOR_KEYS = [...new Set(WEEKLY_OBSERVATIONS.flatMap((o) => o.signals.map((s) => s.detectorKey)))]
// M6 (final review): CharacterConferenceService derives a WEEKLY row's expertKeys from the
// distinct expertKey of its CONSUMED OBSERVATIONS (`weekObservations.stream().map(getExpertKey)
// .distinct()`) — never a fixed catalog subset like "the 6 experts who spoke in the transcript"
// (doki/szkeptikus/mezo never fired a nightly signal in this seed's week; taplalkozo/
// pszichologus/drill did). Derived here so it can never drift from WEEKLY_OBSERVATIONS.
const WEEKLY_EXPERT_KEYS = [...new Set(WEEKLY_OBSERVATIONS.map((o) => o.expertKey))]

const WEEKLY_RUN: CharacterRunSummary = {
  id: 'run-w2',
  kind: 'WEEKLY',
  day: '2026-08-24', // week_start (Monday) of the aug 24–30 week
  observationCount: WEEKLY_OBSERVATIONS.length, // the week's 3 signal nights (24, 27, 30): 1 + 2 + 3 chains
  callCount: 0,
  detectorKeys: WEEKLY_DETECTOR_KEYS,
  expertKeys: WEEKLY_EXPERT_KEYS,
  conferenceId: 'w2',
}

const WEEKLY_DETAIL: CharacterRunResponse = { summary: WEEKLY_RUN, observations: WEEKLY_OBSERVATIONS }

// MONTHLY (prototype's RARE_RUNS 'm1') — links the existing MOCK_CONFERENCES / m1 entry.
// Fix round 1 (mezo-1gim.14): CharacterMonthlyService sets observationCount to
// activeClaims.size() — the count of re-evaluated ACTIVE claims, NOT new observations consumed
// (a monthly re-read re-evaluates the existing claim base rather than reading fresh nightly
// signals). Derived from DIM_SEEDS so it can never drift from the seeded claim base above.
const MONTHLY_ACTIVE_CLAIM_COUNT = DIM_SEEDS.reduce((sum, d) => sum + d.claims.length, 0)
// M6 (final review): CharacterMonthlyService's `buildEvidence` groups every ACTIVE claim by its
// owning expert — a CORE dimension's claims go to its own `expertKey`; a CHAPTER dimension's
// claims (no owning expert) go to `CHAPTER_CLAIMS_EXPERT_KEY` = "drill" (see
// CharacterMonthlyService.java's javadoc). `expertKeys` is the distinct set of those, never the
// fixed ['mezo'] this mock hardcoded before — derived here so it can never drift from DIM_SEEDS.
const MONTHLY_EXPERT_KEYS = [...new Set(
  DIM_SEEDS.filter((d) => d.claims.length > 0).map((d) => (d.kind === 'CHAPTER' ? 'drill' : (d.expertKey as string))),
)]

const MONTHLY_RUN: CharacterRunSummary = {
  id: 'run-m1',
  kind: 'MONTHLY',
  day: '2026-08-01',
  observationCount: MONTHLY_ACTIVE_CLAIM_COUNT,
  callCount: 0,
  detectorKeys: [],
  expertKeys: MONTHLY_EXPERT_KEYS,
  conferenceId: 'm1',
}

const MONTHLY_DETAIL: CharacterRunResponse = { summary: MONTHLY_RUN, observations: [] }

// BOOTSTRAP (prototype's RARE_RUNS 'b0') — links the existing MOCK_CONFERENCES / b0 entry and
// MOCK_BOOTSTRAP_CONFERENCE (9 kezdő állítás).
// M6 (final review): CharacterBootstrapService derives expertKeys from `CharacterHistoryReads`'
// per-expert evidence — daily-summary narratives (this seed's only history source, per
// CharacterRunLogIT's bootstrap fixture) are routed to EVERY expert ("daily-summary narratives
// go to EVERY expert" — CharacterHistoryReads.java's routing-rule javadoc), i.e. the full CORE
// catalog, never the fixed ['mezo'] this mock hardcoded before.
const BOOTSTRAP_RUN: CharacterRunSummary = {
  id: 'run-b0',
  kind: 'BOOTSTRAP',
  day: '2026-07-15', // the run date
  observationCount: 9,
  callCount: 0,
  detectorKeys: [],
  expertKeys: [...EXPERT_ORDER],
  conferenceId: 'b0',
}

const BOOTSTRAP_DETAIL: CharacterRunResponse = { summary: BOOTSTRAP_RUN, observations: [] }

/** The full run-log seed — 21 nightly rows (Aug 10–30, incl. quiet nights) + one WEEKLY, one
 *  MONTHLY, one BOOTSTRAP, newest day first (mirrors the backend's day-desc ordering). */
export const MOCK_RUNS: CharacterRunSummary[] = [
  ...MOCK_RUNS_NIGHTLY,
  WEEKLY_RUN,
  MONTHLY_RUN,
  BOOTSTRAP_RUN,
].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))

export const MOCK_RUN_DETAIL: Record<string, CharacterRunResponse> = {
  ...Object.fromEntries(NIGHTLY_DAYS.map((day) => [`ejsz-${day}`, nightlyDetail(day)])),
  'run-w2': WEEKLY_DETAIL,
  'run-m1': MONTHLY_DETAIL,
  'run-b0': BOOTSTRAP_DETAIL,
}
