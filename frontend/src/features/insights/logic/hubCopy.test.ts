import { describe, expect, it } from 'vitest'
import * as C from '@/features/insights/logic/hubCopy'

describe('hubCopy · verbs & toasts', () => {
  it('names the four verbs exactly as the approved prototype', () => {
    expect(C.VERB).toEqual({
      source: 'Honnan tudom?', unmute: 'Visszakapcsolom', mute: 'Elhallgattatom', forget: 'Elfelejtem',
      edit: 'Javítom', save: 'Mentés', cancel: 'Mégse', more: 'További műveletek', undo: 'Visszavonom',
    })
    expect(C.TOAST.muted).toBe('Elhallgattattam — megőrzöm, de nem használom')
    expect(C.TOAST.unmuted).toBe('Visszakapcsoltam — újra használhatom')
    expect(C.TOAST.forgotten).toBe('Végleg elfelejtve')
    expect(C.TOAST.undone).toBe('Visszavonva — minden a helyén')
    expect(C.TOAST.edited).toBe('Javítottam')
  })

  it('undo bar lines', () => {
    expect(C.undoTitle('Mázli a macskád')).toBe('Elfelejtettem: „Mázli a macskád”')
    expect(C.undoSub(false)).toBe('ugyanebből a forrásból nem tanulom meg újra')
    expect(C.undoSub(true)).toBe('többé nem mutatom és nem használom')
  })

  it('strip notes', () => {
    expect(C.stripNote('active')).toBe('Elhallgattatva megőrzöm, de semmire nem használom. Elfelejtve törlöm — pár másodpercig visszavonható.')
    expect(C.stripNote('muted')).toBe('Elhallgattatva: megőrzöm, de semmire nem használom.')
    expect(C.stripNote('effect')).toBe('Elhallgattatva nem mutatom és nem használom, de bármikor visszakapcsolhatod. Elfelejtve soha többé.')
  })
})

describe('hubCopy · why a thing is muted', () => {
  it('reason + date, superseded with a comma', () => {
    expect(C.whyText('user', '2026-09-12T08:00:00Z')).toBe('te hallgattattad el · Szep 12')
    expect(C.whyText('refuted', '2026-09-16T08:00:00Z')).toBe('később nem igazolódott · Szep 16')
    expect(C.whyText('superseded', '2026-09-21T09:20:00Z')).toBe('felülírta egy újabb észrevétel, Szep 21')
  })
  it('no date → reason only (backfilled / person facts)', () => {
    expect(C.whyText('user', null)).toBe('te hallgattattad el')
    expect(C.whyText('superseded', null)).toBe('felülírta egy újabb észrevétel')
  })
  it('why icons', () => {
    expect(C.WHY_ICON).toEqual({ user: 't-mute', refuted: 't-down', superseded: 't-history' })
  })
})

