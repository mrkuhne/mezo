// ============================================================
// Mezo · mezoMessages — a nap mezo-üzeneteinek egyetlen szála (mezo-e26w).
// NINCS új adatforrás: a szál a Mai lapon MÁR meglévő két hookból áll össze
// (`useToday().briefing` + `useCompanionNote()`). Ez a modul az a hely, ahova
// minden jövőbeli generált üzenet befűződik — a chip és a sheet érintése nélkül.
// Pure: no React, no hooks, no side effects.
// ============================================================
import type { Briefing, BriefingRef, CompanionNote } from '@/data/types'

export interface MezoMessageItem {
  /** Stabil a napon belül. */
  id: string
  eyebrow: string
  time: string | null
  /** Markdown-forrás; a renderelő `SafeMarkdown`-ozza. */
  paragraphs: string[]
  refs: BriefingRef[]
  meta: string | null
}

const NOTE_EYEBROW: Record<CompanionNote['kind'], string> = {
  nudge: 'Napközi jegyzet',
  closing: 'Napzárás',
}

/** A briefing eyebrow-ja hordozhat egy `HH:mm`-et (pl. „Mezo · reggeli briefing · 06:30"). */
const timeIn = (s: string): string | null => s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null

export function buildMezoMessages({ briefing, note, briefingDemo }: {
  briefing: Briefing | null
  note: CompanionNote | null
  briefingDemo?: boolean
}): MezoMessageItem[] {
  const out: MezoMessageItem[] = []
  if (briefing) {
    out.push({
      id: 'briefing',
      eyebrow: 'Reggeli briefing',
      time: timeIn(briefing.eyebrow),
      paragraphs: briefing.body.map((p) => p.text),
      refs: briefing.refs,
      meta: briefingDemo
        ? 'Demo tartalom'
        : briefing.confidence != null
          ? `Confidence ${Math.round(briefing.confidence * 100)}%`
          : null,
    })
  }
  if (note) {
    out.push({
      id: 'note',
      eyebrow: NOTE_EYEBROW[note.kind],
      time: note.window || null,
      paragraphs: [note.text],
      refs: [],
      meta: null,
    })
  }
  return out
}
