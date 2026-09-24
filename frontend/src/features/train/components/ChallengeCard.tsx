// ============================================================
// Mezo · ChallengeCard — a single pre-workout micro-experiment the
// companion proposes, restyled as a quest card (mission-briefing redesign,
// mezo-bxpg): coral-bordered, --wash-gym tint, type+exercise header, risk tag
// (swapped for the outcome chip once resolved), a why/glory pitch line,
// confidence + refs + tool transparency, accept/skip actions.
// "a try maga a jutalom" · no FOMO · no penalty if skipped.
// Ported from prototype challenges.jsx.
// Üvegesítés U4 (mezo-me75u.4): a FLAT card inside the Küldetések glass (never glass in glass),
// coral-lit once accepted. Every glyph is a 3D sprite icon or gone: the ⚔️ of "Elfogadom", the
// ✓/◯/◌ of the outcome chips, and any emoji a `typeLabel` carries (the mock seed's "⚡
// Túlterhelés") — stripped at render time, the data stays untouched. Skin: `uveg edzes session`.
// ============================================================
import type { Challenge, ChallengeStatus } from '@/data/types'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { RefTag } from '@/shared/ui/RefTag'
import { ToolChip } from '@/shared/ui/ToolChip'

// A resolved challenge (workout decided) — its accept/skip row is hidden and an
// outcome chip + line replace it. Chips mirror the experiments-tab wording
// (ExperimentsPage.statusLabel) so the two proactive surfaces read alike.
const RESOLVED: ReadonlyArray<ChallengeStatus> = ['hit', 'miss', 'inconclusive']
type OutcomeState = { label: string; icon: Icon3DName; tone: 'hit' | 'quiet' }
const OUTCOME: Record<'hit' | 'miss' | 'inconclusive', OutcomeState> = {
  // hit = confirmed (lit); miss/inconclusive = muted/neutral, NO red, no-penalty tone.
  hit: { label: 'Megerősítve', icon: 't-tick', tone: 'hit' },
  miss: { label: 'Nem igazolódott', icon: 't-hold', tone: 'quiet' },
  inconclusive: { label: 'Nem értékelhető', icon: 't-info', tone: 'quiet' },
}

/** A `typeLabel` without the leading emoji some sources still carry ("⚡ Túlterhelés" →
 *  "Túlterhelés"). Render-time only: the mock seed and the wire stay as they are. */
export function cleanTypeLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim() || label
}

export function ChallengeCard({
  challenge,
  accepted,
  onToggle,
}: {
  challenge: Challenge
  accepted: boolean
  onToggle: () => void
}) {
  const c = challenge
  const resolved = c.status != null && (RESOLVED as ReadonlyArray<string>).includes(c.status)
  const outcome = resolved ? OUTCOME[c.status as 'hit' | 'miss' | 'inconclusive'] : null

  return (
    <div className={accepted ? 'wos-chc is-accepted' : 'wos-chc'}>
      {/* Header row: type + exercise name · risk tag right — the outcome chip takes the
          right slot once the workout is decided. */}
      <div className="wos-chc-head">
        <span className="wos-chc-type">{cleanTypeLabel(c.typeLabel)} · {c.exercise}</span>
        {outcome ? (
          <span className={`wos-chc-outcome is-${outcome.tone}`}>
            <Icon3D name={outcome.icon} size={16} />
            {outcome.label}
          </span>
        ) : (
          <small className="wos-chc-risk">{c.risk === 'low' ? 'alacsony kockázat' : 'közép kockázat'}</small>
        )}
      </div>

      {/* Target + confidence */}
      <div className="wos-chc-target">{c.target}</div>
      <span className="wos-chc-conf">
        conf {c.confidence == null ? 'tanulom' : `${(c.confidence * 100).toFixed(0)}%`}
      </span>

      {/* Why / glory line — the quest pitch, shown until the workout is decided. */}
      {!resolved && (
        <p className="wos-chc-why">
          {c.why} <b>· {c.glory}</b>
        </p>
      )}

      {/* Refs */}
      {c.refs.length > 0 && (
        <div className="wos-chc-refs">
          {c.refs.map((r, i) => (
            <RefTag key={i} kind={r.kind} label={r.label} />
          ))}
        </div>
      )}

      {/* Tool transparency */}
      {!!c.tools?.length && (
        <div className="wos-chc-refs">
          {c.tools.map((t, i) => (
            <ToolChip key={i} {...t} />
          ))}
        </div>
      )}

      {/* Outcome line — the workout is decided; the action row is hidden. */}
      {resolved && c.outcome && (
        <p className={`wos-chc-outline is-${outcome!.tone}`}>{c.outcome}</p>
      )}

      {/* Actions — hidden once the challenge is resolved (workout decided). */}
      {!resolved && (
        <div className="wos-chc-acts">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={accepted}
            className="wos-pill is-lit"
          >
            <Icon3D name={accepted ? 't-tick' : 't-quest'} size={20} />
            {accepted ? 'Elfogadva' : 'Elfogadom'}
          </button>
          {!accepted && (
            <button type="button" className="wos-pill">
              Passz
            </button>
          )}
        </div>
      )}
    </div>
  )
}
