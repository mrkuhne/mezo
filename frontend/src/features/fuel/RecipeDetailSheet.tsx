// ============================================================
// Mezo · RecipeDetailSheet
// Recipe (template) detail bottom sheet with 3 tabs:
//   Score-bontás · Hozzávalók · Logok
// Reuses the shared Sheet, ScoreRing and DimensionCard primitives.
// ============================================================
import { useState } from 'react'
import type { Ingredient, MealBreakdown, Recipe, RecipeLog } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import { SafeMarkdown } from '@/lib/safeMarkdown'
import { DimensionCard } from './components/DimensionCard'
import { RecipeIngredientList } from './components/RecipeIngredientList'
import { type RecipeIngredientItem } from './components/RecipeIngredientRow'
import { RecipeLogsList } from './components/RecipeLogsList'

type TabId = 'score' | 'ingredients' | 'logs'

// === Recipe score hero (baseline + last log delta) ===
function RecipeScoreHero({ recipe, logs }: { recipe: Recipe; logs: RecipeLog[] }) {
  const lastLog = logs[0]
  const m = recipe.macros
  const fitScore = recipe.mezoFit.score ?? 0

  return (
    <div className="card notch-12" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        {/* Ring */}
        <div style={{ flexShrink: 0 }}>
          <ScoreRing
            pct={fitScore}
            size={96}
            stroke={5}
            label={(fitScore * 100).toFixed(0)}
            labelColor="var(--brand-glow)"
            sublabel="baseline"
          />
        </div>

        <div className="col flex-1" style={{ minWidth: 0, gap: 6 }}>
          <div className="row gap-md" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
            <span><span style={{ color: 'var(--text-tertiary)' }}>kcal</span> <span style={{ color: 'var(--text-primary)' }}>{m.kcal}</span></span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>P</span> <span style={{ color: 'var(--text-primary)' }}>{m.p}</span></span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>C</span> <span style={{ color: 'var(--text-primary)' }}>{m.c}</span></span>
            <span><span style={{ color: 'var(--text-tertiary)' }}>F</span> <span style={{ color: 'var(--text-primary)' }}>{m.f}</span></span>
          </div>

          {lastLog ? (
            <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>UTOLSÓ LOG</span>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{lastLog.loggedAt}</span>
              </div>
              <div className="row gap-sm" style={{ marginTop: 4, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1 }}>
                  {(lastLog.score * 100).toFixed(0)}
                </span>
                <span className="label-mono" style={{
                  fontSize: 10,
                  color: lastLog.delta > 0 ? 'var(--brand-glow)' : lastLog.delta < 0 ? 'var(--warning)' : 'var(--text-tertiary)',
                }}>
                  {lastLog.delta > 0 ? '+' : ''}{(lastLog.delta * 100).toFixed(0)} pt vs baseline
                </span>
              </div>
            </div>
          ) : (
            <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>Még nincs aktív log a mai étkezésekben</span>
          )}
        </div>
      </div>

      {/* Explanation banner */}
      <div className="row gap-xs mt-md" style={{
        paddingTop: 10, borderTop: '1px solid var(--border-subtle)',
        alignItems: 'flex-start',
      }}>
        <Icon name="tool" size={10} color="var(--text-tertiary)" />
        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.5, flex: 1, fontFamily: 'var(--ff-mono)' }}>
          <span style={{ color: 'var(--brand-glow)' }}>Baseline</span> = a sablon Daniel-profilra. <span style={{ color: 'var(--text-primary)' }}>Log-score</span> = a baseline ± kontextus (Reta-fázis, edzés-ablak, alvás).
        </span>
      </div>
    </div>
  )
}

