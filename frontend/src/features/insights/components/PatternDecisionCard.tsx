import { Link } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { patternCategoryColor } from '@/data/insights/insights'
import { PatternDomainMark, PATTERN_DOMAIN_MARK_ART } from '@/features/insights/components/PatternDomainMark'
import { confidenceMeta, findingSentence, pairLine, type ConfidenceMeta } from '@/features/insights/logic/findings'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import type { Pattern, PatternMonitorPair, PatternStatus } from '@/data/types'

/** Üveg-változat (mezo-me75u.9): a bizonyosság-chip akcentusa a `tf-st` pirulán. */
const TONE_ACCENT: Record<ConfidenceMeta['tone'], string> = {
  success: 'sage',
  accent: 'lav',
  warning: 'gold',
}

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
  detailSearch,
  glass = false,
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
  detailSearch?: string
  /** Üveg-bőr (mezo-me75u.9, opt-in): a Minták lista borostyán üveg-esete (`glass tf-case`).
   *  Alapból a régi kártya marad — minden más fogyasztó változatlanul azt kapja. */
  glass?: boolean
}) {
  const railColor = patternCategoryColor(pattern.category)
  const status = pattern.status ?? 'proposed'
  const confidence = pair != null && pair.n != null && pair.p != null ? confidenceMeta(pair.n, pair.p) : null
  const finding = pair?.r != null ? findingSentence(pair) : null
  const questionTitle = pair?.questionHu ?? pattern.title
  const showLink = showDetailLink && !(pattern.kind === 'reflection' && pattern.testPlan == null)
  const detailHref = `/mezo/patterns/${pattern.pairKey}${detailSearch ? `?${detailSearch}` : ''}`

  if (glass) {
    return (
      <div className="glass tf-case tf-c-gold m9m-dec" data-decision-card="">
        <span className="tf-crow">
          {confidence ? (
            <span className={`tf-st tf-s-${TONE_ACCENT[confidence.tone]}`}>{confidence.chip}</span>
          ) : (
            <span className="tf-st tf-s-slate">
              {pattern.confidence != null ? `bizonyosság ${(pattern.confidence * 100).toFixed(0)}%` : 'tanulom'}
            </span>
          )}
          <em>{pair ? <PatternDomainMark domain={pair.metricBDomain} size={16} /> : pattern.categoryLabel}</em>
        </span>
        <span className="tf-cmain">
          <Icon3D name={PATTERN_DOMAIN_MARK_ART[pair?.metricBDomain ?? 'other']} size={36} />
          <span className="tf-ctxt">
            <span className="tf-ctitle" style={{ fontSize: titleSize - 2 }}>{questionTitle}</span>
            {pair && <span className="tf-csub m9m-pairline">{pairLine(pair)}</span>}
          </span>
        </span>

        <div className="m9m-well">
          <span className="m9m-cap">Amit eddig látunk</span>
          {finding ? (
            <>
              <p className="m9m-finding">
                {finding.prefix} {finding.before}
                <b>{finding.strength}</b>
                {finding.after}.
              </p>
              {confidence && <p className="m9m-conf">{confidence.sentence}.</p>}
            </>
          ) : (
            <p className="m9m-finding">
              {pair != null && pair.verdict !== 'live' ? verdictSentence(pair, null) : pattern.mechanism}
            </p>
          )}
        </div>

        {showExplainer && (
          <div className="m9m-well is-explainer">
            <span className="m9m-cap">Mi történik a döntéseddel</span>
            <p><b className="is-sage">Megerősítem</b> — tartós tudás lesz: bekerül a Tudástárba és a
              társ fejébe, előrejelzés és kísérlet épülhet rá.</p>
            <p><b className="is-lav">Figyeljük még</b> — marad a listán, a motor tovább számolja,
              de nem tanulok belőle.</p>
            <p><b className="is-no">Elvetem</b> — befagy, többé nem hozom elő.</p>
          </div>
        )}

        {/* Lapos pirulák az üvegen (üveg az üvegben tilos): a fő döntés világító zsálya, az
            „Elvetem" terrakotta — soha nem piros (mezo-d20.11 guardrail). */}
        <div className="m9m-acts">
          <button type="button" onClick={() => onDecide('confirm')} className="m9m-act is-main"
            aria-pressed={status === 'confirmed'}>
            <Icon3D name="t-tick" size={18} />{status === 'confirmed' ? 'Megerősítve' : 'Megerősítem'}
          </button>
          <button type="button" onClick={() => onDecide('monitor')} className="m9m-act"
            aria-pressed={status === 'monitoring'}>
            <Icon3D name="t-lens" size={18} />Figyeljük
          </button>
          <button type="button" onClick={() => onDecide('reject')} className="m9m-act is-no"
            aria-pressed={status === 'rejected'}>
            <Icon3D name="t-skip" size={18} />Elvetem
          </button>
        </div>

        {showLink && (
          <Link to={detailHref} className="m9m-declink">Részletek és előzmények →</Link>
        )}
      </div>
    )
  }

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

      {/* A hideg indítás „tartó sorának" NINCS részlet-oldala (mezo-5543y), ezért linket sem kap.
          A részlet-oldal a kulcsot előbb a KATALÓGUSBAN keresi, utána `hypothesis_key`-ként — a
          tartó sor egyiket sem teljesíti (kulcsa `note-<uuid>`, `hypothesisKey`-e pedig nincs),
          tehát a link biztosan 404-re vinne. A feltétel szándékosan szűk: egy statisztikai sornak
          sincs teszt-terve, de annak a kulcsa katalógus-kulcs, tehát az oldala MŰKÖDIK — a
          `testPlan` önmagában nem mond semmit arról, feloldható-e a kulcs. Terv nélküli
          `reflection` sor viszont csak a tartó sor lehet: minden más reflexiós sor érvényesített
          tervvel jön létre. */}
      {showLink && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 9 }}>
          {/* Direct to the sibling leaf — `/insights/…` only reached it via LegacyPathRedirect. */}
          <Link to={detailHref} className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
            Részletek és előzmények →
          </Link>
        </div>
      )}
    </div>
  )
}
