// ============================================================
// Mezo · LogFlowPage (the unified logging flow — bd mezo-d20.4.2, design 2.0 iterations §7)
// Replaces the LogMealSheet + AiLogSheet pair with ONE full-page flow every entry point opens:
// the hub swimlane's Logold/AI actions, the standing out-of-window log row, Kamra detail's
// ＋ Logolás, and (via navigation to /fuel) the quick-log FAB's Étkezés tile.
//
// Anatomy: slot segments defaulting to the LAUNCHING window's slotKey (never the wall-clock
// guess — mezo-bnsf), derived-until-touched meal name, three colorful source tiles — 🫙 Kamra
// (gold, grams, KamraPickSheet stays open for multi-add) · 🥄 Recept (coral, servings,
// ReceptPickSheet closes on pick) · ✨ AI (lavender inline panel, textarea and/or photo) — the
// AI-recognized lines land BECSLÉS-tagged next to the manual ones, so one meal can mix photo +
// text + pantry + recipe. Every line's amount is a typeable input with ± steppers (the
// AmountField guard: invalid/≤0 keeps the previous value) and per-line macros + the totals card
// recompute live. CTA "✓ Logolás · +10 XP" → useMealActions().logMeal.
//
// This is a PAGE per the design (no bottom-sheet drag-to-dismiss), but router.tsx is out of
// scope for this slice (owned by the hub agent) — implemented as a full-bleed self-portaled
// overlay (the LevelUpScreen technique: `.phone-screen`, z-index between the tab bar and the
// sheets it hosts) rather than a routed URL. See the task report for this deliberate deviation.
//
// provenance.origin (audit §4 open question): the MealProvenanceInput contract has no `mixed`
// arm. The honest choice made here: origin reflects whether AI genuinely contributed to THIS
// save (ai-photo when a photo was analyzed this session, else ai-text when free text was),
// regardless of how many manual pantry/recipe lines ride alongside it; a meal built entirely
// from Kamra/Recept tiles omits provenance, exactly like the legacy LogMealSheet's manual-only
// path. Per-line origin is not representable in the current contract — flagged, not invented.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Ingredient, MealInput, MealItemInput, MealSlot, Recipe } from '@/data/types'
import { useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { nowOffsetIso, localDateString } from '@/shared/lib/dates'
import { resizeImage } from '@/shared/lib/resizeImage'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { KamraPickSheet } from '@/features/fuel/sheets/KamraPickSheet'
import { ReceptPickSheet } from '@/features/fuel/sheets/ReceptPickSheet'
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'
import { parseAmountInput, stepAmount } from '@/features/fuel/logic/amountGuard'
import {
  computeRecipeNutrients, lineNutrients, scaleNutrients, sumNutrients, NO_NUTRIENTS, factsOf,
} from '@/data/fuel/recipeMacros'

export type LogFlowPrefill =
  | { source: 'recipe'; recipeId: string }
  | { source: 'pantry'; pantryItemId: string }
  | null

const SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

const round = (n: number) => Math.round(n)
const zero = { kcal: 0, p: 0, c: 0, f: 0 }

interface EstimateSnapshot {
  per: number; basisUnit: string
  kcal: number; proteinG: number; carbsG: number; fatG: number; nova: number | null
}
interface DraftLine {
  key: string
  source: 'recipe' | 'pantry' | 'estimate'
  refId?: string
  name: string
  amount: number
  unit: string
  /** true when this line came out of the AI panel — always shown tagged BECSLÉS regardless of
   *  the underlying matched source (design 2.0 iterations §7's deliberate simplification). */
  fromAi?: boolean
  needsReview?: boolean
  estimate?: EstimateSnapshot
}

function nowLabel(): string {
  return 'ma · ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function lineMeta(l: DraftLine, recipes: Recipe[], ingredients: Ingredient[]) {
  const tag = l.fromAi ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
  if (l.source === 'estimate') {
    const est = l.estimate!
    const per = est.per || 1
    const factor = l.amount / per
    return {
      name: l.name, tag, step: 10, min: 1,
      contribution: {
        kcal: round(est.kcal * factor), p: round(est.proteinG * factor),
        c: round(est.carbsG * factor), f: round(est.fatG * factor),
      },
      nutrients: NO_NUTRIENTS,
    }
  }
  if (l.source === 'recipe') {
    const r = recipes.find(x => x.id === l.refId)
    const s = Math.max(1, r?.servings ?? 1)
    const factor = l.amount
    return {
      name: l.fromAi ? l.name : (r?.name ?? l.name), tag, step: 1, min: 1,
      contribution: {
        kcal: round((r?.macros.kcal ?? 0) / s * factor), p: round((r?.macros.p ?? 0) / s * factor),
        c: round((r?.macros.c ?? 0) / s * factor), f: round((r?.macros.f ?? 0) / s * factor),
      },
      nutrients: scaleNutrients(r ? computeRecipeNutrients(r.ingredients) : NO_NUTRIENTS, factor / s),
    }
  }
  const ing = ingredients.find(x => x.id === l.refId)
  const per = ing?.per || 1
  const factor = l.amount / per
  return {
    name: l.fromAi ? l.name : (ing?.name ?? l.name), tag, step: 10, min: 1,
    contribution: {
      kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor),
      c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor),
    },
    nutrients: lineNutrients(l.amount, per, factsOf(ing)),
  }
}

