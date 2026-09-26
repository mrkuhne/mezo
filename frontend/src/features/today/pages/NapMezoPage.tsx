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
// Üveg (mezo-me75u.3, prototypes/uveg-nap.html#uzenetek): kis üveg vissza-pill, keret nélküli
// lavender+arany halo-hős az élő Mezo-Boop-pal, lapos szegmentált fülsor; a teljes üzenet
// `.glass` (lavender, a nudge a saját igény-színében), a régebbiek lapos egysoros cellák, a
// fej art-ja 3D ikon egy lit wellben. Csak a bőr változott: szál, fülek, chipek érintetlenek.
// Csapatfal Act III (mezo-a9bo7.24): a napi tanácskártya a csapat-chatbe költözött. Ha a chatben
// van mai sor vagy nyitott ügy, az Üzenetek fülön EGY lapos sor („A csapat most erről beszél” +
// a nyitott ügyek címkéi → /mezo/elo) áll a tanácskártya helyett; üres chat-napon a régi kártya
// marad (a kivezetés átfedő napja). A kérdés-kártya és a deeplink-cél sosem rejtődik el.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Boop, ContentIcon, Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { GhostState } from '@/shared/ui/GhostState'
import { SkeletonCard, SkeletonText } from '@/shared/ui/Skeleton'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { cn } from '@/shared/lib/cn'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RefChips } from '@/features/insights/components/RefChips'
import { EletjelStrip, needHueForIcon } from '@/features/today/components/EletjelStrip'
import { useAdviceActions, useCompanionFeed, useFeedback, useObservations, useObservationReply, useTeamChat } from '@/data/hooks'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { stripText } from '@/features/insights/logic/teamChat'
import '@/features/insights/boop-world.css'
import { ObservationCard } from '@/features/today/components/ObservationCard'
import { OBSERVATION_BUDGET } from '@/data/insights/observations'
import { feedToMessageItem, isQuestionCard, partitionMezoThread, questionAnswers, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { localDateString } from '@/shared/lib/dates'

/** The message head's art (üveg, mezo-me75u.3): a nudge carries its need's own clay icon (it
 *  renders through `CLAY_TO_3D`); a companion message carries a KIND, mapped here onto the 3D
 *  daypart set — evening/sleep → the moon, morning → the dawn, anything else → the bolt. The well
 *  around it takes the art's hue. */
function messageArt(m: MezoMessageItem): { name: ClayIconName | Icon3DName; hue?: string } {
  if (m.icon) return { name: m.icon }
  if (m.kind === 'sleep' || m.kind === 'evening') return { name: 't-moon', hue: 'var(--dv-lav)' }
  if (m.kind === 'morning' || m.id === 'briefing-demo') return { name: 't-dawn', hue: 'var(--dv-amber)' }
  return { name: 't-bolt', hue: 'var(--dv-amber)' }
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
  const advice = useAdviceActions()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)

  // Üzenetek | Életjelek tab-váltó (mezo-ho9k): a szál (sorrend, tartalom, a hero számláló
  // forrása) érintetlen — ez CSAK megjelenítési bontás a `?tab=` URL-en keresztül.
  type MezoTab = 'uzenetek' | 'eletjelek' | 'eszrevetelek'
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
    tabOverride
    ?? (deepLinkId
      ? 'uzenetek'
      : params.get('tab') === 'eletjelek'
        ? 'eletjelek'
        : params.get('tab') === 'eszrevetelek'
          ? 'eszrevetelek'
          : 'uzenetek')
  const setTab = (t: MezoTab) => {
    setTabOverride(t)
    const next = new URLSearchParams(params)
    if (t === 'uzenetek') next.delete('tab')
    else next.set('tab', t)
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
    // Az Észrevételek fül pöttye NEM ebből a pillanatképből jön (lásd lent) — ezért marad ki.
    if (tab !== 'eszrevetelek' && dots?.[tab]) setDots((d) => (d ? { ...d, [tab]: false } : d))
  }, [tab, dots])

  // Észrevételek fül (Reflexió S5, mezo-eq85.5). A pöttye MÁS FAJTA, mint a fenti kettőé: nem
  // a szál belépéskori olvasatlan-pillanatképéből származik (az egyszeri, `null`-őrzött effect,
  // az észrevételek viszont aszinkron érkeznek), hanem SZÁRMAZTATOTT — akkor ég, ha van
  // válaszra váró friss vagy visszatérő kártya. A fül megnyitásával magától elalszik, mert a válasz után a
  // kártya `repliedChoice`-t kap.
  const obs = useObservations()
  const observationReply = useObservationReply()
  const unansweredObservations = obs.observations.filter((o) =>
    (o.card === 'fresh' || o.card === 'return') && !o.repliedChoice).length
  // A napi keret maradéka: a backend `mezo.companion.reflection.notice` konfigjának emberi
  // tükre — a szám és a 22:00 nincs a dróton, ezért az `OBSERVATION_BUDGET` konstansból jön.
  // A `fresh` ÉS a `return` kártya EGYARÁNT beleszámít: szerver oldalon ugyanaz az esemény-fajta
  // mindkettő (az `ObservationBudget` a MA felszínre került összes észrevétel-eseményt vonja le
  // a napi keretből), a `return` csak annyiban más, hogy egy korábbi válasz UTÁN mutatjuk. Ha
  // csak a `fresh`-t vonnánk le, a lábléc egy visszatérő kártya mellett eggyel többet ígérne.
  const observationDay = localDateString(tick)
  const surfacedToday = obs.observations.filter((o) =>
    (o.card === 'fresh' || o.card === 'return')
      && localDateString(new Date(o.occurredAt)) === observationDay).length
  const budgetLeft = Math.max(0, OBSERVATION_BUDGET.perDay - surfacedToday)

  const { uzenetek, eletjelek } = useMemo(() => partitionMezoThread(messages), [messages])
  // A csapat-chat átadás (mezo-a9bo7.24): van-e ma mit mutatni a chatben.
  const { day: teamChat, loading: teamChatLoading } = useTeamChat()
  const teamLatest = teamChatLoading ? null : stripText(teamChat)
  const teamOpen = teamChatLoading ? [] : teamChat.openThreads
  const teamTalks = teamLatest != null || teamOpen.length > 0
  // Prepended, not merged into the shared thread: it is what the user just tapped, and the
  // shared thread stays the shell header's unread source of truth (mezo-atry) — untouched by a
  // deeplink that only this page consumes. Deep-linked cards are always companion messages,
  // never nudges, so they only ever join the Üzenetek pane.
  // A tanácskártya (advice, a kérdés-kártya kivételével) és elődje (intervention) a csapat-chatbe
  // költözött: amíg a chat beszél, itt nem jelenik meg — kivéve, ha épp egy értesítés céloz rá.
  const sameDayDeepLink = crossDay == null ? deepLinkId : null
  const displayUzenetek = useMemo(() => {
    const own = teamTalks
      ? uzenetek.filter((m) =>
          !((m.kind === 'intervention' || (m.kind === 'advice' && !isQuestionCard(m)))
            && m.artifactId !== sameDayDeepLink))
      : uzenetek
    return linkedItem ? [linkedItem, ...own] : own
  }, [linkedItem, uzenetek, teamTalks, sameDayDeepLink])
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
  const renderCard = (m: MezoMessageItem, i: number, opts?: { collapsible?: boolean }) => {
    const art = messageArt(m)
    return (
    <div
      key={m.id}
      ref={m.id === scrollTargetId ? linkedCardRef : undefined}
      className="nap-mzmsg glass rise"
      style={{ '--d': `${40 + i * 60}ms`, '--i': i, '--c': needHueForIcon(m.icon) ?? 'var(--dv-lav)' } as React.CSSProperties}
    >
      <div className="nap-mzmsg-h">
        <span className="nap-mzmsg-art uv-well" aria-hidden="true"
          style={art.hue ? { '--c': art.hue } as React.CSSProperties : undefined}>
          <ContentIcon name={art.name} size={30} />
        </span>
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
      {/* A question card's two suggestions ARE its two answer chips below (mezo-d58h.7.6) —
          listing them here too would say the same thing twice, one of them unclickable. */}
      {m.suggestions && m.suggestions.length > 0 && !questionAnswers(m) && (
        <ul className="nap-mzmsg-sug">
          {m.suggestions.map((s, j) => (
            <li key={j}><SafeMarkdown text={s} /></li>
          ))}
        </ul>
      )}
      {m.facts && m.facts.length > 0 && (
        <>
          <div className="nap-mzmsg-meta is-eb">Miből gondolom</div>
          <ul className="nap-mzmsg-facts">
            {m.facts.map((f, j) => (
              <li key={j}>{f}</li>
            ))}
          </ul>
        </>
      )}
      {m.meta && <div className="nap-mzmsg-meta">{m.meta}</div>}
      {/* Advice-card action buttons (S5, mezo-d58h.5) — directly above „Segített?", gated on
          the card actually OFFERING an action. Once applied, the buttons are replaced by the
          applied state (never a disabled button — a tapped action is a completed thing, not
          a greyed-out one). Driven by the SERVER's `m.applied`, not local-only state: a reload
          re-reads the same feed row and shows the same applied state. Reuses the `.chip.brand`
          recipe (`FeedbackChips`, right below in this same card) for the button itself. */}
      {m.kind === 'advice' && m.artifactId != null && m.actions && m.actions.length > 0 && (
        m.applied ? (
          <div className="nap-mzmsg-applied">
            <Icon3D name="t-tick" size={20} />
            {m.actions.find((a) => a.key === m.applied!.actionKey)?.label ?? m.applied.actionKey}
          </div>
        ) : (
          <div className="nap-mzmsg-actions" role="group" aria-label="Javasolt lépés">
            {m.actions.map((a) => (
              <button
                key={a.key}
                type="button"
                className="chip brand"
                disabled={advice.pending}
                onClick={() => advice.apply(m.artifactId!, a.key)}
              >
                {a.label}
              </button>
            ))}
            {advice.failedId === m.artifactId && (
              <span className="nap-mzmsg-actionerr" role="alert">Nem sikerült — próbáld újra.</span>
            )}
          </div>
        )
      )}
      {/* Chips CSAK perzisztált AI-artifactre (mezo-kr9v); a „Segített?" felirat a
          W5.2 intervention-változat (mezo-b3pp.19) ÉS az S4 advice-kártya (mezo-d58h.4) —
          a sheet szerződése változatlanul. KIVÉTEL a round-2 S5 kérdés-kártya
          (mezo-d58h.7.6): ott a 👍/👎 maga a VÁLASZ, nem a kártya értékelése, ezért „A
          válaszod" felirat, a kérdés saját szavai a chipeken, és nincs indok-sor. */}
      {m.artifactId != null && (
        <div className="nap-mzmsg-fb">
          {isQuestionCard(m)
            ? <div className="nap-mzmsg-meta is-eb">A válaszod</div>
            : (m.kind === 'intervention' || m.kind === 'advice') && <div className="nap-mzmsg-meta is-eb">Segített?</div>}
          <FeedbackChips
            key={m.artifactId}
            value={feedback.get(m.artifactId)}
            onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
            answers={questionAnswers(m)}
            label={isQuestionCard(m)
              ? 'a kérdésre'
              : m.kind === 'intervention' || m.kind === 'advice' ? 'a közbelépésről' : 'az üzenetről'}
          />
        </div>
      )}
    </div>
    )
  }

  return (
    <MozaikPage tone="coral" className="nap-mzpage">
      {/* The house PageHead markup (same button, same name), worn as a small still glass pill
          (üveg, mezo-me75u.3) — PageHead itself takes no class. */}
      <div className="mz-page-head">
        <button type="button" className="mz-backbtn glass is-still" onClick={() => navigate(-1)} aria-label="Vissza">
          ‹ Ma
        </button>
      </div>
      {/* Hero (rank 1): no card — a frameless lavender + gold halo around the living Mezo Boop,
          then name → sub (no bignum). */}
      <div className="mz-page-hero nap-mzhero uv-halo">
        <Boop domain="mezo" size={90} alive />
        <div className="mz-hero-nm">Mezo · ma</div>
        {/* Today's own message count (Finding 3) — a cross-day deeplink prepends one extra card
            to the Üzenetek pane that is not part of today's thread; the label must not count it.
            The TELJES szál (mindkét tab) számít, a tab-bontás csak megjelenítés. */}
        <div className="mz-hero-sb">{messages.length} üzenet · a napod fonala</div>
      </div>
      <PageBody>
        <div className="nap-mzseg uv-flat" role="tablist" aria-label="Mezo tartalom" data-kalauz-anchor="uzenetek-tabs">
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
          <button type="button" role="tab" aria-selected={tab === 'eszrevetelek'}
            className={cn(tab === 'eszrevetelek' && 'on')} onClick={() => setTab('eszrevetelek')}>
            Észrevételek
            {unansweredObservations > 0 && tab !== 'eszrevetelek' && <span className="nap-mzdot" />}
          </button>
        </div>
        {tab === 'uzenetek' && (
          <EntranceGroup>
            {teamTalks && (
              <TeamChatRow latest={teamLatest} openLabels={teamOpen.map((t) => t.ruleLabel)}
                faces={teamOpen.length > 0 ? teamOpen.map((t) => t.owner) : [teamLatest!.speaker]}
                onOpen={() => navigate('/mezo/elo')} />
            )}
            {displayUzenetek.map((m, i) =>
              i === displayUzenetek.length - 1 || isExpanded(m.id) || m.id === scrollTargetId ? (
                renderCard(m, i, {
                  collapsible:
                    isExpanded(m.id) && i !== displayUzenetek.length - 1 && m.id !== scrollTargetId,
                })
              ) : (
                <button type="button" key={m.id} className="nap-mzrow uv-flat rise"
                  style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
                  aria-expanded="false" onClick={() => expand(m.id)}>
                  <ContentIcon name={messageArt(m).name} size={24} />
                  <span className="grow">
                    <span className="hd">
                      <span className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</span>
                      {m.meta && <span className="mt">{m.meta}</span>}
                    </span>
                    <span className="pv">{m.paragraphs[0]}</span>
                  </span>
                  <span className="chev" aria-hidden="true">
                    <Icon name="chevron-down" size={12} />
                  </span>
                </button>
              ),
            )}
            <button type="button" className="nap-mz-cta glass rise"
              style={{ '--d': `${40 + displayUzenetek.length * 60}ms`, '--c': 'var(--dv-lav)' } as React.CSSProperties}
              onClick={() => navigate('/mezo/chat')}>
              <Boop domain="mezo" size={30} />
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
                  <Icon3D name="t-tick" size={22} />
                  Minden gyűrű rendben — ma nincs teendő.
                </p>
              )}
              {!needs.isPending && eletjelek.length === 0 && attention.length > 0 && (
                <p className="nap-ejok warn rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                  <Icon3D name="t-heart" size={22} />
                  {attention.length === 1
                    ? 'Egy gyűrű figyelmet kér'
                    : `${attention.length} gyűrű figyelmet kér`}
                  {' '}— a részletekért koppints a sávra.
                </p>
              )}
            </EntranceGroup>
          )
        })()}
        {tab === 'eszrevetelek' && (
          <EntranceGroup>
            {/* Az oldal-állapotok háziszabály szerinti sorrendje: töltés → hiba → kikapcsolt
                társ → üres → tartalom. */}
            {obs.isPending && !obs.degraded && (
              <SkeletonCard><SkeletonText lines={3} /></SkeletonCard>
            )}
            {!obs.isPending && obs.isError && (
              <div className="nap-obs-ghost">
                <GhostState
                  message="Az észrevételeket most nem sikerült betölteni."
                  ctaLabel="Újra"
                  onCta={() => obs.refetch()}
                />
              </div>
            )}
            {!obs.isPending && !obs.isError && obs.degraded && (
              <p className="nap-obs-empty uv-empty rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                A társ jelenleg nincs bekapcsolva — most nincs mit észrevennem. A napló, az
                edzés és a Fuel változatlanul működik.
              </p>
            )}
            {!obs.isPending && !obs.isError && !obs.degraded && obs.observations.length === 0 && (
              <p className="nap-obs-empty uv-empty rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                Még nincs észrevétel — Mezo figyel.
              </p>
            )}
            {/* A lista kulcsa `item.id`: egy figyelt sor JOGOSAN jelenhet meg kétszer
                (esemény-kártya + sor-kártya) — ez a feed szándéka, nem duplikátum. */}
            {!obs.isPending && !obs.isError && obs.observations.map((o, i) => (
              <div key={o.id} className="rise" style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}>
                <ObservationCard
                  item={o}
                  pending={observationReply.pendingPatternId === o.patternId}
                  onReply={observationReply.reply}
                />
              </div>
            ))}
            {!obs.isPending && !obs.isError && !obs.degraded && obs.observations.length > 0 && (
              <div className="nap-obs-quiet rise"
                style={{ '--d': `${40 + obs.observations.length * 60}ms` } as React.CSSProperties}>
                <Icon3D name="t-moon" size={22} />
                Ma még {budgetLeft} észrevétel fér a keretbe · {OBSERVATION_BUDGET.quietFrom} után
                csendben maradok
              </div>
            )}
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}