describe('hubCopy · observation status line', () => {
  const base = { recheckedAt: null, factMutedReason: null, factMutedAt: null, replacesPatternId: null, confirmedAt: '2026-09-21T08:00:00Z' }
  it('still true, rechecked', () => {
    expect(C.obsStatus({ ...base, recheckedAt: '2026-09-20T09:20:00Z' })).toEqual({ text: 'legutóbb ellenőrizve Szep 20 · még igaz', tone: 'ok' })
  })
  it('never rechecked', () => {
    expect(C.obsStatus(base)).toEqual({ text: 'még nem ellenőriztem újra · megerősítve Szep 21', tone: 'ok' })
  })
  it('the newer half of a drift pair', () => {
    expect(C.obsStatus({ ...base, replacesPatternId: 'o3old' })).toEqual({ text: 'ez váltotta a régit · Szep 21', tone: 'gold' })
  })
  it('superseded', () => {
    expect(C.obsStatus({ ...base, factMutedReason: 'superseded', factMutedAt: '2026-09-21T09:20:00Z' }))
      .toEqual({ text: 'felülírta egy újabb észrevétel, Szep 21', tone: 'off' })
  })
  it('refuted and user-muted', () => {
    expect(C.obsStatus({ ...base, factMutedReason: 'refuted' }).text).toBe('elhallgattatva · később nem igazolódott')
    expect(C.obsStatus({ ...base, factMutedReason: 'user', factMutedAt: '2026-09-09T08:00:00Z' }).text)
      .toBe('elhallgattatva · te hallgattattad el, Szep 9')
  })
  it('the older half of a drift pair with no superseded fact: replaced on the newer one\'s day', () => {
    expect(C.obsStatus({ ...base, replacedByPatternId: 'o3', replacedAt: '2026-09-21T07:00:00Z' }))
      .toEqual({ text: 'felülírta egy újabb észrevétel, Szep 21', tone: 'off' })
    expect(C.obsStatus({ ...base, replacedByPatternId: 'o3' }).text).toBe('felülírta egy újabb észrevétel')
  })
  it('the older half re-enabled (its fact on again): both are used', () => {
    expect(C.obsStatus({ ...base, replacedByPatternId: 'o3', factId: 'f1' }))
      .toEqual({ text: 'újra bekapcsoltad — mindkettőt használom', tone: 'ok' })
  })
  it('fold hint', () => {
    expect(C.obsFoldHint(2)).toBe('2 még igaz')
  })
})