export interface LogFlowPageProps {
  /** The launching window's own slotKey (mezo-bnsf) — omit only for out-of-window launches,
   *  which fall back to the wall-clock default. */
  initialSlot?: MealSlot
  prefill?: LogFlowPrefill
  /** Opens the ✨ AI panel expanded on mount (the per-window "AI" action, mezo-53su). */
  aiPanelOpenOnMount?: boolean
  onClose: () => void
}

export function LogFlowPage({ initialSlot, prefill, aiPanelOpenOnMount, onClose }: LogFlowPageProps) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay()
  const { logMeal, draftMealFromAi } = useMealActions()

  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)

  const [slot, setSlot] = useState<MealSlot>(() => initialSlot ?? defaultMealSlot())
  // A slot-targeted launch keeps its slot even once an AI draft proposes a different one
  // (mezo-53su); manual taps lock it too.
  const slotLocked = useRef(initialSlot != null)
  const [nameOverride, setNameOverride] = useState<string | null>(null)
  const [kamraOpen, setKamraOpen] = useState(false)
  const [receptOpen, setReceptOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(!!aiPanelOpenOnMount)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiPhoto, setAiPhoto] = useState<File | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // What actually landed in the meal FROM the AI this session — the honest input to
  // provenance.origin (see the file-header note); reset to null only by nothing (a save closes
  // the page, so this never needs clearing mid-session).
  const [aiContribution, setAiContribution] = useState<{ photo: boolean; rawText: string | null } | null>(null)

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!prefill) return []
    if (prefill.source === 'recipe') {
      return [{ key: 'pf', source: 'recipe', refId: prefill.recipeId, name: '', amount: 1, unit: 'adag' }]
    }
    const ing = ingredients.find(i => i.id === prefill.pantryItemId)
    return [{ key: 'pf', source: 'pantry', refId: prefill.pantryItemId, name: '', amount: ing?.per || 100, unit: ing?.unit || 'g' }]
  })

  const photoUrl = useRef<string | null>(null)
  useEffect(() => {
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current)
    photoUrl.current = aiPhoto ? URL.createObjectURL(aiPhoto) : null
    return () => { if (photoUrl.current) { URL.revokeObjectURL(photoUrl.current); photoUrl.current = null } }
  }, [aiPhoto])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const resolved = lines.map(l => ({ l, meta: lineMeta(l, recipes, ingredients) }))
  const total = resolved.reduce((a, { meta }) => ({
    kcal: a.kcal + meta.contribution.kcal, p: a.p + meta.contribution.p,
    c: a.c + meta.contribution.c, f: a.f + meta.contribution.f,
  }), { ...zero })
  const totalNutrients = sumNutrients(resolved.map(({ meta }) => meta.nutrients))

  const derivedName = deriveMealName(resolved.map(({ meta }) => meta.name))
  const shownName = nameOverride ?? derivedName

  const nowPct = pct(fuel.consumed.kcal, fuel.targets.kcal)
  const addPct = Math.min(100 - nowPct, pct(total.kcal, fuel.targets.kcal))
  const after = fuel.consumed.kcal + total.kcal

  const selectSlot = (s: MealSlot) => { slotLocked.current = true; setSlot(s) }

  const addPantry = (ing: Ingredient) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'pantry', refId: ing.id, name: ing.name, amount: ing.per || 100, unit: ing.unit || 'g' }])
  }
  const addRecipe = (r: Recipe) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'recipe', refId: r.id, name: r.name, amount: 1, unit: 'adag' }])
    setReceptOpen(false)
  }
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))
  const bump = (key: string, delta: number, step: number, min: number) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: stepAmount(l.amount, delta * step, min) } : l))
  const setAmount = (key: string, raw: string) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: parseAmountInput(raw, l.amount) } : l))

  const canRunAi = aiText.trim().length > 0 || aiPhoto != null
  const runAi = async () => {
    if (!canRunAi) return
    setAiBusy(true)
    setAiError(null)
    try {
      const blob = aiPhoto ? await resizeImage(aiPhoto) : undefined
      const draft = await draftMealFromAi({ date: localDateString(), text: aiText.trim() || undefined, photo: blob })
      const newLines: DraftLine[] = draft.items.map((it): DraftLine => {
        const key = crypto.randomUUID()
        if (it.source === 'estimate') {
          return {
            key, source: 'estimate', name: it.name, amount: it.amount, unit: it.unit,
            fromAi: true, needsReview: it.needsReview,
            estimate: { per: it.per, basisUnit: it.basisUnit, kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, nova: it.nova },
          }
        }
        if (it.source === 'pantry') {
          return { key, source: 'pantry', refId: it.pantryItemId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
        }
        return { key, source: 'recipe', refId: it.recipeId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
      })
      setLines(prev => [...prev, ...newLines])
      if (!slotLocked.current) setSlot(draft.slot)
      setAiContribution({ photo: !!aiPhoto, rawText: aiText.trim() || null })
      setAiText('')
      setAiPhoto(null)
      setAiOpen(false)
    } catch {
      setAiError('Nem sikerült az AI-feldolgozás. Próbáld újra, vagy add hozzá kézzel.')
    } finally {
      setAiBusy(false)
    }
  }

  const canSave = lines.length > 0
  const save = () => {
    if (!canSave) return
    const items: MealItemInput[] = lines.map((l): MealItemInput => {
      if (l.source === 'estimate') {
        const est = l.estimate!
        return { source: 'estimate', name: l.name, amount: l.amount, unit: l.unit, per: est.per, basisUnit: est.basisUnit, kcal: est.kcal, proteinG: est.proteinG, carbsG: est.carbsG, fatG: est.fatG, nova: est.nova }
      }
      return { source: l.source, refId: l.refId!, amount: l.amount, unit: l.unit }
    })
    const input: MealInput = {
      slot,
      loggedAt: nowOffsetIso(),
      title: shownName.trim() || null,
      items,
      ...(aiContribution
        ? { provenance: { origin: aiContribution.photo ? 'ai-photo' : 'ai-text', rawText: aiContribution.rawText } }
        : {}),
    }
    logMeal(input)
    onClose()
  }

  const addedPantryIds = lines.filter(l => l.source === 'pantry' && l.refId).map(l => l.refId!)

  const body = (
    <div className="logflow-page" role="dialog" aria-modal="true" aria-label="Mit ettél?">
      <div className="logflow-head">
        <button type="button" className="chip logflow-back" onClick={onClose} aria-label="Vissza">‹ Vissza</button>
        <span className="logflow-time">{nowLabel()}</span>
      </div>
      <div className="logflow-body">
        <div className="h-display size-md" style={{ marginBottom: 2 }}>Mit ettél?</div>

        <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>MIKOR</span>
        <div className="row gap-xs" style={{ margin: '7px 0 10px', padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
          {SLOTS.map(s => (
            <button key={s.id} onClick={() => selectSlot(s.id)} aria-label={s.label} aria-pressed={slot === s.id}
              className={'chip flex-1' + (slot === s.id ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '8px 0', fontSize: 11, textTransform: 'uppercase' }}>
              {s.label}
            </button>
          ))}
        </div>

        <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>NÉV</span>
        <input
          type="text" value={shownName} onChange={(e) => setNameOverride(e.target.value)}
          placeholder="Étkezés neve" aria-label="Étkezés neve"
          style={{ width: '100%', margin: '7px 0 12px', padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        />

        <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>HONNAN ADOD HOZZÁ?</span>
        <div className="logflow-srctiles">
          <button type="button" className="logflow-srct tone-gold" onClick={() => setKamraOpen(true)} aria-label="Kamra · hozzáadás">
            <ClayIcon name="i-kamra" size={26} />
            <b>Kamra</b><small>polcról, grammra</small>
          </button>
          <button type="button" className="logflow-srct tone-coral" onClick={() => setReceptOpen(true)} aria-label="Recept · hozzáadás">
            <ClayIcon name="i-recept" size={26} />
            <b>Recept</b><small>adagra</small>
          </button>
          <button type="button" className={'logflow-srct tone-lav' + (aiOpen ? ' on' : '')} onClick={() => setAiOpen(o => !o)} aria-label="✨ AI · fotó vagy szöveg" aria-pressed={aiOpen}>
            <Icon name="sparkle" size={22} color="var(--lav-deep)" />
            <b>✨ AI</b><small>fotó vagy szöveg</small>
          </button>
        </div>

        {aiBusy && (
          <div className="logflow-aipanel logflow-aibusy">
            <span className="np-twinkle" aria-hidden="true" />
            Elemzem az étkezést…
          </div>
        )}
        {aiOpen && !aiBusy && (
          <div className="logflow-aipanel">
            <textarea
              value={aiText} onChange={(e) => setAiText(e.target.value)}
              aria-label="Mit ettél?" placeholder="pl. csirkés wrap és egy latte…" rows={2}
            />
            <div className="row gap-xs" style={{ alignItems: 'center', marginTop: 7 }}>
              {aiPhoto ? (
                <span className="row gap-xs" style={{ alignItems: 'center', fontSize: 11, color: 'var(--lav-deep)' }}>
                  {photoUrl.current && <img src={photoUrl.current} alt="Fotó előnézet" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 8 }} />}
                  {aiPhoto.name}
                  <button type="button" aria-label="Fotó eltávolítása" onClick={() => setAiPhoto(null)} style={{ padding: 2, color: 'var(--text-tertiary)' }}>
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ) : (
                <label className="chip" style={{ cursor: 'pointer', fontSize: 11, padding: '6px 12px' }}>
                  📷 Fotó
                  <input type="file" accept="image/*" capture="environment" aria-label="Étel fotó"
                    onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
                </label>
              )}
              <button type="button" className="cta-primary" style={{ marginLeft: 'auto', padding: '6px 16px' }}
                disabled={!canRunAi} onClick={() => void runAi()}>
                ✨ Elemzés
              </button>
            </div>
            {aiError && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 8 }}>{aiError}</p>}
            <p className="text-secondary" style={{ fontSize: 9.5, lineHeight: 1.5, marginTop: 8 }}>
              Szöveg vagy fotó — vagy mindkettő. A felismert sorok a tételek közé kerülnek, ott mindent átírhatsz.
            </p>
          </div>
        )}

        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '14px 2px 9px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>TÉTELEK</span>
          <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--coral)' }}>{lines.length}</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>

        {lines.length === 0 && (
          <div className="card" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
            <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs tétel — válassz forrást fent, vagy kombináld őket.</span>
          </div>
        )}

        <div className="col gap-sm">
          {resolved.map(({ l, meta }) => (
            <div key={l.key} className="logflow-lncard" data-tag={meta.tag}>
              <div className="row" style={{ alignItems: 'center', gap: 9 }}>
                <div className="row gap-xs flex-1" style={{ minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meta.name}</span>
                  <span className="logflow-lntag" data-tag={meta.tag}>{meta.tag}</span>
                </div>
                <button onClick={() => removeLine(l.key)} aria-label={`${meta.name} eltávolítása`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div className="row" style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
                <button onClick={() => bump(l.key, -1, meta.step, meta.min)} aria-label={`${meta.name} csökkentés`} className="logflow-stepbtn">−</button>
                <input
                  type="text" inputMode="decimal" value={l.amount}
                  onChange={(e) => setAmount(l.key, e.target.value)}
                  aria-label={`${meta.name} mennyisége`}
                  className="logflow-amtinput"
                />
                <button onClick={() => bump(l.key, 1, meta.step, meta.min)} aria-label={`${meta.name} növelés`} className="logflow-stepbtn">+</button>
                <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{l.unit}</span>
              </div>
              <div style={{ marginTop: 9 }}>
                <MacroCells macros={meta.contribution} perLabel={`${l.amount} ${l.unit}`} />
              </div>
              {l.source !== 'estimate' && (
                <div style={{ marginTop: 6 }}>
                  <NutrientCells nutrients={meta.nutrients} perLabel={`${l.amount} ${l.unit}`} />
                </div>
              )}
              {l.needsReview && (
                <p className="logflow-lnnote">✨ Az AI nem teljesen biztos ebben a sorban — nézd át a mennyiséget.</p>
              )}
            </div>
          ))}
        </div>

        <div className="rad-12" style={{ padding: '11px 12px', marginTop: 12, background: 'color-mix(in srgb, var(--sage) 5%, transparent)', border: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--coral)' }}>EZ AZ ÉTKEZÉS</span>
            <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>{lines.length} tétel</span>
          </div>
          <MacroCells macros={total} size="md" />
          <div style={{ marginTop: 6 }}><NutrientCells nutrients={totalNutrients} size="md" /></div>
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="row" style={{ justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums', fontSize: 8.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
              <span>Mai nap eddig <b style={{ color: 'var(--text-secondary)' }}>{fuel.consumed.kcal}</b> <span style={{ color: 'var(--coral)' }}>+{total.kcal}</span> = <b style={{ color: 'var(--text-secondary)' }}>{after}</b></span>
              <span>cél <b style={{ color: 'var(--text-secondary)' }}>{fuel.targets.kcal}</b> kcal</span>
            </div>
            <div style={{ height: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: nowPct + '%', background: 'var(--text-tertiary)' }} />
              <div style={{ position: 'absolute', left: nowPct + '%', top: 0, bottom: 0, width: addPct + '%', background: 'var(--coral)' }} />
            </div>
          </div>
        </div>

        <div className="row gap-sm" style={{ margin: '14px 0 12px' }}>
          <button className="cta-ghost" onClick={onClose} style={{ flex: 1 }}>Mégse</button>
          <button className="cta-primary" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
            <Icon name="check" size={15} /> Logolás · +10 XP
          </button>
        </div>
      </div>

      {kamraOpen && <KamraPickSheet onPick={addPantry} onClose={() => setKamraOpen(false)} addedRefIds={addedPantryIds} />}
      {receptOpen && <ReceptPickSheet onPick={addRecipe} onClose={() => setReceptOpen(false)} />}
    </div>
  )

  return createPortal(body, target)
}
