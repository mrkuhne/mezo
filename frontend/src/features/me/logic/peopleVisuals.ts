import type { Affect, MentionContext, MentionSource } from '@/data/types'
import type { IconName } from '@/shared/ui/Icon'

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

export interface SrcMeta { label: string; clay?: 'i-naplo' | 'i-mezo'; icon?: IconName }

export const SRC_META: Record<MentionSource, SrcMeta> = {
  text: { label: 'napló', clay: 'i-naplo' },
  chat: { label: 'Mezo-chat', clay: 'i-mezo' },
  chip: { label: 'kézi', icon: 'check' },
  voice: { label: 'hang', icon: 'mic' },
  camera: { label: 'kamera', icon: 'camera' },
}
