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
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClaySpot, type ClaySpotName } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { cn } from '@/shared/lib/cn'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
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
  const { messages, markSeen } = useMezoThread()
  const feed = useCompanionFeed()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)

  // Üzenetek | Életjelek tab-váltó (mezo-ho9k): a szál (sorrend, tartalom, a hero számláló
  // forrása) érintetlen — ez CSAK megjelenítési bontás a `?tab=` URL-en keresztül.
  type MezoTab = 'uzenetek' | 'eletjelek'
  const tab: MezoTab = params.get('tab') === 'eletjelek' ? 'eletjelek' : 'uzenetek'
  const setTab = (t: MezoTab) => {
    const next = new URLSearchParams(params)
    if (t === 'eletjelek') next.set('tab', 'eletjelek')
    else next.delete('tab')
    setParams(next, { replace: true })
  }
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

  // Egyetlen kártya-JSX mindkét pane-nek (mezo-ho9k): a chips-ág magától sem fut az
  // Életjelek nudge-okon, mert azoknak nincs `artifactId`-jük (mezo-kr9v szerződés).
  const renderCard = (m: MezoMessageItem, i: number) => (
    <div
      key={m.id}
      ref={m.id === scrollTargetId ? linkedCardRef : undefined}
      className="nap-mzmsg rise"
      style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
    >
      <div className="nap-mzmsg-h">
        <ClaySpot name={messageSpot(m)} size={35} />
        <div className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</div>
      </div>
      {m.paragraphs.map((p, j) => (
        <p key={j} className="txt"><SafeMarkdown text={p} /></p>
      ))}
      {m.refs.length > 0 && (
        <div className="nap-mzmsg-refs">
          {m.refs.map((r, j) => <RefTag key={j} kind={r.kind} label={r.label} />)}
        </div>
      )}
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
        <div className="nap-mzseg" role="tablist" aria-label="Mezo tartalom">
          <button type="button" role="tab" aria-selected={tab === 'uzenetek'}
            className={cn(tab === 'uzenetek' && 'on')} onClick={() => setTab('uzenetek')}>
            Üzenetek
          </button>
          <button type="button" role="tab" aria-selected={tab === 'eletjelek'}
            className={cn(tab === 'eletjelek' && 'on')} onClick={() => setTab('eletjelek')}>
            Életjelek
          </button>
        </div>
        {tab === 'uzenetek' && (
          <EntranceGroup>
            {displayUzenetek.map((m, i) =>
              i === displayUzenetek.length - 1 || isExpanded(m.id) || m.id === scrollTargetId ? (
                renderCard(m, i)
              ) : (
                <button type="button" key={m.id} className="nap-mzrow rise"
                  style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
                  aria-expanded="false" onClick={() => expand(m.id)}>
                  <span className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</span>
                  <span className="pv">{m.paragraphs[0]}</span>
                  <span className="chev" aria-hidden="true">▾</span>
                </button>
              ),
            )}
            <button type="button" className="nap-mz-cta rise" style={{ '--d': `${40 + displayUzenetek.length * 60}ms` } as React.CSSProperties}
              onClick={() => navigate('/mezo/chat')}>
              Beszélgess Mezóval ›
            </button>
          </EntranceGroup>
        )}
        {tab === 'eletjelek' && (
          <EntranceGroup>
            {!needs.isPending && <EletjelStrip states={needs.states} onOpen={() => navigate('/nap/eletjel')} />}
            {eletjelek.map((m, i) => renderCard(m, i))}
            {!needs.isPending && eletjelek.length === 0 && (
              <p className="nap-ejok rise" style={{ '--d': '100ms' } as React.CSSProperties}>
                Minden gyűrű rendben — ma nincs teendő. ✓
              </p>
            )}
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}
