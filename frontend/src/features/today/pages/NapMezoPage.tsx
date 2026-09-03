// ============================================================
// Mezo · NapMezoPage — "Mezo üzenetei" as its own full page (mezo-d20.2.2)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html #page-mezo
// (p-coral tone, breathing-orb hero, the day's companion messages as a
// thread, chat CTA). Absorbs the hub's MezoMessagesSheet surface: feedback
// chips only on persisted feed rows (mezo-kr9v). The sheet component
// stays in-tree for its remaining callers; only the hub tile now
// navigates here instead of opening it.
// A szál felépítése (feed + cimkézett demo-briefing + Életjel-nudge-ok) és az
// olvasottság-vízjel a shell `MezoThreadProvider`-ébe költözött (mezo-atry) — ez az
// oldal és a fejléc badge-e ugyanazt az EGY szálat olvassa, így nem tudnak szétcsúszni.
// Üzenetek | Életjelek tab-szétválasztás (mezo-ho9k): a szál ÉRINTETLEN, csak a
// megjelenítés bomlik két panelre a `?tab=` URL-en keresztül —
// `partitionMezoThread`/`MezoMessageItem.source === 'eletjel'` a kulcs (mezoMessages.ts).
// Régebbi Üzenetek-kártyák alapból összecsukva (`.nap-mzrow`), belépéskori
// olvasatlan-pillanatkép tab-pöttyökhöz, a `?n=` deeplink mindig az Üzenetek tabra kényszerít.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon, ClaySpot, type ClaySpotName } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { cn } from '@/shared/lib/cn'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RefChips } from '@/features/insights/components/RefChips'
import { EletjelStrip } from '@/features/today/components/EletjelStrip'
import { useCompanionFeed, useFeedback } from '@/data/hooks'
import { feedToMessageItem, partitionMezoThread, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { localDateString } from '@/shared/lib/dates'

/** Prototype: each message head carries a daypart clay spot (s-reggel / s-este /
 *  s-energia). Our messages carry a KIND, not a spot — this is the visual mapping. */
function messageSpot(m: MezoMessageItem): ClaySpotName {
  if (m.kind === 'sleep' || m.kind === 'evening') return 's-este'
  if (m.kind === 'morning' || m.id === 'briefing-demo') return 's-reggel'
  return 's-energia'
}

export function NapMezoPage() {
  const navigate = useNavigate()

  // The intervention-push deeplink (mezo-b3pp.36): the push carries `?n=<full feed-row uuid>&d=
  // <the card's OWN generation day>`. A card deferred across midnight keeps its GENERATION day,
  // but the push announcing it arrives the next morning — so `d` can name YESTERDAY while the
  // user is on TODAY's thread. `d` naming today is the common case (no cross-day fetch, no
  // duplicate — the card is already in today's own thread below).
  const [params, setParams] = useSearchParams()
  const deepLinkId = params.get('n')
  const deepLinkDay = params.get('d')
  const today = localDateString()
  const crossDay = deepLinkDay && deepLinkDay !== today ? deepLinkDay : undefined
  // Only actually fetch the other day's feed when there is an id to look up in it — a `d=` with
  // no `n` has nothing to find (Finding 6). When crossDay is undefined this stays enabled and
  // is a cache hit (same date, same query key as the read below) — not a second request.
  const wantsCrossDayFetch = crossDay != null && deepLinkId != null
  const linkedFeed = useCompanionFeed(crossDay ?? today, { enabled: crossDay == null || wantsCrossDayFetch })
  const linkedCard = wantsCrossDayFetch
    ? linkedFeed.find((m) => m.id === deepLinkId)
    : undefined
  // Same rendering as any other feed row (mezoMessages.ts's `feedToMessageItem`) — only the id
  // is overridden, since `m.kind` alone can collide with a same-kind card already in today's
  // own thread once a second day's card joins it.
  // Memoized on `linkedCard` (a stable reference across renders while the underlying feed query
  // data is unchanged — `.find` on the same array returns the same element) rather than rebuilt
  // as a fresh object literal every render: a fresh reference here would defeat the
  // `displayMessages` memo below and re-fire the scroll effect on every unrelated re-render
  // (Finding 1 — e.g. a `useFeedback` optimistic vote elsewhere in the thread, or a 60s poll
  // tick that changes unrelated feed data).
  const linkedItem: MezoMessageItem | null = useMemo(
    () => (linkedCard ? { ...feedToMessageItem(linkedCard), id: `deeplink-${linkedCard.id}` } : null),
    [linkedCard],
  )

  // A szál a shell providerétől jön (mezo-atry): a fejléc olvasatlan-badge-e és ez az oldal
  // UGYANAZT a listát látja, tehát az itt lerakott olvasottság-vízjel ott biztosan találatot
  // ad. A visszajelzés-chipek viszont a nyers feed-sorok id-jeire kötnek, ezért a feedet ez
  // az oldal továbbra is közvetlenül olvassa (mezo-e26w / mezo-b3pp.15).
  // Belépéskori olvasatlan-pillanatkép (mezo-ho9k): a szál utolsó `unread` eleme az
  // olvasatlan halmaz — partíciónként egy pötty. A pillanatkép- és a markSeen-effect
  // UGYANANNAK a rendernek a `unread` értékét zárja closure-be (a `markSeen()` hívás csak a
  // KÖVETKEZŐ renderre módosítja a megosztott vízjelet, visszamenőleg nem) — a védelmet
  // NEM az effect-deklarációk sorrendje adja, hanem a lenti `dots !== null` egyszeri őr.
  // Session-lokális, nem perzisztens.
  const { messages, unread, markSeen } = useMezoThread()
  const feed = useCompanionFeed()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)

  // Üzenetek | Életjelek tab-váltó (mezo-ho9k): a szál (sorrend, tartalom, a hero számláló
  // forrása) érintetlen — ez CSAK megjelenítési bontás a `?tab=` URL-en keresztül.
  type MezoTab = 'uzenetek' | 'eletjelek'
  // ?n= jelenlétekor a tab MINDIG Üzenetek — felülírja a ?tab=eletjelek-et is (mezo-ho9k):
  // a deeplink mindig egy üzenetre (vagy a b3pp.36 intervenció-push kártyájára) mutat, sosem
  // egy Életjel-nudge-ra, tehát a cél csak az Üzenetek pane-ben létezhet.
  // Egyszeri kényszerítés (záró review, Finding 1): a `?n=` deeplink `n`/`d` paraméterei a
  // navigáció után is a URL-en maradnak (nincs okuk eltűnni), tehát a fenti derivációt a tab
  // MINDEN render alkalmával Üzenetekre kényszerítené — a felhasználó soha nem tudna átváltani
  // Életjelekre. `tabOverride` a felhasználó explicit választását tárolja; egyszer kitöltve
  // felülírja a deeplink-kényszert is, a `?tab=` deriváció pedig csak addig számít, amíg a
  // felhasználó még nem választott kézzel.
  const [tabOverride, setTabOverride] = useState<MezoTab | null>(null)
  const tab: MezoTab =
    tabOverride ?? (deepLinkId ? 'uzenetek' : params.get('tab') === 'eletjelek' ? 'eletjelek' : 'uzenetek')
  const setTab = (t: MezoTab) => {
    setTabOverride(t)
    const next = new URLSearchParams(params)
    if (t === 'eletjelek') next.set('tab', 'eletjelek')
    else next.delete('tab')
    setParams(next, { replace: true })
  }
  // Belépéskori olvasatlan-pillanatkép (mezo-ho9k): a szál utolsó `unread` eleme az
  // olvasatlan halmaz — partíciónként egy pötty. NEM az effect-sorrend védi ezt a
  // pillanatképet a lenti `markSeen()`-től (mindkét effect ugyanannak a rendernek a
  // `unread` értékét zárja closure-be, a bélyegzés csak a KÖVETKEZŐ renderre hat) — a
  // load-bearing rész a `dots !== null` egyszeri őr alább: az akadályozza meg, hogy az
  // effect egy KÉSŐBBI renderen újra lefusson és a már törölt `unread`-et fagyassza be.
  // Session-lokális, nem perzisztens.
  const [dots, setDots] = useState<{ uzenetek: boolean; eletjelek: boolean } | null>(null)
  useEffect(() => {
    if (dots !== null || messages.length === 0) return
    const unseen = messages.slice(messages.length - unread)
    setDots({
      uzenetek: unseen.some((m) => m.source !== 'eletjel'),
      eletjelek: unseen.some((m) => m.source === 'eletjel'),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- egyszeri pillanatkép
  }, [messages, unread, dots])
  useEffect(() => {
    if (dots?.[tab]) setDots((d) => (d ? { ...d, [tab]: false } : d))
  }, [tab, dots])

  const { uzenetek, eletjelek } = useMemo(() => partitionMezoThread(messages), [messages])
  // Prepended, not merged into the shared thread: it is what the user just tapped, and the
  // shared thread stays the shell header's unread source of truth (mezo-atry) — untouched by a
  // deeplink that only this page consumes. Deep-linked cards are always companion messages,
  // never nudges, so they only ever join the Üzenetek pane.
  const displayUzenetek = useMemo(
    () => (linkedItem ? [linkedItem, ...uzenetek] : uzenetek),
    [linkedItem, uzenetek],
  )
  const feedIds = useMemo(() => {
    const ids = feed.map((m) => m.id)
    // The deep-linked card's own feedback state must be fetched too, or its chips would render
    // with no verdict even when the user already voted on it from wherever it first appeared.
    return linkedCard ? [...ids, linkedCard.id] : ids
  }, [feed, linkedCard])
  const feedback = useFeedback('feed_message', feedIds)
  // Prototype: „a Mezo-csempe olvasatlan-jelzése megnyitáskor törlődik" — a szál UTOLSÓ
  // elemének id-je a vízjel, amit a fejléc badge-e visszaolvas (MezoThreadProvider). The
  // watermark stays keyed to the SHARED thread (`messages`), not `displayMessages` — the
  // deeplinked card is not part of the header's unread count.
  useEffect(() => { markSeen() }, [markSeen])

  // Finding 2: most intervention pushes are SAME-day — `linkedCard`/`linkedItem` stay unset
  // (crossDay is undefined) even though `n` names a row already inside today's own thread. That
  // row still deserves the scroll/highlight; it is not duplicated as a second card since it is
  // already in `messages`.
  const sameDayTargetId = crossDay == null && deepLinkId
    ? messages.find((m) => m.artifactId === deepLinkId)?.id
    : undefined
  // A stable string (or undefined), never an object — the effect below keys on this rather than
  // on `linkedItem`'s identity so it only re-fires when the ACTUAL target changes, not on every
  // unrelated re-render (Finding 1).
  const scrollTargetId = linkedItem?.id ?? sameDayTargetId

  const linkedCardRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (scrollTargetId) linkedCardRef.current?.scrollIntoView({ block: 'center' })
  }, [scrollTargetId])

  // Régebbi üzenetek összecsukva (mezo-ho9k): csak a szál legfrissebb hangja (a lista
  // vége) nyílik teljes kártyaként alapból — a korábbiak egysoros gombok, kinyitásuk
  // nem csukható vissza (YAGNI — a prototípus sem csukja).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const isExpanded = (id: string) => expandedIds.has(id)
  const expand = (id: string) => setExpandedIds((s) => new Set(s).add(id))
  // mezo-z4h4: a user-expanded older card must be collapsible again — the earlier `expand`-only
  // set meant an opened card could never be closed back into its one-line row.
  const collapse = (id: string) =>
    setExpandedIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })

  // Egyetlen kártya-JSX mindkét pane-nek (mezo-ho9k): a chips-ág magától sem fut az
  // Életjelek nudge-okon, mert azoknak nincs `artifactId`-jük (mezo-kr9v szerződés).
  // `collapsible` (mezo-z4h4): csak akkor igaz, amikor a kártya KIZÁRÓLAG a felhasználó
  // kézi kinyitása miatt látszik teljes kártyaként — a legújabb üzenet és a deeplink-cél
  // mindig teljes kártya marad, összecsukás-gomb nélkül (az Életjelek pane pedig eleve nem
  // ad át semmit, tehát ott is hiányzik).
  const renderCard = (m: MezoMessageItem, i: number, opts?: { collapsible?: boolean }) => (
    <div
      key={m.id}
      ref={m.id === scrollTargetId ? linkedCardRef : undefined}
      className="nap-mzmsg rise"
      style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
    >
      <div className="nap-mzmsg-h">
        {m.icon ? <ClayIcon name={m.icon} size={35} /> : <ClaySpot name={messageSpot(m)} size={35} />}
        <div className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</div>
        {opts?.collapsible && (
          <button
            type="button"
            className="nap-mzmsg-collapse"
            aria-label="Összecsukás"
            aria-expanded={true}
            onClick={() => collapse(m.id)}
          >
            <Icon name="chevron-up" size={12} />
          </button>
        )}
      </div>
      {m.paragraphs.map((p, j) => (
        <p key={j} className="txt"><SafeMarkdown text={p} /></p>
      ))}
      {m.refs.length > 0 && <RefChips refs={m.refs} eyebrow="Amire épült" />}
      {m.meta && <div className="nap-mzmsg-meta">{m.meta}</div>}
      {/* Chips CSAK perzisztált AI-artifactre (mezo-kr9v); a „Segített?" felirat a
          W5.2 intervention-változat (mezo-b3pp.19) — a sheet szerződése változatlanul. */}
      {m.artifactId != null && (
        <div className="mt-sm">
          {m.kind === 'intervention' && <div className="nap-mzmsg-meta">Segített?</div>}
          <FeedbackChips
            key={m.artifactId}
            value={feedback.get(m.artifactId)}
            onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
            label={m.kind === 'intervention' ? 'a közbelépésről' : 'az üzenetről'}
          />
        </div>
      )}
    </div>
  )

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      {/* Prototype hero order is orb → name → sub (no bignum), so the orb hero is
          composed from the mz-page-hero classes rather than PageHero's nm/row/sb recipe. */}
      <div className="mz-page-hero orb">
        <ClaySpot name="s-orb" size={83} />
        <div className="mz-hero-nm">Mezo · ma</div>
        {/* Today's own message count (Finding 3) — a cross-day deeplink prepends one extra card
            to the Üzenetek pane that is not part of today's thread; the label must not count it.
            The TELJES szál (mindkét tab) számít, a tab-bontás csak megjelenítés. */}
        <div className="mz-hero-sb">{messages.length} üzenet · a napod fonala</div>
      </div>
      <PageBody>
        <div className="nap-mzseg" role="tablist" aria-label="Mezo tartalom" data-kalauz-anchor="uzenetek-tabs">
          <button type="button" role="tab" aria-selected={tab === 'uzenetek'}
            className={cn(tab === 'uzenetek' && 'on')} onClick={() => setTab('uzenetek')}>
            Üzenetek
            {dots?.uzenetek && tab !== 'uzenetek' && <span className="nap-mzdot" />}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'eletjelek'}
            className={cn(tab === 'eletjelek' && 'on')} onClick={() => setTab('eletjelek')}>
            Életjelek
            {dots?.eletjelek && tab !== 'eletjelek' && <span className="nap-mzdot" />}
          </button>
        </div>
        {tab === 'uzenetek' && (
          <EntranceGroup>
            {displayUzenetek.map((m, i) =>
              i === displayUzenetek.length - 1 || isExpanded(m.id) || m.id === scrollTargetId ? (
                renderCard(m, i, {
                  collapsible:
                    isExpanded(m.id) && i !== displayUzenetek.length - 1 && m.id !== scrollTargetId,
                })
              ) : (
                <button type="button" key={m.id} className="nap-mzrow rise"
                  style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
                  aria-expanded="false" onClick={() => expand(m.id)}>
                  {m.icon && <ClayIcon name={m.icon} size={16} />}
                  <span className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</span>
                  <span className="pv">{m.paragraphs[0]}</span>
                  {m.meta && <span className="mt">{m.meta}</span>}
                  <span className="chev" aria-hidden="true">
                    <Icon name="chevron-down" size={12} />
                  </span>
                </button>
              ),
            )}
            <button type="button" className="nap-mz-cta rise" style={{ '--d': `${40 + displayUzenetek.length * 60}ms` } as React.CSSProperties}
              onClick={() => navigate('/mezo/chat')}>
              Beszélgess Mezóval ›
            </button>
          </EntranceGroup>
        )}
        {tab === 'eletjelek' && (() => {
          // mezo-z4h4: no nudge CARDS does not mean the rings are fine — `deriveNudges`
          // swallows a fresh nudge during the quiet window (night + the first hour after
          // waking) and once a ring has already nudged today. The empty-state line must read
          // the rings' own BANDS, not the (possibly-suppressed) nudge list, or it cheerfully
          // claims "minden rendben" while the strip above shows red/critical cells.
          const attention = needs.states.filter((s) => s.band === 'red' || s.band === 'critical')
          return (
            <EntranceGroup>
              {!needs.isPending && <EletjelStrip states={needs.states} onOpen={() => navigate('/nap/eletjel')} />}
              {eletjelek.map((m, i) => renderCard(m, i))}
              {!needs.isPending && eletjelek.length === 0 && attention.length === 0 && (
                <p className="nap-ejok rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                  Minden gyűrű rendben — ma nincs teendő. <Icon name="check" size={12} />
                </p>
              )}
              {!needs.isPending && eletjelek.length === 0 && attention.length > 0 && (
                <p className="nap-ejok warn rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                  {attention.length === 1
                    ? 'Egy gyűrű figyelmet kér'
                    : `${attention.length} gyűrű figyelmet kér`}
                  {' '}— a részletekért koppints a sávra.
                </p>
              )}
            </EntranceGroup>
          )
        })()}
      </PageBody>
    </MozaikPage>
  )
}