describe('hubCopy · hub, tiles, sections', () => {
  it('hero + notes', () => {
    expect(C.HERO.title).toBe('dolgot tud rólad Mezo')
    expect(C.HERO.sub).toBe('és te döntöd el, mit használhat belőle.')
    expect(C.HERO.unavailable).toBe('Most egyik szakaszt sem sikerült betölteni.')
    expect(C.heroNote('ok')).toBe('Egy észrevételt a belőle tanult ténnyel együtt egyszer számolok.')
    expect(C.heroNote('off')).toBe('A társ most ki van kapcsolva: a tények, az észrevételek és a hatások most nem elérhetők, ezért a szám csak az embereket számolja.')
    expect(C.heroNote('partial')).toBe('Néhány szakasz most nem töltődött be, ezért a szám nélkülük áll.')
  })
  it('tile subs', () => {
    expect(C.tileSub.facts(12, 3)).toBe('12 bekapcsolva · 3 elhallgattatva')
    expect(C.tileSub.people(9, 2)).toBe('9 ember · 2 elhallgattatva')
    expect(C.tileSub.observations(20, 1, 4)).toBe('20 még igaz · 1 felülírva · 4 elhallgattatva')
    expect(C.tileSub.effects(7, 5, 1)).toBe('7 ember · 5 esemény · 1 elhallgattatva')
    expect(C.TILE_STATE.off).toBe('A társ most nincs bekapcsolva.')
    expect(C.TILE_STATE.offFacts).toBe('A társ most nincs bekapcsolva — a tények most nem elérhetők.')
    expect(C.TILE_STATE.error).toBe('Most nem sikerült betölteni.')
    expect(C.TILE_STATE.retry).toBe('Újrapróbálom ›')
    expect(C.TILE_STATE.loading).toBe('Betöltés…')
  })
  it('section leads and footers', () => {
    expect(C.lead.facts(52, 4, 49, 3)).toBe('52 tény, 4 témában · 49 bekapcsolva · 3 elhallgattatva')
    expect(C.lead.people(14, 60)).toBe('14 ember · 60 tény — ábécérendben, nincs rangsor. Keresni névre és arra is lehet, amit tudok róluk.')
    expect(C.lead.observations).toBe('Amit a napjaidból vettem észre, és te megerősítetted — témák szerint. Negyedévente újra megnézem, igaz-e még.')
    expect(C.lead.effects).toBe('Milyenek a napjaid — hangulatban, energiában, nyugalomban —, amikor valaki vagy valami felbukkan bennük.')
    expect(C.FACTS_NOTE).toBe('Ami be van kapcsolva, azt a társ minden beszélgetésben és üzenetben tudja rólad.')
  })
  it('search, groups, empties', () => {
    expect(C.SEARCH.facts).toBe('Keresés a tények között…')
    expect(C.SEARCH.people).toBe('Keresés név vagy tény szerint…')
    expect(C.SEARCH.person('Barbi')).toBe('Keresés Barbi tényei között…')
    expect(C.SEARCH.observations).toBe('Keresés az észrevételek között…')
    expect(C.SEARCH.effects).toBe('Keresés ember vagy esemény szerint…')
    expect(C.noHits('kávé')).toBe('Nincs találat erre: „kávé”.')
    expect(C.CLEAR_SEARCH).toBe('Keresés törlése')
    expect(C.groupCount('', 7)).toBe('7')
    expect(C.groupCount('ká', 2)).toBe('2 találat')
    expect(C.MUTED_GROUP).toBe('Elhallgattatott')
  })
  it('provenance chips + origins', () => {
    expect(C.CHIP).toEqual({
      pattern: 'észrevételből', chat: 'beszélgetésből', manual: 'kézzel',
      weekly_review: 'heti áttekintésből', question: 'kérdésre válaszoltál',
    })
    expect(C.ORIGIN.pattern).toBe('Megerősített észrevételből tanultam — amikor az egyik változik, a másik jellemzően követi.')
    expect(C.ORIGIN.chat).toBe('A beszélgetéseitekből szűrtem ki.')
    expect(C.ORIGIN.manual).toBe('Te vetted fel kézzel.')
    expect(C.ORIGIN.weekly_review).toBe('A heti áttekintésből derült ki.')
    expect(C.ORIGIN.question).toBe('Egy kérdésre válaszoltál rá.')
  })
  it('empty states', () => {
    expect(C.EMPTY).toEqual({
      personNone: 'Most egy tényt sem használok róla.',
      obsState: 'Ebben az állapotban most nincs észrevétel.',
      effectsPeople: 'Most egy emberről sem mutatok hatást.',
      effectsEvents: 'Most egy eseményről sem mutatok hatást.',
      facts: 'Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.',
      people: 'Még senkiről nem tudok semmit — ahogy mesélsz róluk, itt jelennek meg.',
      observations: 'Még nincs megerősített észrevétel.',
      effects: 'Még nincs elég nap ahhoz, hogy együttjárást mutassak.',
    })
  })
  it('degraded-state copy', () => {
    expect(C.DEGRADED).toEqual({
      facts: 'A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.',
      section: 'A társ most nincs bekapcsolva — ez a szakasz most nem elérhető.',
      error: 'Most nem sikerült betölteni ezt a szakaszt.',
      loading: 'A szakasz betöltése…',
    })
  })
  it('person-fact sub line + head', () => {
    expect(C.personFactSub('kedveli / nem szereti', { sourceKind: 'chat_turn', createdAt: '2026-09-12T08:00:00Z' }))
      .toBe('kedveli / nem szereti · chatből · Szep 12')
    expect(C.personFactSub('fontos dátum', { sourceKind: 'nightly_day', createdAt: '2026-09-20T08:00:00Z' }))
      .toBe('fontos dátum · éjszakai jegyzetből · Szep 20')
    expect(C.personHead(9, 0)).toBe('9 tény bekapcsolva')
    expect(C.personHead(9, 2)).toBe('9 tény bekapcsolva · 2 elhallgattatva')
  })
  it('effect subject kind label', () => {
    expect(C.effectSubjectKindLabel('person', 3)).toBe('ember · 3 jelzés')
    expect(C.effectSubjectKindLabel('event', 1)).toBe('esemény · 1 jelzés')
  })
  it('drift eyebrow', () => {
    expect(C.DRIFT_EYEBROW.bothOn).toBe('A RÉGI IS BE VAN KAPCSOLVA')
    expect(C.DRIFT_EYEBROW.older('2026-09-12T08:00:00Z')).toBe('KORÁBBAN · MEGERŐSÍTVE SZEP 12')
    expect(C.DRIFT_EYEBROW.bothOnLine).toBe('újra bekapcsoltad — mindkettőt használom')
  })
})
