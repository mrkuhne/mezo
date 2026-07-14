// ============================================================
// Mezo · Fuel · Stack view (AI protocol builder)
// Port: prototype/src/fuel-stack.jsx FuelStackPage (6–196).
//
// User picks pantry-stash items → buildProtocol() turns the selection +
// (hardcoded) meso/Reta context into a timed protocol with reasoning, plus
// recommendations and matching meals. Sections top→bottom: page header,
// context summary, Mezo narrative intro, active stack, AI-generated timing,
// reasoning, recommendations, meal matches + CTAs, overlays.
//
// Adaptations vs prototype:
//  - Selection state lives in this component; selectedIds is the only live input
//    into buildProtocol(selectedIds, stash). Precedence: the user's in-session
//    edits → the active protocol's saved selection (useProtocol) → every
//    non-medication stash item (the prototype default).
//  - "Apply" activates the protocol for real via useProtocolActions().applyProtocol
//    (mock recomputes the ['protocol'] cache, real POSTs /api/fuel/protocol); the
//    toast then shows the REAL version returned by the mutation (appliedVersion),
//    only after it resolves.
//  - The toast auto-hides via a useEffect + setTimeout keyed on appliedVersion
//    (no Date.now / inline timer); null = hidden + reset value.
//  - Each generated slot item is tap-to-log: ProtocolSlot gets takenIds (from the
//    stash's re-derived intakes) + onToggleItem → logIntake / undoIntake.
//  - Context StatCell values come from useStackContext (static meso week + short
//    title seed consts — decoupled from the live /api/goals + profile fetches,
//    mezo-4nu); Reta day + phase from useToday; load/sleep figures are literals.
//  - Hex-alpha brand tints → color-mix per the project HEX-ALPHA rule.
// ============================================================
import { useEffect, useState } from 'react'
import {
  useStack,
  useProtocol,
  useStackActions,
  useProtocolActions,
  useStackContext,
  useStackRecommendations,
  useToday,
} from '@/data/hooks'
import { buildProtocol } from '@/features/fuel/logic/buildProtocol'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'
import { SelectedChip } from '@/features/fuel/components/SelectedChip'
import { ProtocolSlot } from '@/features/fuel/components/ProtocolSlot'
import { ReasoningRow } from '@/features/fuel/components/ReasoningRow'
import { RecommendationCard } from '@/features/fuel/components/RecommendationCard'
import { MealMatchRow } from '@/features/fuel/components/MealMatchRow'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import { StatCell } from '@/shared/ui/StatCell'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'