/** A csapat-chat átadó sora (Csapatfal Act III, mezo-a9bo7.24) — LAPOS sor (a fül rangsorában a
 *  régebbi üzenetek szintje), nem üveg: a nyitott ügyek gazdái, a címkéik, vagy ha nincs nyitott
 *  ügy, a nap legutóbbi mondata. Semmit nem fogalmaz (ADR 0049). */
function TeamChatRow({ latest, openLabels, faces, onOpen }: {
  latest: { speaker: TeamCharacterId; text: string } | null
  openLabels: string[]
  faces: TeamCharacterId[]
  onOpen: () => void
}) {
  const unique = [...new Set(faces)].slice(0, 3)
  return (
    <button type="button" className="nap-mzteam uv-flat rise" onClick={onOpen}>
      <span className="nap-mzteam-minis" aria-hidden="true">
        {unique.map((id) => <FeedAvatar key={id} id={id} size={20} />)}
      </span>
      <span className="grow">
        <span className="nap-mzteam-t">A csapat most erről beszél</span>
        <span className="pv">
          {openLabels.length > 0
            ? openLabels.join(' · ')
            : latest && `${TEAM[latest.speaker].name}: ${latest.text.replace(/\*\*/g, '')}`}
        </span>
      </span>
      <span className="chev" aria-hidden="true">›</span>
    </button>
  )
}
