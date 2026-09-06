// ============================================================
// Mezo · mezoMessages — a nap mezo-üzeneteinek egyetlen szála (mezo-e26w, feed-alapra
// kötve mezo-gst9-ben). A szál a unified companion-feedből épül (`useCompanionFeed`,
// data/today/feedHooks.ts): egy elem egy `FeedMessage`, kind→id, a bekezdéseket és a
// refeket 1:1 hordozza. Ha a feedben nincs `morning` kind ÉS van demo briefing, a
// szál elé egy őszintén cimkézett demo-kártya kerül — a mock mód és a real mód
// cold-load ablakának egyetlen látható állapota. A szál VÉGÉRE opcionálisan
// küszöb-nudge-ok (`nudges`, mezo-dhzk Task 5 — `needsNudges.ts`) csatlakoznak: ők a
// nap legfrissebb hangjai, ezért a demo-briefing előtag UTÁN, minden más elem UTÁN
// jönnek. Pure: no React, no hooks, no side effects.
// ============================================================
import type { Briefing, BriefingRef, FeedAction, FeedApplied, FeedMessage, FeedMessageKind } from '@/data/types'
import type { ClayIconName } from '@/shared/ui/clay'

export interface MezoMessageItem {
  /** Stabil a napon belül: a feed KINDJE (`morning`/`sleep`/…) vagy a nudge/demo kulcsa —
   *  React-kulcs ÉS a látott-üzenet kulcs. NEM artifact-azonosító. */
  id: string
  /** A perzisztált companion_message sor uuid-je — a `feed_message` visszajelzés artifactId-je
   *  (mezo-b3pp.15). CSAK feed-sorokon van: a cimkézett demo-briefing kártya és a küszöb-nudge
   *  nem perzisztált AI-artifact, nincs mire visszajelezni — chip sem ülhet rájuk (mezo-kr9v). */
  artifactId?: string
  /** A feed-sor eredeti kindje (W5.2, mezo-b3pp.19) — CSAK feed-sorokon van, a demo/nudge
   *  elemeknek nincs. A sheet ez alapján választja a „Segített?" kártya-változatot
   *  intervention kindre. */
  kind?: FeedMessageKind
  eyebrow: string
  time: string | null
  /** Markdown-forrás; a renderelő `SafeMarkdown`-ozza. */
  paragraphs: string[]
  refs: BriefingRef[]
  /** Advice-card evidence (S4, mezo-d58h.4) — rendered as the „Miből gondolom" list. Feed advice
   *  rows only; demo/nudge items never have it. */
  facts?: string[]
  /** Advice-card suggestions — rendered as the card's action-less bullet list until S5 turns the
   *  actionable ones into buttons. */
  suggestions?: string[]
  /** The SEVERITY key the card came from (mezo-6269.2) — a flag key, a setup-check key, or a
   *  once-ever QUESTION key (round 2 S5, mezo-d58h.7.5). Feed advice rows only. Carried through
   *  because a question card is an advice row that must NOT be labelled „Segített?" — the 👍/👎
   *  on it IS the answer (mezo-d58h.7.6); see {@link isQuestionCard}. */
  flagKey?: string
  /** Advice-card action buttons (S5, mezo-d58h.5) — rendering is a later task; carried through
   *  here so it reaches the thread item. Feed advice rows only; demo/nudge items never have it. */
  actions?: FeedAction[]
  /** Advice-card applied stamp (S5, mezo-d58h.5). Feed advice rows only; demo/nudge items never
   *  have it. */
  applied?: FeedApplied
  meta: string | null
  /** Tab-partíció kulcs (mezo-ho9k): 'eletjel' = Életjel-figyelő nudge — a NapMezoPage
   *  Életjelek tabjára tartozik. Hiánya = companion-üzenet (Üzenetek tab). */
  source?: 'eletjel'
  /** mezo-z4h4: a küszöb-nudge kártya domain clay ikonja (a nudge-ot kiváltó `NeedKey`
   *  ikonja, `VITAL_TILE`-ból, `EletjelPage.tsx`) — csak nudge-elemeken van, felváltja a
   *  kártya fején az emojit/daypart-spotot. Feed-soroknak nincs. */
  icon?: ClayIconName
}