export function FuelStackPage() {
  const { stash } = useStack()
  const { protocol, selectedIds: activeSelection } = useProtocol()
  const { logIntake, undoIntake } = useStackActions()
  const { applyProtocol } = useProtocolActions()
  const { recommendations } = useStackRecommendations()
  const { today } = useToday()
  const { weekInMeso, mesoTitle } = useStackContext()

  // Selection precedence: the user's in-session edits win; otherwise the active protocol's
  // saved selection (null in mock / real-ghost); otherwise every non-medication stash item.
  const defaultIds = stash.filter(s => s.type !== 'medication').map(s => s.id)
  const [userSel, setUserSel] = useState<string[] | null>(null)
  const selectedIds = userSel ?? activeSelection ?? defaultIds
  const toggle = (id: string) =>
    setUserSel(prev => {
      const base = prev ?? selectedIds
      return base.includes(id) ? base.filter(i => i !== id) : [...base, id]
    })

  const [pickerOpen, setPickerOpen] = useState(false)
  // Version returned by applyProtocol() — drives the toast. null = no toast (also the reset value).
  const [appliedVersion, setAppliedVersion] = useState<number | null>(null)

  // Auto-hide the applied toast (no Date.now / inline timer).
  useEffect(() => {
    if (appliedVersion == null) return
    const t = setTimeout(() => setAppliedVersion(null), 3200)
    return () => clearTimeout(t)
  }, [appliedVersion])

  const apply = () => {
    void applyProtocol(selectedIds).then(view => setAppliedVersion(view.protocol?.version ?? null))
  }

  const built = buildProtocol(selectedIds, stash)
  const selectedItems = selectedIds.map(id => stash.find(s => s.id === id)).filter(s => s != null)
  const takenIds = new Set(stash.filter(s => s.taken).map(s => s.id))

  return (
    <>
      {/* Page header */}
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Stack</div>
          <h1>AI builder</h1>
        </div>
        <Chip variant="brand" style={{ padding: '6px 8px', fontSize: 9 }}>
          <Icon name="sparkle" size={10} /> live
        </Chip>
      </div>

      {/* Context summary — mock-only demo context (weekInMeso null in real mode: the meso/reta/
          load/sleep cells were Phase-1 fiction; P8 wires them live — X audit, mezo-t16y.4) */}
      {weekInMeso != null && (
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 14 }}>
          <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Mit nézek most</span>
          <div className="row gap-md mt-md" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <StatCell label="Meso" val={'W' + weekInMeso} sub={today.mesoPhase + ' · ' + mesoTitle} color="var(--sage)" />
            <StatCell label="Reta" val={'D' + today.retaDay} sub="stable ablak" color="var(--reta-d3)" />
            <StatCell label="Heti load" val="5+4" sub="gym + vb" color="var(--cat-tendency)" />
            <StatCell label="Alvás" val="7.5h" sub="14d átlag" color="var(--cat-preference)" />
          </div>
          <div style={{ paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <ToolChipRow
              tools={[
                { type: 'read', name: 'get_meso_phase' },
                { type: 'read', name: 'get_reta_phase' },
                { type: 'read', name: 'get_weekly_load', args: '7d' },
                { type: 'read', name: 'get_sleep_trend', args: '14d' },
                { type: 'compute', name: 'buildProtocol' },
              ]}
            />
          </div>
        </div>
      </div>
      )}

      {/* Mezo narrative intro */}
      <div style={{ padding: '0 24px 12px' }}>
        <div
          className="card notch-4"
          style={{
            padding: 14,
            background: 'var(--wash-sage)',
            borderColor: 'var(--border-brand)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--sage)' }} />
          <div className="row gap-sm" style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
            <Icon name="sparkle" size={12} color="var(--sage-deep)" />
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)', flex: 1 }}>
              <SafeMarkdown
                text={
                  // The load/Reta/MAV prefix is demo prose — mock-only (weekInMeso is the demo-context
                  // signal, null in real mode); the item count is real in both (X audit, mezo-t16y.4).
                  (weekInMeso != null ? 'Heti 5 gym + 4 vb = stacked load · Reta D3 stable · MAV-héten járunk. ' : '')
                  + `Pillanatnyilag ${selectedIds.length} aktív item a stack-edben — alul a generált timing + reasoning.`
                }
              />
            </p>
          </div>
        </div>
      </div>

      {/* Active stack */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Aktív stack · {selectedIds.length}</Eyebrow>
          <button onClick={() => setPickerOpen(true)} className="chip brand notch-4" style={{ fontSize: 9, padding: '5px 10px' }}>
            <Icon name="plus" size={10} /> Hozzáadás
          </button>
        </div>
        <div className="row gap-xs flex-wrap">
          {selectedItems.map(s => (
            <SelectedChip key={s.id} sup={s} onRemove={() => toggle(s.id)} />
          ))}
          {selectedItems.length === 0 && (
            <div className="card notch-4" style={{ padding: 14, width: '100%', textAlign: 'center', borderStyle: 'dashed' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Üres stack · adj hozzá a Kamrából</span>
            </div>
          )}
        </div>
      </div>

      {/* AI-generated timing */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>AI-generált timing · ma</Eyebrow>
          {/* Real active protocol → its real confidence; v0 ghost → no fabricated precision (mezo-t16y.4).
              Mock keeps the prototype literal via the seed protocol (v3, conf 0.86). */}
          {protocol.version > 0 && (
            <span className="label-mono brand" style={{ fontSize: 9 }}>conf {protocol.confidence.toFixed(2)}</span>
          )}
        </div>
        <div className="col gap-sm">
          {built.slots.map((slot, i) => (
            <ProtocolSlot
              key={i}
              slot={slot}
              takenIds={takenIds}
              onToggleItem={(refId, taken) => (taken ? undoIntake(refId) : logIntake(refId))}
            />
          ))}
          {built.slots.length === 0 && (
            <div className="card notch-4" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>
                Adj hozzá itemeket a stack-be — az AI ide építi a protokollt.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Why this timing */}
      {built.slots.length > 0 && (
        <div style={{ padding: '16px 24px 8px' }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <Eyebrow>Miért így · Mezo logika</Eyebrow>
          </div>
          <div className="card notch-4" style={{ padding: 12 }}>
            <div className="col gap-sm">
              {built.reasoning.map((r, i) => (
                <ReasoningRow key={i} reason={r} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations — hidden when the backend has none (real mode defers them) */}
      {recommendations.length > 0 && (
        <div style={{ padding: '16px 24px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Mit hozzáadnék</span>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>auto-discover</span>
          </div>
          <div className="col gap-sm">
            {recommendations.map((rec, i) => (
              <RecommendationCard key={i} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Meal recommendations */}
      <div style={{ padding: '16px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Étkezések ehhez a stack-hez</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>macro + micro match</span>
        </div>
        <div className="col gap-sm">
          {built.mealMatches.map((m, i) => (
            <MealMatchRow key={i} match={m} />
          ))}
        </div>

        <div className="row gap-sm mt-lg">
          <button className="cta-ghost notch-4 flex-1" disabled style={{ opacity: 0.5 }}>
            <Icon name="bookmark" size={12} /> Mentés protokollként · hamarosan
          </button>
          <button className="cta-primary notch-4 flex-1" onClick={apply}>
            <Icon name="check" size={14} /> Bekapcsolás · ma
          </button>
        </div>
      </div>

      {pickerOpen && (
        <StackPickerSheet selectedIds={selectedIds} onToggle={toggle} onClose={() => setPickerOpen(false)} />
      )}

      {appliedVersion != null && (
        <div
          className="toast notch-12"
          style={{
            position: 'absolute',
            bottom: 100,
            left: 24,
            right: 24,
            padding: '12px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-brand)',
            boxShadow: '0 12px 24px color-mix(in srgb, #000000 50%, transparent)',
            zIndex: 50,
          }}
        >
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Icon name="sparkle" size={14} color="var(--sage-deep)" />
            <div className="col flex-1">
              <span className="label-mono brand" style={{ fontSize: 9 }}>
                Protokoll · v{appliedVersion} aktív
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                Mai timeline frissítve · {selectedIds.length} item
              </span>
            </div>
            <Icon name="check" size={14} color="var(--sage-deep)" />
          </div>
        </div>
      )}
    </>
  )
}
