import type { Affect, MentionContext, MentionSource } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'

/**
 * Emberek S3 hub — visual meta for tones/contexts/sources (mezo-06o0.2).
 * Source: docs/design_2.0/prototypes/src/emberek-body.html, the `TONES` / `CTX` / `SRC`
 * IIFE objects — labels and hexes verbatim (the hexes live as `--ppl-*` CSS tokens in
 * prototype.css, both `:root` blocks; this module only carries the token references).
 */
export interface ToneMeta { label: string; cssVar: string }

export const TONE_META: Record<Affect, ToneMeta> = {
  positive: { label: 'Jó', cssVar: '--ppl-tone-jo' },
  neutral: { label: 'OK', cssVar: '--ppl-tone-ok' },
  mixed: { label: 'Vegyes', cssVar: '--ppl-tone-vegyes' },
  negative: { label: 'Nehéz', cssVar: '--ppl-tone-nehez' },
}

/** The tone as a CSS colour — the ring / edge / dot a person or mention wears. On the üveg
 *  pages the `--ppl-tone-*` tokens resolve to the Mozaik accents (Jó sage, OK sky, Vegyes
 *  amber, Nehéz coral; `── uveg en2 emberek (` block, mezo-me75u.7), so colour keeps
 *  carrying the tone (bible U6 rule 46). */
export function toneColor(a: Affect): string {
  return `var(${(TONE_META[a] ?? TONE_META.neutral).cssVar})`
}

/** "Worst first" — the order the weekly-rhythm column picks a day's worst tone in. */
export const TONE_ORDER: Affect[] = ['negative', 'mixed', 'positive', 'neutral']

export interface CtxMeta { label: string; cssVar: string }

export const CTX_META: Record<MentionContext, CtxMeta> = {
  munka: { label: 'munka', cssVar: '--ppl-ctx-munka' },
  csalad: { label: 'család', cssVar: '--ppl-ctx-csalad' },
  baratok: { label: 'barátok', cssVar: '--ppl-ctx-baratok' },
  edzes: { label: 'edzés', cssVar: '--ppl-ctx-edzes' },
  konfliktus: { label: 'konfliktus', cssVar: '--ppl-ctx-konfliktus' },
  kozos_program: { label: 'közös program', cssVar: '--ppl-ctx-kozos-program' },
  segitseg: { label: 'segítség', cssVar: '--ppl-ctx-segitseg' },
  egyeb: { label: 'egyéb', cssVar: '--ppl-ctx-egyeb' },
}

/** Source → label + its Titanium 3D icon (üveg, mezo-me75u.7). Mapped here, at the call site,
 *  because the clay glyphs were ambiguous (`i-mezo` is Mezo itself elsewhere; here it means
 *  "came from a Mezo chat"). */
export interface SrcMeta { label: string; art: Icon3DName }

export const SRC_META: Record<MentionSource, SrcMeta> = {
  text: { label: 'napló', art: 't-journal' },
  chat: { label: 'Mezo-chat', art: 't-chat' },
  chip: { label: 'kézi', art: 't-tick' },
  voice: { label: 'hang', art: 't-mic' },
  camera: { label: 'kamera', art: 't-camera' },
}

/** Gráf-node fajta → magyar címke, 3D ikon és tónus. A tónus a sor ikon-kútjának fénye
 *  (életesemény = arany, cél = zsálya, minden más = levendula). Az ikonok itt, a hívásnál
 *  vannak leképezve (i-kristaly / i-termes / i-mezo több jelentésű, bible U3 rule 20). */
export const GRAPH_KIND_META: Record<string, { label: string; art: Icon3DName; tone: 'amber' | 'sage' | 'lav' }> = {
  LIFE_EVENT: { label: 'Életesemény', art: 't-pin', tone: 'amber' },
  GOAL: { label: 'Cél', art: 't-ring', tone: 'sage' },
  PATTERN: { label: 'Minta', art: 't-pattern', tone: 'lav' },
  PREFERENCE: { label: 'Preferencia', art: 't-book', tone: 'lav' },
  SEASON: { label: 'Szezon', art: 't-harvest', tone: 'lav' },
  INSIGHT: { label: 'Belátás', art: 't-orb', tone: 'lav' },
  PERSON: { label: 'Ember', art: 't-people', tone: 'lav' },
}

/** Ismeretlen fajta (egy jövőbeli node-kind) nem tünteti el a sort: semleges levendula. */
export const GRAPH_KIND_FALLBACK = { label: 'Csomópont', art: 't-book', tone: 'lav' } as const
