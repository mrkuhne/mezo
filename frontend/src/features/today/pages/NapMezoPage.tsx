// ============================================================
// Mezo · NapMezoPage — „Beszélgetés”: Mezo üzenetei saját oldalon (mezo-d20.2.2; Folyadék
// mezo-n4wf5.2, prototípus vilagos/nap.js `uzenetek()`).
// Három fül (Üzenetek | Életjelek | Észrevételek), mindegyik EGY hőssel: az Üzenetek a nap
// fonalát mutatja összekötött cseppek soraként (ami új, gyűrűs), az Életjelek a hat kémcsövet,
// az Észrevételek a válaszra váró észrevételek számát.
// A szál felépítése (feed + cimkézett demo-briefing + Életjel-nudge-ok) és az olvasottság-vízjel
// a shell `MezoThreadProvider`-éé (mezo-atry) — ez az oldal és a fejléc badge-e ugyanazt az EGY
// szálat olvassa, így nem tudnak szétcsúszni.
// Fül-szétválasztás (mezo-ho9k): a szál ÉRINTETLEN, csak a megjelenítés bomlik a `?tab=` URL-en
// keresztül — `partitionMezoThread`/`MezoMessageItem.source === 'eletjel'` a kulcs
// (mezoMessages.ts). A régebbi üzenetek egysoros sorok egy kártyában, helyben nyílnak; belépéskori
// olvasatlan-pillanatkép a fül-pöttyökhöz és a hős „új” számához; a `?n=` deeplink mindig az
// Üzenetek fülre kényszerít.
// Csapatfal Act III (mezo-a9bo7.24): a napi tanácskártya a csapat-chatbe költözött. Ha a chatben
// van mai sor vagy nyitott ügy, az Üzenetek fülön EGY sor („A csapat most erről beszél” +
// a nyitott ügyek címkéi → /mezo/elo) áll a tanácskártya helyett; üres chat-napon a régi kártya
// marad (a kivezetés átfedő napja); a chat töltése alatt egyik sem. A kérdés-kártya és a deeplink-cél
// sosem rejtődik el.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'
import { SkeletonText } from '@/shared/ui/Skeleton'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RefChips } from '@/features/insights/components/RefChips'
import { EletjelStrip, needMemberForIcon } from '@/features/today/components/EletjelStrip'
import { needNameInSentence, needsAttention, needsAverage } from '@/features/today/logic/needsAverage'
import { useAdviceActions, useCompanionFeed, useFeedback, useObservations, useObservationReply, useTeamChat } from '@/data/hooks'
import type { TeamCharacterId } from '@/features/insights/logic/team'
import { stripText, talkedFlagKeys } from '@/features/insights/logic/teamChat'
import { renderInline } from '@/shared/lib/markdown'
import { ObservationCard, observationEyebrow } from '@/features/today/components/ObservationCard'
import { OBSERVATION_BUDGET } from '@/data/insights/observations'
import { feedToMessageItem, isQuestionCard, partitionMezoThread, questionAnswers, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { localDateString } from '@/shared/lib/dates'
import {
  Acts, Badge, Btn, Card, DropChain, ErrorRow, FrameBack, Hero, Lab, Lk, MEMBER_LABEL, Msg, Note, Page, Row, Section, Seg, Txt,
  type HeroProps, type Member,
} from '@/shared/ui/folyadek'

/** Ki szól egy üzenetben (bible §6: a csapat szakterület szerint). A nudge a kiváltó jel
 *  szakterületén szól (az ikonja `NEED_ICON`-ból jön); a feed-sor a saját fajtája szerint — az
 *  alvás-reakció az Alvásé, a víz az Étkezésé, az emberek a Közérzeté; minden más Mezo. */
function messageMember(m: MezoMessageItem): Member {
  const byNeed = needMemberForIcon(m.icon)
  if (byNeed) return byNeed
  if (m.kind === 'sleep') return 'szunya'
  if (m.kind === 'hydration') return 'falat'
  if (m.kind === 'people') return 'deru'
  return 'mezo'
}

/** A csapat-chat szereplője a kit arcai között (a Szkeptikus ott `szk`). */
const teamMember = (id: TeamCharacterId): Member => (id === 'szkeptikus' ? 'szk' : id)

/** Az üzenet fejsora: „HH:mm · fajta”. */
const messageHead = (m: MezoMessageItem): string => (m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow)

/** Hős, bal oldalán Mezo arcával (prototípus `hero({left})`, a kit `Hero left`). */
const FaceHero = (p: Omit<HeroProps, 'left'>) => <Hero left={<Badge member="mezo" size={64} />} {...p} />

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
  // Ugyanez a pillanatkép adja a hős „új” számát és a cseppsor gyűrűs cseppjeit (`ids`): a
  // megnyitás a vízjelet azonnal a szál végére teszi, a látogatás alatt mégis látszik, mi volt új.
  const [dots, setDots] = useState<{ uzenetek: boolean; eletjelek: boolean; ids: ReadonlySet<string> } | null>(null)
  useEffect(() => {
    if (dots !== null || messages.length === 0) return
    const unseen = messages.slice(messages.length - unread)
    setDots({
      uzenetek: unseen.some((m) => m.source !== 'eletjel'),
      eletjelek: unseen.some((m) => m.source === 'eletjel'),
      ids: new Set(unseen.map((m) => m.id)),
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
  // Töltés közben sem a sor, sem a régi kártya: különben valós módban a tanácskártya felvillanna,
  // majd eltűnne, amint a chat megérkezik.
  const teamKeys = useMemo(() => (teamChatLoading ? null : talkedFlagKeys(teamChat)),
    [teamChatLoading, teamChat])
  // Prepended, not merged into the shared thread: it is what the user just tapped, and the
  // shared thread stays the shell header's unread source of truth (mezo-atry) — untouched by a
  // deeplink that only this page consumes. Deep-linked cards are always companion messages,
  // never nudges, so they only ever join the Üzenetek pane.
  // A tanácskártya (advice, a kérdés-kártya kivételével) és elődje (intervention) a csapat-chatbe
  // költözött: az a kártya rejtőzik el, amelynek szabályáról (flagKey) a chat épp beszél — egy
  // nyitott ügy vagy egy mai sor ügye. A beállítás-ellenőrző kártya („Mezo · beállítás”,
  // pl. `missing_sleep_goal`) nem ügy, ezért marad (final review I4, mezo-a9bo7.25). A régi,
  // S4 előtti intervention-sornak nincs flagKey-e: azt a chat beszéde alatt továbbra is rejtjük.
  // Kivétel mindig: amire épp egy értesítés céloz.
  const sameDayDeepLink = crossDay == null ? deepLinkId : null
  const displayUzenetek = useMemo(() => {
    const movedToChat = (m: MezoMessageItem): boolean => {
      if (m.artifactId === sameDayDeepLink) return false
      if (m.kind !== 'intervention' && m.kind !== 'advice') return false
      if (m.kind === 'advice' && isQuestionCard(m)) return false
      if (teamKeys == null) return true
      if (m.flagKey) return teamKeys.has(m.flagKey)
      return m.kind === 'intervention' && teamTalks
    }
    const own = uzenetek.filter((m) => !movedToChat(m))
    return linkedItem ? [linkedItem, ...own] : own
  }, [linkedItem, uzenetek, teamKeys, teamTalks, sameDayDeepLink])
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
  // vége) nyílik teljes kártyaként alapból — a korábbiak egysoros gombok egy közös kártyában,
  // helyben nyílnak.
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

  // Egyetlen üzenet-törzs mindkét fülnek és a helyben kinyitott régebbi sornak (mezo-ho9k): a
  // visszajelzés-ág magától sem fut az Életjelek nudge-okon, mert azoknak nincs `artifactId`-jük
  // (mezo-kr9v szerződés).
  const messageBody = (m: MezoMessageItem) => (
    <>
      <Msg member={messageMember(m)} meta={messageHead(m)}>
        {m.paragraphs.map((p, j) => (
          <p key={j} className="nb-p"><SafeMarkdown text={p} /></p>
        ))}
      </Msg>
      {m.refs.length > 0 && <><Lab>Amire épült</Lab><RefChips refs={m.refs} /></>}
      {/* A question card's two suggestions ARE its two answer chips below (mezo-d58h.7.6) —
          listing them here too would say the same thing twice, one of them unclickable. */}
      {m.suggestions && m.suggestions.length > 0 && !questionAnswers(m) && (
        <ul className="nb-sug">
          {m.suggestions.map((s, j) => (
            <li key={j}><SafeMarkdown text={s} /></li>
          ))}
        </ul>
      )}
      {m.facts && m.facts.length > 0 && (
        <>
          <Lab>Miből gondolom</Lab>
          <ul className="nb-f2">
            {m.facts.map((f, j) => (
              <li key={j}><Icon3D name="t-info" size={18} /><span>{f}</span></li>
            ))}
          </ul>
        </>
      )}
      {m.meta && <Note>{m.meta}</Note>}
      {/* Advice-card action buttons (S5, mezo-d58h.5) — directly above „Segített?", gated on
          the card actually OFFERING an action. Once applied, the buttons are replaced by the
          applied state (never a disabled button — a tapped action is a completed thing, not
          a greyed-out one). Driven by the SERVER's `m.applied`, not local-only state: a reload
          re-reads the same feed row and shows the same applied state. */}
      {m.kind === 'advice' && m.artifactId != null && m.actions && m.actions.length > 0 && (
        m.applied ? (
          <Acts>
            <span className="nb-okline nb-applied">
              <Icon3D name="t-tick" size={18} />
              <span>{`Beállítva: ${m.actions.find((a) => a.key === m.applied!.actionKey)?.label ?? m.applied.actionKey}`}</span>
            </span>
          </Acts>
        ) : (
          <Acts className="nb-actions" role="group" aria-label="Javasolt lépés">
            {m.actions.map((a) => (
              <Btn key={a.key} sm disabled={advice.pending} onClick={() => advice.apply(m.artifactId!, a.key)}>
                {a.label}
              </Btn>
            ))}
            {advice.failedId === m.artifactId && (
              <span className="nb-err" role="alert">Nem sikerült — próbáld újra.</span>
            )}
          </Acts>
        )
      )}
      {/* Visszajelzés CSAK perzisztált AI-artifactre (mezo-kr9v); a „Segített?" felirat a
          W5.2 intervention-változat (mezo-b3pp.19) ÉS az S4 advice-kártya (mezo-d58h.4).
          KIVÉTEL a round-2 S5 kérdés-kártya (mezo-d58h.7.6): ott a két gomb maga a VÁLASZ, nem
          a kártya értékelése, ezért „A válaszod" felirat, a kérdés saját szavai a gombokon, és
          nincs indok-sor. */}
      {m.artifactId != null && (
        <div className="nb-fb">
          {isQuestionCard(m)
            ? <span className="nb-fbq">A válaszod</span>
            : (m.kind === 'intervention' || m.kind === 'advice') && <span className="nb-fbq">Segített?</span>}
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
    </>
  )
  const messageCard = (m: MezoMessageItem) => (
    <Card key={m.id} ref={m.id === scrollTargetId ? linkedCardRef : undefined} className="nb-msg">
      {messageBody(m)}
    </Card>
  )

  // Az Üzenetek fül két csoportja: a teljes kártyák (a szál legfrissebb hangja és a deeplink-cél —
  // ezek sosem csukhatók) és a korábbiak (egysoros sor; kinyitva helyben teljes, visszacsukható —
  // mezo-z4h4).
  const isFull = (m: MezoMessageItem, i: number) => i === displayUzenetek.length - 1 || m.id === scrollTargetId
  const fullCards = displayUzenetek.filter(isFull)
  const olderRows = displayUzenetek.filter((m, i) => !isFull(m, i))

  // A hős számai a TELJES mai szálból jönnek (mindkét fül; a más napról belinkelt kártya nem
  // számít bele — Finding 3), az „új” a belépéskori pillanatképből.
  const unseenIds = dots?.ids
  const newCount = unseenIds ? messages.filter((m) => unseenIds.has(m.id)).length : unread
  const threadVerdict = messages.length === 0
    ? 'Ma még nincs üzenet.'
    : newCount === 0 ? `${messages.length} üzenet.` : `${messages.length} üzenet, ${newCount} új.`
  const isNew = (m: MezoMessageItem, i: number) => (unseenIds ? unseenIds.has(m.id) : i >= messages.length - unread)
  const threadDrops = messages.map((m, i) => ({
    state: isNew(m, i) ? 'now' as const : 'done' as const,
    label: m.time ?? '',
    ariaLabel: `${messageHead(m)}${isNew(m, i) ? ' · új' : ''}`,
  })).slice(-6)

  // Az Életjelek fül mondata a jelek SÁVJÁBÓL jön, nem a (csendes ablakban elnyelhető) nudge-
  // listából (mezo-z4h4): `deriveNudges` éjjel és az ébredés utáni első órában nem ad kártyát,
  // attól a jel még figyelmet kér.
  const attention = needs.isPending ? [] : needs.states.filter(needsAttention)
  const needsAvg = needs.isPending ? null : needsAverage(needs.states)
  const needsVerdict = needs.isPending
    ? 'A jelek betöltése folyamatban.'
    : attention.length === 1
      ? `${needNameInSentence(attention[0].key).replace(/^a/, 'A')} az egyetlen, ami figyelmet kér.`
      : attention.length > 1
        ? `${attention.length} jel kér figyelmet.`
        : 'Minden jel rendben — ma nincs teendő.'

  const obsLoaded = !obs.isPending && !obs.isError && !obs.degraded
  const obsVerdict = obs.observations.length === 0
    ? 'Még nincs észrevétel — Mezo figyel.'
    : unansweredObservations === 1
      ? 'Egy észrevétel vár a válaszodra.'
      : unansweredObservations > 1
        ? `${unansweredObservations} észrevétel vár a válaszodra.`
        : 'Mindre válaszoltál. Köszönöm.'

  const olderNo = fullCards.length > 0 ? 2 : 1
  const replyNo = olderRows.length > 0 ? olderNo + 1 : olderNo
  return (
    <Page className="nb-page">
      <FrameBack history className="nb-back" onBack={() => navigate(-1)}>‹ Ma</FrameBack>
      <Seg tabs className="nb-pre" data-kalauz-anchor="uzenetek-tabs" aria-label="Mezo tartalom" value={tab} onChange={setTab} items={[
          { key: 'uzenetek', label: 'Üzenetek', dot: !!dots?.uzenetek && tab !== 'uzenetek' },
          { key: 'eletjelek', label: 'Életjelek', dot: !!dots?.eletjelek && tab !== 'eletjelek' },
          { key: 'eszrevetelek', label: 'Észrevételek', dot: unansweredObservations > 0 && tab !== 'eszrevetelek' },
        ]} />
      {tab === 'uzenetek' && (
        <>
          <FaceHero label="Mezo · ma" verdict={threadVerdict}
            sub="A napod fonala: amit ma észrevettünk és javasoltunk."
            actions={<Btn onClick={() => navigate('/mezo/chat')}>Beszélgess Mezóval</Btn>}>
            {threadDrops.length > 0 && <DropChain aria-label="A mai üzenetek sorban" items={threadDrops} />}
          </FaceHero>
          {teamTalks && (
            <>
              <TeamChatRow latest={teamLatest} openLabels={teamOpen.map((t) => t.ruleLabel)}
                faces={teamOpen.length > 0 ? teamOpen.map((t) => t.owner) : [teamLatest!.speaker]}
                onOpen={() => navigate('/mezo/elo')} />
              <Note>
                A napi tanácskártya innen átköltözött a csapat-chatbe — ott születik, ott reagálsz rá, és ott zárul le.
              </Note>
            </>
          )}
          {fullCards.length > 0 && (
            <>
              <Section n={1} title="Ma" />
              {fullCards.map(messageCard)}
            </>
          )}
          {olderRows.length > 0 && (
            <>
              <Section n={olderNo} title="Korábbi üzenetek" />
              <Card className="nb-older">
                {olderRows.map((m) => (isExpanded(m.id) ? (
                  <div key={m.id} className="fo-row nb-exp nb-msg">
                    {messageBody(m)}
                    <Lk aria-label="Összecsukás" aria-expanded={true} onClick={() => collapse(m.id)}>Összecsukom</Lk>
                  </div>
                ) : (
                  <Row key={m.id} className="nb-oldrow" aria-expanded={false} onClick={() => expand(m.id)}
                    left={<Badge member={messageMember(m)} size={36} />}
                    title={MEMBER_LABEL[messageMember(m)]}
                    sub={messageHead(m)}
                    more={<>{m.meta && <small className="nb-mt">{m.meta}</small>}<small className="nb-pv">{m.paragraphs[0]}</small></>}
                    right={<span className="chev" aria-hidden="true"><Icon name="chevron-down" size={14} /></span>} />
                )))}
              </Card>
            </>
          )}
          <Section n={replyNo} title="Írj vissza" />
          <Card>
            <Row left={<Badge member="mezo" size={36} />} title="Beszélgess Mezóval"
              sub="kérdezz, mesélj, vagy beszéljük át a napot" onClick={() => navigate('/mezo/chat')} />
          </Card>
        </>
      )}
      {tab === 'eletjelek' && (
        <>
          <Hero label={needsAvg == null ? 'Életjelek · ma' : `Életjelek · ma · átlag ${needsAvg}`}
            verdict={needsVerdict}
            sub={needs.isPending ? undefined : 'Koppints bármelyikre a részletekért.'}
            actions={<Btn onClick={() => navigate('/nap/eletjel')}>Részletek</Btn>}>
            {!needs.isPending && <EletjelStrip states={needs.states} onOpen={() => navigate('/nap/eletjel')} />}
          </Hero>
          {eletjelek.length > 0 && (
            <>
              <Section n={1} title="Amit a csapat mond" />
              {eletjelek.map(messageCard)}
            </>
          )}
        </>
      )}
      {tab === 'eszrevetelek' && (
        <>
          {/* Az oldal-állapotok háziszabály szerinti sorrendje: töltés → hiba → kikapcsolt
              társ → üres → tartalom. */}
          {obs.isPending && !obs.degraded && (
            <Card aria-busy="true"><SkeletonText lines={3} /></Card>
          )}
          {!obs.isPending && obs.isError && (
            <Card>
              <ErrorRow message="Az észrevételeket most nem sikerült betölteni." onRetry={() => obs.refetch()} />
            </Card>
          )}
          {!obs.isPending && !obs.isError && obs.degraded && (
            <Card>
              <Txt>
                A társ jelenleg nincs bekapcsolva — most nincs mit észrevennem. A napló, az
                edzés és a Fuel változatlanul működik.
              </Txt>
            </Card>
          )}
          {/* A hős mondata az üres állapot is („Még nincs észrevétel — Mezo figyel.”); a napi keret
              csak akkor áll alatta, ha van mit mutatni. */}
          {obsLoaded && (
            <FaceHero label="Észrevételek · ma" verdict={obsVerdict}
              sub={obs.observations.length > 0
                ? `Ma még ${budgetLeft} észrevétel fér a keretbe · ${OBSERVATION_BUDGET.quietFrom} után csendben maradok.`
                : undefined}
              actions={<Btn onClick={() => navigate('/mezo/chat')}>Beszéljük meg</Btn>} />
          )}
          {/* A lista kulcsa `item.id`: egy figyelt sor JOGOSAN jelenhet meg kétszer
              (esemény-kártya + sor-kártya) — ez a feed szándéka, nem duplikátum. */}
          {!obs.isPending && !obs.isError && obs.observations.map((o, i) => (
            <div key={o.id} className="nb-obsblock">
              <Section n={i + 1} title={observationEyebrow(o)} />
              <ObservationCard
                item={o}
                pending={observationReply.pendingPatternId === o.patternId}
                onReply={observationReply.reply}
              />
            </div>
          ))}
        </>
      )}
    </Page>
  )
}

/** A csapat-chat átadó sora (Csapatfal Act III, mezo-a9bo7.24; prototípus `uzenetek()` `.np-duo`
 *  sora): a nyitott ügyek gazdái, a címkéik, vagy ha nincs nyitott ügy, a nap legutóbbi mondata.
 *  Semmit nem fogalmaz (ADR 0049). */
function TeamChatRow({ latest, openLabels, faces, onOpen }: {
  latest: { speaker: TeamCharacterId; text: string } | null
  openLabels: string[]
  faces: TeamCharacterId[]
  onOpen: () => void
}) {
  const unique = [...new Set(faces)].slice(0, 3)
  return (
    <Card className="nb-team">
      <Row onClick={onOpen}
        left={<span className="nb-duo" aria-hidden="true">{unique.map((id) => <Badge key={id} member={teamMember(id)} size={30} />)}</span>}
        title="A csapat most erről beszél"
        sub={(
          <span className="nb-pv">
            {openLabels.length > 0
              ? openLabels.join(' · ')
              : latest && <><b>{MEMBER_LABEL[teamMember(latest.speaker)]}:</b> {renderInline(latest.text, { boldOnly: true })}</>}
          </span>
        )} />
    </Card>
  )
}
