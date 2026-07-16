// ============================================================
// Mezo · LogMealSheet (the meal-log capture sheet — mezo-arb)
// The one genuinely new surface. Modal: slot segmented + time row, per-item cards
// (name + source tag + amount stepper + per-item MacroCells contribution + delete),
// "Receptből / Kamrából hozzáad" → MealPickerSheet, a live "Ez az étkezés" total +
// the daily-context bar (mai eddig + ez vs cél), sticky "Logolás a mai naphoz" →
// useMealActions.logMeal. Opens pre-filled from a recipe or a pantry item.
// Contribution = round(macro * amount/per) — the SAME rule as the backend mapper.
// docs/design/meal-logging-sheet.html (left phone).
// ============================================================
import { useState } from 'react'
import type { Ingredient, MealInput, MealSlot, Recipe } from '@/data/types'
import { useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { MealPickerSheet, type MealPickedItem } from '@/features/fuel/sheets/MealPickerSheet'

export type LogMealPrefill =
  | { source: 'recipe'; recipeId: string }
  | { source: 'pantry'; pantryItemId: string }
  | null

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const SLOTS: { id: Slot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

// Pantry source accent — the mockup's amber (--cat-dairy is not a global token, so
// fall back to its hex from the design system; matches the .srctag.kamra look).
const PANTRY_ACCENT = 'var(--cat-dairy, #FBBF24)'

interface DraftLine { key: string; source: 'recipe' | 'pantry'; refId: string; amount: number; unit: string }

const round = (n: number) => Math.round(n)
const zero = { kcal: 0, p: 0, c: 0, f: 0 }

function lineFromPicked(p: MealPickedItem): DraftLine {
  return { key: crypto.randomUUID(), source: p.source, refId: p.refId, amount: p.amount, unit: p.unit }
}

function defaultSlot(): Slot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
function nowLabel(): string {
  return 'ma · ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

export function LogMealSheet({ prefill, initialSlot, onClose }: { prefill?: LogMealPrefill; initialSlot?: MealSlot; onClose: () => void }) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay()
  const { logMeal } = useMealActions()

  // `initialSlot` (planner tap-to-log) seeds the segmented control; without it, fall back to the
  // wall-clock default. Read once at mount — the user can still switch slots afterwards.
  const [slot, setSlot] = useState<Slot>(() => initialSlot ?? defaultSlot())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!prefill) return []
    if (prefill.source === 'recipe') return [{ key: 'pf', source: 'recipe', refId: prefill.recipeId, amount: 1, unit: 'adag' }]
    const ing = ingredients.find(i => i.id === prefill.pantryItemId)
    return [{ key: 'pf', source: 'pantry', refId: prefill.pantryItemId, amount: ing?.per || 100, unit: ing?.unit || 'g' }]
  })

  const resolveRecipe = (id?: string): Recipe | undefined => recipes.find(r => r.id === id)
  const resolveIng = (id?: string): Ingredient | undefined => ingredients.find(i => i.id === id)

  function lineMeta(l: DraftLine) {
    if (l.source === 'recipe') {
      const r = resolveRecipe(l.refId)
      const s = Math.max(1, r?.servings ?? 1)
      const factor = l.amount
      // Single-round (round only once, at the end) — IDENTICAL to the data layer's
      // buildLine recipe arm: round((macro / servings) * amount). Rounding the
      // per-serving value first would make the live total drift 1-3 kcal off the meal
      // that actually gets persisted.
      return {
        name: r?.name ?? 'Recept', tag: 'recept' as const, step: 1, min: 1,
        contribution: {
          kcal: round((r?.macros.kcal ?? 0) / s * factor),
          p: round((r?.macros.p ?? 0) / s * factor),
          c: round((r?.macros.c ?? 0) / s * factor),
          f: round((r?.macros.f ?? 0) / s * factor),
        },
      }
    }
    const ing = resolveIng(l.refId)
    const per = ing?.per || 1
    const factor = l.amount / per
    return {
      name: ing?.name ?? 'Tétel', tag: 'kamra' as const, step: 10, min: 1,
      contribution: { kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor), c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor) },
    }
  }

  const resolved = lines.map(l => ({ l, meta: lineMeta(l) }))
  const total = resolved.reduce((a, { meta }) => ({ kcal: a.kcal + meta.contribution.kcal, p: a.p + meta.contribution.p, c: a.c + meta.contribution.c, f: a.f + meta.contribution.f }), { ...zero })

  const after = fuel.consumed.kcal + total.kcal
  // `pct` guards a zero target → 0 (real mode returns a zero FuelDay during cold load —
  // no static fallback in real mode); a raw 0/0 would render a "NaN%" bar width.
  const nowPct = pct(fuel.consumed.kcal, fuel.targets.kcal)
  const addPct = Math.min(100 - nowPct, pct(total.kcal, fuel.targets.kcal))

  const addPicked = (p: MealPickedItem) => { setLines(prev => [...prev, lineFromPicked(p)]); setPickerOpen(false) }
  const bump = (key: string, delta: number) => setLines(prev => prev.map(p => p.key === key ? { ...p, amount: Math.max(1, p.amount + delta) } : p))
  const removeLine = (key: string) => setLines(prev => prev.filter(p => p.key !== key))

  const canSave = lines.length > 0
  const save = (close: () => void) => {
    if (!canSave) return
    const input: MealInput = {
      slot,
      loggedAt: new Date().toISOString(),
      title: null,
      items: lines.map(l => ({ source: l.source, refId: l.refId, amount: l.amount, unit: l.unit })),
    }
    logMeal(input)
    close()
    onClose()
  }

  return (
    <>
      <Sheet onClose={onClose} labelledBy="log-meal-title">
        {(close) => (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="col">
                <Eyebrow brand>Logolás · mai nap</Eyebrow>
                <div id="log-meal-title" style={{ marginTop: 4 }}><Display size="md">Mit ettél?</Display></div>
              </div>
              <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            {/* Mikor — slot segmented */}
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>MIKOR</span>
            <div className="row gap-xs" style={{ margin: '7px 0 8px', padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              {SLOTS.map(s => (
                <button key={s.id} onClick={() => setSlot(s.id)} aria-label={s.label} aria-pressed={slot === s.id}
                  className={'chip flex-1' + (slot === s.id ? ' brand' : '')}
                  style={{ justifyContent: 'center', padding: '8px 0', fontSize: 11, textTransform: 'uppercase' }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', marginBottom: 6, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              <span className="label-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{nowLabel()}</span>
            </div>

            {/* Tételek */}
            <div className="row" style={{ alignItems: 'center', gap: 9, margin: '13px 2px 9px' }}>
              <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>TÉTELEK</span>
              <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--brand-glow)' }}>{lines.length}</span>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
            </div>

            {lines.length === 0 && (
              <div className="card notch-4" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
                <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs tétel. Adj hozzá Receptből vagy a Kamrából.</span>
              </div>
            )}

            <div className="col gap-sm">
              {resolved.map(({ l, meta }) => (
                <div key={l.key} className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + (meta.tag === 'recept' ? 'var(--brand-glow)' : PANTRY_ACCENT) }}>
                  <div className="row" style={{ alignItems: 'center', gap: 9 }}>
                    <div className="row gap-xs flex-1" style={{ minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meta.name}</span>
                      <span className="label-mono" style={{ fontSize: 7.5, fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase',
                        background: meta.tag === 'recept' ? 'color-mix(in srgb, var(--sage) 16%, transparent)' : 'rgba(251,191,36,0.16)',
                        color: meta.tag === 'recept' ? 'var(--brand-glow)' : PANTRY_ACCENT }}>{meta.tag}</span>
                    </div>
                    <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
                      <button onClick={() => bump(l.key, -meta.step)} aria-label={`${meta.name} csökkentés`} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }}>−</button>
                      <span style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{l.amount}</span>
                      <button onClick={() => bump(l.key, meta.step)} aria-label={`${meta.name} növelés`} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }}>+</button>
                      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', padding: '0 6px 0 1px' }}>{l.unit}</span>
                    </div>
                    <button onClick={() => removeLine(l.key)} aria-label={`${meta.name} eltávolítás`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <MacroCells macros={meta.contribution} perLabel={`${l.amount} ${l.unit}`} />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setPickerOpen(true)} className="notch-4"
              style={{ width: '100%', padding: 11, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)', background: 'color-mix(in srgb, var(--sage) 8%, transparent)', border: '1px dashed var(--border-brand)' }}>
              <Icon name="plus" size={14} /> Receptből / Kamrából hozzáad
            </button>

            {/* Live total + daily context */}
            <div className="notch-4" style={{ padding: '11px 12px', marginTop: 12, background: 'color-mix(in srgb, var(--sage) 5%, transparent)', border: '1px solid var(--border-brand)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--brand-glow)' }}>EZ AZ ÉTKEZÉS</span>
                <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>{lines.length} tétel</span>
              </div>
              <MacroCells macros={total} size="md" />
              <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="row" style={{ justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 8.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                  <span>Mai nap eddig <b style={{ color: 'var(--text-secondary)' }}>{fuel.consumed.kcal}</b> <span style={{ color: 'var(--brand-glow)' }}>+{total.kcal}</span> = <b style={{ color: 'var(--text-secondary)' }}>{after}</b></span>
                  <span>cél <b style={{ color: 'var(--text-secondary)' }}>{fuel.targets.kcal}</b> kcal</span>
                </div>
                <div style={{ height: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: nowPct + '%', background: 'var(--text-tertiary)' }} />
                  <div style={{ position: 'absolute', left: nowPct + '%', top: 0, bottom: 0, width: addPct + '%', background: 'var(--brand-glow)' }} />
                </div>
              </div>
            </div>

            <div className="row gap-sm" style={{ marginTop: 14 }}>
              <button className="cta-ghost notch-4" onClick={close} style={{ flex: 1 }}>Mégse</button>
              <button className="cta-primary notch-4" disabled={!canSave} onClick={() => save(close)} style={{ flex: 1.8 }}>
                <Icon name="check" size={15} /> Logolás a mai naphoz
              </button>
            </div>
            <div style={{ height: 12 }} />
          </>
        )}
      </Sheet>

      {pickerOpen && <MealPickerSheet onPick={addPicked} onClose={() => setPickerOpen(false)} />}
    </>
  )
}
