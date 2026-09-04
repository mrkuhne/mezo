import { Link } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { patternCategoryColor } from '@/data/insights/insights'
import { PatternDomainMark } from '@/features/insights/components/PatternDomainMark'
import { confidenceMeta, findingSentence, pairLine, type ConfidenceMeta } from '@/features/insights/logic/findings'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import type { Pattern, PatternMonitorPair, PatternStatus } from '@/data/types'

const TONE_COLOR: Record<ConfidenceMeta['tone'], { bg: string; border: string; text: string }> = {
  success: { bg: 'var(--success-bg)', border: 'var(--success-soft)', text: 'var(--success-deep)' },
  accent: { bg: 'var(--accent-bg)', border: 'var(--accent-soft)', text: 'var(--accent-deep)' },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-soft)', text: 'var(--warning-deep)' },
}

/**
 * A döntés-inbox kártyája (spec 2026-08-14 · mezo-tk88.4): kérdés-cím + eddigi lelet + 3
 * döntés-gomb + „Részletek és előzmények →". A nyers r/p/n SOHA nem jelenik meg itt — csak a
 * humán fordítás (`findingSentence`/`confidenceMeta`); a diagnosztika a részletes oldalé.
 */
export function PatternDecisionCard({
  pattern,
  pair,
  onDecide,
  showExplainer = false,
  titleSize = 17,
  showDetailLink = true,
}: {
  pattern: Pattern
  pair: PatternMonitorPair | null
  onDecide: (d: PatternStatus) => void
  /** csak az inbox ELSŐ kártyáján */
  showExplainer?: boolean
  /** a részlet-oldal fejléc-kártyája (mezo-tk88.5) nagyobb címet kap, mint az inbox-kártya */
  titleSize?: number
  /** hamis a részlet-oldalon (mezo-tk88.5 review fix) — a „Részletek és előzmények →" link
   *  önmagára mutatna, ha a kártya már a részlet-oldal fejléce */
  showDetailLink?: boolean
}) {
  const railColor = patternCategoryColor(pattern.category)
  const status = pattern.status ?? 'proposed'
  const confidence = pair != null && pair.n != null && pair.p != null ? confidenceMeta(pair.n, pair.p) : null
  const finding = pair?.r != null ? findingSentence(pair) : null
  const questionTitle = pair?.questionHu ?? pattern.title

  return (
    <div className="card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: railColor }} />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        {pair ? (
          <span className="chip" style={{ fontSize: 10, padding: '4px 10px' }}>
            <PatternDomainMark domain={pair.metricBDomain} size={16} />
          </span>
        ) : (
          <span className="chip" style={{ fontSize: 10, padding: '4px 10px' }}>{pattern.categoryLabel}</span>
        )}
        {confidence ? (
          <span
            className="chip"
            style={{
              fontSize: 10, padding: '4px 10px', fontWeight: 700,
              background: TONE_COLOR[confidence.tone].bg,
              borderColor: TONE_COLOR[confidence.tone].border,
              color: TONE_COLOR[confidence.tone].text,
            }}
          >
            {confidence.chip}
          </span>
        ) : (
          <span className="eyebrow text-tertiary">
            {/* mezo-d20.11: „conf 69%" was the last English string on this card. There is no
                n/p for an AI-hypothesis row, so confidenceMeta cannot speak — but the model's
                own confidence is a real datum; it just says it in Hungarian now. */}
            {pattern.confidence != null ? `bizonyosság ${(pattern.confidence * 100).toFixed(0)}%` : 'tanulom'}
          </span>
        )}
      </div>

      <div style={{ fontFamily: 'var(--ff-display)', fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 10, lineHeight: 1.3, color: 'var(--text-primary)' }}>
        {questionTitle}
      </div>

      {pair && (
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{pairLine(pair)}</div>
      )}

      <div style={{ borderRadius: 14, padding: '10px 12px', marginTop: 10, background: 'var(--surface-recess)' }}>
        <span className="eyebrow mz-ebic" style={{ color: 'var(--accent-deep)', letterSpacing: '.14em' }}><Icon name="trend-up" size={12} /> Amit eddig látunk</span>
        {finding ? (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', marginTop: 4 }}>
              {finding.prefix} {finding.before}
              <b>{finding.strength}</b>
              {finding.after}.
            </p>
            {confidence && (
              <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 5 }}>{confidence.sentence}.</p>
            )}
          </>
        ) : (
          // mezo-mqdj: ha a monitor szerint a pár ma nem él, a sor `mechanism`-je a LEGUTÓBBI élő
          // éjszakáról fagyott be ("Erős pozitív együttjárás … az elmúlt N napban") — a mai adatról
          // állítana valótlant. Ilyenkor a kapu saját mondata megy ki. (A coverage-t a kártya nem
          // ismeri: null → a no_data általános, lefedettség-független megfogalmazása.)
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', marginTop: 4 }}>
            {pair != null && pair.verdict !== 'live' ? verdictSentence(pair, null) : pattern.mechanism}
          </p>
        )}
      </div>

      {showExplainer && (
        <div style={{ borderRadius: 14, padding: '10px 12px', marginTop: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)' }}>
          <span className="eyebrow" style={{ color: 'var(--accent-deep)', letterSpacing: '.14em' }}>Mi történik a döntéseddel</span>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            <b style={{ color: 'var(--success-deep)' }}>Megerősítem</b> — tartós tudás lesz: bekerül a Tudástárba és a
            társ fejébe, előrejelzés és kísérlet épülhet rá.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            <b style={{ color: 'var(--accent-base)' }}>Figyeljük még</b> — marad a listán, a motor tovább számolja,
            de nem tanulok belőle.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            <b style={{ color: 'var(--mz-no-ink)' }}>Elvetem</b> — befagy, többé nem hozom elő.
          </p>
        </div>
      )}

      {/* Prototype .decrow (mezo-body #deccard, ×1.18) — coral CTA + two ghosts, 44pt targets.
          „Elvetem" wears --mz-no-ink (terracotta), NEVER --error-*: the dark-mode error ramp
          is an actual red (#F7B3AE), which the guardrail forbids (mezo-d20.11). */}
      <div className="mzh-decrow" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => onDecide('confirm')}
          className="mzh-cta"
          aria-pressed={status === 'confirmed'}
        >
          {/* the prototype's .cta carries the verb alone — no icon */}
          {status === 'confirmed' ? 'Megerősítve' : 'Megerősítem'}
        </button>
        <button
          type="button"
          onClick={() => onDecide('monitor')}
          className="mzh-ghost"
          aria-pressed={status === 'monitoring'}
        >
          Figyeljük
        </button>
        <button
          type="button"
          onClick={() => onDecide('reject')}
          className="mzh-ghost is-no"
          aria-pressed={status === 'rejected'}
        >
          Elvetem
        </button>
      </div>

      {showDetailLink && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 9 }}>
          {/* Direct to the sibling leaf — `/insights/…` only reached it via LegacyPathRedirect. */}
          <Link to={`/mezo/patterns/${pattern.pairKey}`} className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
            Részletek és előzmények →
          </Link>
        </div>
      )}
    </div>
  )
}
