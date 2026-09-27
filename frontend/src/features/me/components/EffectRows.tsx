import {
  CONFIDENCE_META, EFFECT_SIGNAL, STRENGTH_META, confidenceAria, effectEvidenceLine, strengthAria,
} from '@/features/me/logic/effectCopy'
import type { PersonEffect } from '@/data/types'

/** One signal as 1–3 dots: filled for strength, hollow rings for confidence (Exist pattern). */
export function EffectDots({ n, ring, label }: { n: number; ring?: boolean; label: string }) {
  return (
    <span className={`ppl-effdots${ring ? ' ring' : ''}`} role="img" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

/**
 * S4 (mezo-d6ivw.4) → S6 (mezo-d6ivw.6): the "Hatás · együttjárás" indicator rows — a careful,
 * non-causal sentence, strength and confidence as two SEPARATE dot rows, "N nap alapján", and the
 * standing footnote. Shared by the person page and the Tudástár Hatások cards; the caller owns
 * the (glass) card around it and the sentence (person vs event subject).
 */
export function EffectRows({ effects, sentence }: { effects: PersonEffect[]; sentence: (e: PersonEffect) => string }) {
  return (
    <>
      {effects.map((e, i) => (
        <div className="ppl-effrow" key={`${e.metric}-${i}`}>
          <p className="ppl-effsent">{sentence(e)}</p>
          <div className="ppl-effmeta">
            <span className="ppl-effsig">
              <small>{EFFECT_SIGNAL.strength}</small>
              <EffectDots n={STRENGTH_META[e.strength].n} label={strengthAria(e)} />
              <em>{STRENGTH_META[e.strength].label}</em>
            </span>
            <span className="ppl-effsig">
              <small>{EFFECT_SIGNAL.confidence}</small>
              <EffectDots n={CONFIDENCE_META[e.confidence].n} ring label={confidenceAria(e)} />
              <em>{CONFIDENCE_META[e.confidence].label}</em>
            </span>
            <em className="ppl-effn">{effectEvidenceLine(e)}</em>
          </div>
        </div>
      ))}
      <p className="ppl-efffoot">{EFFECT_SIGNAL.foot}</p>
    </>
  )
}