/** A briefing eyebrow-ja hordozhat egy `HH:mm`-et (pl. „Mezo · reggeli briefing · 06:30"). */
const timeIn = (s: string): string | null => s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null

/** Local `HH:mm` from a feed message's `generatedAt` ISO date-time. */
const hhmm = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** One feed row → one thread card. Exported so a deep-linked card from another day
 *  (mezo-b3pp.36 — `NapMezoPage`) gets the SAME rendering (time/paragraphs/refs/artifactId)
 *  as any row `buildMezoMessages` pulls from today's own feed; the caller overrides `id` since
 *  `m.kind` alone is not unique once a card from a second day joins the thread. */
export function feedToMessageItem(m: FeedMessage): MezoMessageItem {
  return {
    id: m.kind,
    artifactId: m.id,
    kind: m.kind,
    flagKey: m.flagKey,
    eyebrow: m.eyebrow,
    time: hhmm(m.generatedAt),
    paragraphs: m.body.map((p) => p.text),
    refs: m.refs,
    facts: m.facts,
    suggestions: m.suggestions,
    actions: m.actions,
    applied: m.applied,
    meta: null,
  }
}

export function buildMezoMessages({ feed, demoBriefing, nudges }: {
  feed: FeedMessage[]
  demoBriefing: Briefing | null
  nudges?: MezoMessageItem[]
}): MezoMessageItem[] {
  const out: MezoMessageItem[] = feed.map(feedToMessageItem)
  // Honest fallback: no generated morning briefing has landed in the feed yet — show the
  // labelled demo card instead of leaving the thread empty (mock mode: always this branch).
  if (!feed.some((m) => m.kind === 'morning') && demoBriefing != null) {
    out.unshift({
      id: 'briefing-demo',
      eyebrow: 'Reggeli briefing',
      time: timeIn(demoBriefing.eyebrow),
      paragraphs: demoBriefing.body.map((p) => p.text),
      refs: demoBriefing.refs,
      meta: 'Demo tartalom',
    })
  }
  if (nudges && nudges.length > 0) out.push(...nudges)
  return out
}

/** A NapMezoPage két tabjának partíciója (mezo-ho9k). Pure, sorrendtartó — a szál
 *  maga (sorrend, tartalom) érintetlen: ez CSAK megjelenítési bontás. */
export function partitionMezoThread(messages: MezoMessageItem[]): {
  uzenetek: MezoMessageItem[]
  eletjelek: MezoMessageItem[]
} {
  return {
    uzenetek: messages.filter((m) => m.source !== 'eletjel'),
    eletjelek: messages.filter((m) => m.source === 'eletjel'),
  }
}

/** A once-ever QUESTION card (round 2 S5, `OneTimeQuestionService`) — an `advice` row whose
 *  severity key is one of the `question_*` keys. It looks like an advice card and is delivered
 *  by the same machinery, but the 👍/👎 on it is the ANSWER, not a rating of the card, so it must
 *  never wear the „Segített?" label or open the negative reason row (mezo-d58h.7.6). Prefix match
 *  on purpose: every future question key starts the same way, and a new one must behave right on
 *  the day the backend starts asking it, with no frontend change. */
export function isQuestionCard(m: MezoMessageItem): boolean {
  return m.kind === 'advice' && (m.flagKey?.startsWith('question_') ?? false)
}

/** The two answers a question card offers, taken from its own `suggestions` — the backend writes
 *  them as „👍 — …" / „👎 — …" (`OneTimeQuestionService`), and they belong ON the two chips rather
 *  than in a bullet list above them: the button should say what tapping it means. Returns
 *  `undefined` for anything that is not exactly that shape, so the chips fall back to their
 *  default wording instead of rendering a guess. */
export function questionAnswers(m: MezoMessageItem): { up: string; down: string } | undefined {
  const s = m.suggestions
  if (!isQuestionCard(m) || !s || s.length !== 2) return undefined
  const up = stripThumb(s[0], '\u{1F44D}')
  const down = stripThumb(s[1], '\u{1F44E}')
  return up && down ? { up, down } : undefined
}

function stripThumb(line: string, thumb: string): string | null {
  if (!line.startsWith(thumb)) return null
  return line.slice(thumb.length).replace(/^\s*[—–-]\s*/, '').trim() || null
}