// === Score breakdown body — reuses MealScoreSheet's DimensionCard ===
function RecipeScoreBreakdown({ breakdown }: { breakdown?: MealBreakdown }) {
  if (!breakdown) {
    return (
      <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
        <span className="text-tertiary" style={{ fontSize: 12 }}>Sablon-breakdown nincs.</span>
      </div>
    )
  }
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow>Súlyozott bontás</Eyebrow>
        <Eyebrow className="text-tertiary">{breakdown.dimensions.length} dimenzió · conf {(breakdown.confidence * 100).toFixed(0)}%</Eyebrow>
      </div>
      <div className="col gap-md">
        {breakdown.dimensions.map(d => <DimensionCard key={d.id} dim={d} />)}
      </div>

      {breakdown.improve && breakdown.improve.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', margin: '20px 0 10px' }}>
            <Eyebrow className="text-warning">Lehetne jobb</Eyebrow>
            <Eyebrow className="text-tertiary">{breakdown.improve.length}</Eyebrow>
          </div>
          <div className="card notch-4" style={{ padding: 4 }}>
            {breakdown.improve.map((it, i) => (
              <div key={i} className="row gap-sm" style={{
                padding: '10px 12px',
                borderBottom: i < breakdown.improve.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--warning)',
                  background: 'color-mix(in srgb, var(--warning) 12%, transparent)', borderRadius: 4, flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45, flex: 1 }}>
                  <SafeMarkdown text={it.text} />
                </span>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--warning)', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {it.impact}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {breakdown.tools && breakdown.tools.length > 0 && (
        <>
          <div className="row" style={{ margin: '20px 0 10px' }}>
            <Eyebrow>Hogyan számoltam</Eyebrow>
          </div>
          <ToolChipRow tools={breakdown.tools} />
        </>
      )}
    </>
  )
}

export function RecipeDetailSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { ingredients } = useRecipes()
  const [tab, setTab] = useState<TabId>('score')

  const items: RecipeIngredientItem[] = recipe.ingredients.map(ri => ({
    ...ri,
    ingredient: ingredients.find((i: Ingredient) => i.id === ri.refId),
  }))
  const b = recipe.templateBreakdown
  const logs = recipe.recentLogs ?? []

  const TABS: { id: TabId; label: string }[] = [
    { id: 'score', label: 'Score-bontás' },
    { id: 'ingredients', label: 'Hozzávalók · ' + items.length },
    { id: 'logs', label: 'Logok · ' + logs.length },
  ]

  return (
    <Sheet onClose={onClose} labelledBy="recipe-detail-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-xs" style={{ alignItems: 'center', marginBottom: 4 }}>
                <Eyebrow brand>RECEPT · sablon</Eyebrow>
                {recipe.starred && <Icon name="bookmark" size={11} color="var(--warning)" />}
              </div>
              <div id="recipe-detail-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                {recipe.name}
              </div>
              <span className="label-mono text-tertiary" style={{ fontSize: 9, marginTop: 4 }}>
                {recipe.slot} · {recipe.timesLogged}× logolva · létrehozva {recipe.createdDate}
              </span>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Score Hero */}
          <RecipeScoreHero recipe={recipe} logs={logs} />

          {/* Mezo summary */}
          {b && (
            <div className="card notch-4" style={{
              padding: 12, marginTop: 12,
              background: 'color-mix(in srgb, var(--brand-glow) 5%, transparent)',
              borderColor: 'var(--border-brand)',
            }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={12} color="var(--brand-glow)" />
                <div className="col flex-1">
                  <Eyebrow brand>Mezo · sablon-olvasat</Eyebrow>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>
                    <SafeMarkdown text={b.summary} />
                  </p>
                  <div className="col gap-xs mt-sm" style={{ paddingTop: 8, borderTop: '1px solid var(--border-brand)' }}>
                    {recipe.mezoFit.fitsFor.map((f, i) => (
                      <span key={i} className="row gap-xs" style={{ alignItems: 'center' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand-glow)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="row gap-xs" style={{ marginTop: 16, marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 10px',
                  fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: tab === t.id ? 'var(--brand-glow)' : 'var(--text-tertiary)',
                  borderBottom: '2px solid ' + (tab === t.id ? 'var(--brand-glow)' : 'transparent'),
                  marginBottom: -7,
                }}
              >{t.label}</button>
            ))}
          </div>

          {tab === 'score' && <RecipeScoreBreakdown breakdown={b} />}
          {tab === 'ingredients' && <RecipeIngredientList items={items} />}
          {tab === 'logs' && <RecipeLogsList logs={logs} baselineScore={recipe.mezoFit.score ?? 0} />}

          {/* Actions (inert) */}
          <div className="col gap-sm" style={{ marginTop: 16 }}>
            <button className="cta-primary notch-4">
              <Icon name="plus" size={14} /> Hozzáadás mai étkezéshez
            </button>
            <div className="row gap-sm">
              <button className="cta-ghost notch-4 flex-1">
                <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag levéve' : 'Csillagozás'}
              </button>
              <button className="cta-ghost notch-4 flex-1">
                <Icon name="settings" size={12} /> Szerkesztés
              </button>
            </div>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
