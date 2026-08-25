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
import type { Briefing, BriefingRef, FeedMessage, FeedMessageKind } from '@/data/types'

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
  meta: string | null
}

/** A briefing eyebrow-ja hordozhat egy `HH:mm`-et (pl. „Mezo · reggeli briefing · 06:30"). */
const timeIn = (s: string): string | null => s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null

/** Local `HH:mm` from a feed message's `generatedAt` ISO date-time. */
const hhmm = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function buildMezoMessages({ feed, demoBriefing, nudges }: {
  feed: FeedMessage[]
  demoBriefing: Briefing | null
  nudges?: MezoMessageItem[]
}): MezoMessageItem[] {
  const out: MezoMessageItem[] = feed.map((m) => ({
    id: m.kind,
    artifactId: m.id,
    kind: m.kind,
    eyebrow: m.eyebrow,
    time: hhmm(m.generatedAt),
    paragraphs: m.body.map((p) => p.text),
    refs: m.refs,
    meta: null,
  }))
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
