// ============================================================
// Mezo · Fuel · Stack view (AI protocol builder)
// Port: prototype/src/fuel-stack.jsx FuelStackView (6–196).
//
// User picks pantry-stash items → buildProtocol() turns the selection +
// (hardcoded) meso/Reta context into a timed protocol with reasoning, plus
// recommendations and matching meals. Sections top→bottom: page header,
// context summary, Mezo narrative intro, active stack, AI-generated timing,
// reasoning, recommendations, meal matches + CTAs, overlays.
//
// Adaptations vs prototype:
//  - Selection/picker/toast state lives in this component; selectedIds is the
//    only live input into buildProtocol(selectedIds, stash). Default = every
//    non-medication stash item, per the prototype.
//  - "Apply" does NOT mutate any global protocol (the prototype mutates
//    D.protocol). We only show a toast; its version reads protocol.version + 1
//    to mirror the value the prototype displayed after its mutation.
//  - The toast auto-hides via a useEffect + setTimeout keyed on appliedToast
//    (no Date.now / inline timer).
//  - Context StatCell values come from the React data layer: meso week from
//    user.weekInMeso, meso title from the active linkedMesocycle, Reta day +
//    phase from today; the load/sleep figures match the prototype literals.
//  - Hex-alpha brand tints → color-mix per the project HEX-ALPHA rule.
// ============================================================
import { useEffect, useState } from 'react'
import {
  useStack,
  useProtocol,
  useStackRecommendations,
  useToday,
  useProfile,
  useGoals,
} from '@/data/hooks'
import { buildProtocol } from '@/features/fuel/buildProtocol'
import { StackPickerSheet } from '@/features/fuel/StackPickerSheet'
import { SelectedChip } from '@/features/fuel/components/SelectedChip'
import { ProtocolSlot } from '@/features/fuel/components/ProtocolSlot'
import { ReasoningRow } from '@/features/fuel/components/ReasoningRow'
import { RecommendationCard } from '@/features/fuel/components/RecommendationCard'
import { MealMatchRow } from '@/features/fuel/components/MealMatchRow'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { StatCell } from '@/components/ui/StatCell'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import { SafeMarkdown } from '@/lib/safeMarkdown'

export function FuelStackView() {
  const { stash } = useStack()
  const { protocol } = useProtocol()
  const { recommendations } = useStackRecommendations()
  const { today } = useToday()
  const { user } = useProfile()
  const { linkedMesocycles } = useGoals()

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    stash.filter(s => s.type !== 'medication').map(s => s.id),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [appliedToast, setAppliedToast] = useState(false)

  // Auto-hide the applied toast (no Date.now / inline timer).
  useEffect(() => {
    if (!appliedToast) return
    const t = setTimeout(() => setAppliedToast(false), 3200)
    return () => clearTimeout(t)
  }, [appliedToast])

  const toggle = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]))

  const built = buildProtocol(selectedIds, stash)
  const selectedItems = selectedIds.map(id => stash.find(s => s.id === id)).filter(s => s != null)

  const activeMeso = Object.values(linkedMesocycles).find(m => m.status === 'active')
  const mesoTitle = activeMeso ? activeMeso.shortTitle.split(' ')[0] : ''

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Fuel · Stack</Eyebrow>
          <PageTitle>AI builder</PageTitle>
        </div>
        <Chip variant="brand" style={{ padding: '6px 8px', fontSize: 9 }}>
          <Icon name="sparkle" size={10} /> live
        </Chip>
      </div>

      {/* Context summary */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 14 }}>
          <Eyebrow brand>Mit nézek most</Eyebrow>
          <div className="row gap-md mt-md" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <StatCell label="Meso" val={'W' + user.weekInMeso} sub={today.mesoPhase + ' · ' + mesoTitle} color="var(--brand-glow)" />
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

      {/* Mezo narrative intro */}
      <div style={{ padding: '0 24px 12px' }}>
        <div
          className="card notch-4"
          style={{
            padding: 14,
            background: 'color-mix(in srgb, var(--brand-glow) 5%, transparent)',
            borderColor: 'var(--border-brand)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--brand-glow)' }} />
          <div className="row gap-sm" style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)', flex: 1 }}>
              <SafeMarkdown
                text={`Heti 5 gym + 4 vb = stacked load · Reta D3 stable · MAV-héten járunk. Pillanatnyilag ${selectedIds.length} aktív item a stack-edben — alul a generált timing + reasoning, közben javaslatok.`}
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
          <span className="label-mono brand" style={{ fontSize: 9 }}>conf 0.86</span>
        </div>
        <div className="col gap-sm">
          {built.slots.map((slot, i) => (
            <ProtocolSlot key={i} slot={slot} />
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

      {/* Recommendations */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow brand>Mit hozzáadnék</Eyebrow>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>auto-discover</span>
        </div>
        <div className="col gap-sm">
          {recommendations.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} />
          ))}
        </div>
      </div>

      {/* Meal recommendations */}
      <div style={{ padding: '16px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow brand>Étkezések ehhez a stack-hez</Eyebrow>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>macro + micro match</span>
        </div>
        <div className="col gap-sm">
          {built.mealMatches.map((m, i) => (
            <MealMatchRow key={i} match={m} />
          ))}
        </div>

        <div className="row gap-sm mt-lg">
          <button className="cta-ghost notch-4 flex-1">
            <Icon name="bookmark" size={12} /> Mentés protokollként
          </button>
          <button className="cta-primary notch-4 flex-1" onClick={() => setAppliedToast(true)}>
            <Icon name="check" size={14} /> Bekapcsolás · ma
          </button>
        </div>
      </div>

      {pickerOpen && (
        <StackPickerSheet selectedIds={selectedIds} onToggle={toggle} onClose={() => setPickerOpen(false)} />
      )}

      {appliedToast && (
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
            <Icon name="sparkle" size={14} color="var(--brand-glow)" />
            <div className="col flex-1">
              <span className="label-mono brand" style={{ fontSize: 9 }}>
                Protokoll · v{protocol.version + 1} aktív
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                Mai timeline frissítve · {selectedIds.length} item
              </span>
            </div>
            <Icon name="check" size={14} color="var(--brand-glow)" />
          </div>
        </div>
      )}
    </>
  )
}
