// ============================================================
// Mezo · FuelSettingsPage — "/settings/fuel": a Fuel beállításai (étkezés / nap, koffein-stop, makróprofil, víz- és
// rost-cél, fehérje-szint, a tanulás kapcsolója) a Beállítások keretében.
//
// Folyadék (mezo-n4wf5.5, prototype vilagos/fuel.js `beallitas()`): a címsor a keretben él (`useFrameTitle`), a vissza
// a Beállítások hubjára visz (változatlan cél). A hős a NAP mint dagály: a mai étkezési ablakok edényekként a 06–24
// vonalon, névvel és kcal-lal, a koffein-stop vonalával (`FuelWindowTide`); alatta négy számozott szakasz — 1 · Ritmus,
// 2 · Makrók (a piszkozatot követő előnézet három fiolával), 3 · Célok, 4 · Finomhangolás — és a lebegő Mentés.
// Betöltés közben csak a hős áll (semmit nem lehet átállítani); betöltési hibánál egy kártya az újrapróbálással.
// A viselkedés változatlan: ugyanazok a hookok, mentés, vissza-cél, piszkozat-előnézet és a mentetlen-módosítás őre.
// ============================================================
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { useEffect, useId, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { DietSettings } from '@/data/types'
import {
  useDietSettings,
  useDietSettingsActions,
  useDietSettingsPreview,
  useFuelDay,
  useFuelSettings,
  useFuelSettingsActions,
  useFuelTimeline,
  useSlotTemplates,
} from '@/data/hooks'
import { buildFuelSettingsMacroPreview } from '@/features/fuel/logic/fuelSettingsPreview'
import { compileTemplate } from '@/features/fuel/logic/compileTemplate'
import { placeWindows, splitBudget, splitBudgetPct } from '@/features/fuel/logic/buildDayPlan'
import { FuelWindowTide, evenWindows, type TideWindow } from '@/features/fuel/components/FuelWindowTide'
import { MACRO_COLOR } from '@/features/fuel/components/folyadek'
import {
  Acts, Btn, Card, Empty, FrameBack, Hero, Input, Lab, Note, Page, Pill, Pills, Row, Section, Select, Stepper, Switch, Txt, Vials,
  useFrameTitle,
} from '@/shared/ui/folyadek'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { useToast } from '@/shared/ui/ToastProvider'
import { localDateString } from '@/shared/lib/dates'

const PRESET_KEYS: DietSettings['splitPreset'][] = ['balanced', 'low_fat', 'low_carb', 'high_carb', 'custom']
const TIER_KEYS: DietSettings['proteinTier'][] = ['low', 'moderate', 'high']

export function FuelSettingsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const M = useM()
  const T = M.fuelBeallitas
  const S = T.settings
  const ids = useId()
  useFrameTitle({ title: T.frame.settingsTitle, eyebrow: T.frame.eyebrow })
  const { state: originState } = useSettingsOrigin()
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const { settings, isPending, isError: fuelError, refetch: retryFuel } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const { settings: diet, isPending: dietPending, isError: dietError, refetch: retryDiet } = useDietSettings()
  const { setSettings: setDiet, pending: dietSaving } = useDietSettingsActions()
  const { fuel, isPending: dayPending, isError: dayError, refetch: retryDay } = useFuelDay()

  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)
  const [splitPreset, setSplitPreset] = useState(diet.splitPreset)
  const [pPct, setPPct] = useState(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
  const [cPct, setCPct] = useState(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
  const [fPct, setFPct] = useState(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
  const [proteinTier, setProteinTier] = useState(diet.proteinTier)
  const [waterMl, setWaterMl] = useState(diet.waterMl)
  const [fiberG, setFiberG] = useState(diet.fiberG)
  // Edzőnap-shift has no control any more (mezo-tb3s2) — the stored value is a pure pass-through,
  // sent back unchanged on save so a value the backend still accepts (and ignores) survives a
  // round-trip through this page rather than getting silently reset.
  const [dayTypeShiftKcal, setDayTypeShiftKcal] = useState(diet.dayTypeShiftKcal)
  const [learningEnabled, setLearningEnabled] = useState(diet.learningEnabled)
  const [touchedFuel, setTouchedFuel] = useState(false)
  const [touchedDiet, setTouchedDiet] = useState(false)

  useEffect(() => {
    if (isPending || touchedFuel) return
    setMealsPerDay(settings.mealsPerDay)
    setCaffeineCutoff(settings.caffeineCutoff)
  }, [isPending, touchedFuel, settings.mealsPerDay, settings.caffeineCutoff])

  useEffect(() => {
    if (dietPending || touchedDiet) return
    setSplitPreset(diet.splitPreset)
    setPPct(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
    setCPct(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
    setFPct(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
    setProteinTier(diet.proteinTier)
    setWaterMl(diet.waterMl)
    setFiberG(diet.fiberG)
    setDayTypeShiftKcal(diet.dayTypeShiftKcal)
    setLearningEnabled(diet.learningEnabled)
  }, [dietPending, touchedDiet, diet.splitPreset, diet.proteinPctX10, diet.carbsPctX10,
    diet.fatPctX10, diet.proteinTier, diet.waterMl, diet.fiberG, diet.dayTypeShiftKcal,
    diet.learningEnabled])

  const customSumOk = splitPreset !== 'custom' || Math.round((pPct + cPct + fPct) * 10) === 1000
  const busy = pending || isPending || dietSaving || dietPending || fuelError || dietError || !customSumOk
  // The preview follows the DRAFT, not the saved row: the server projects the draft through the
  // real goal engine (mock mode re-derives it locally), so flipping Makróprofil / protein tier
  // moves the numbers immediately instead of only after Mentés (mezo-u2pd). A custom split that
  // does not yet sum to 100% is not projectable — hold the last valid projection until it does.
  const draft = useMemo(() => ({
    splitPreset,
    proteinPctX10: splitPreset === 'custom' ? Math.round(pPct * 10) : null,
    carbsPctX10: splitPreset === 'custom' ? Math.round(cPct * 10) : null,
    fatPctX10: splitPreset === 'custom' ? Math.round(fPct * 10) : null,
    proteinTier, waterMl, fiberG, dayTypeShiftKcal,
    learningEnabled,
  }), [splitPreset, pPct, cPct, fPct, proteinTier, waterMl, fiberG, dayTypeShiftKcal, learningEnabled])
  const projectable = useMemo(
    () => (customSumOk ? draft : { ...draft, splitPreset: diet.splitPreset, fatPctX10: diet.fatPctX10 }),
    [customSumOk, draft, diet.splitPreset, diet.fatPctX10])
  const { preview: draftTargets, isPending: previewPending, isError: previewError, refetch: retryPreview } = useDietSettingsPreview(projectable, diet, fuel.targets)
  const preview = useMemo(() => buildFuelSettingsMacroPreview(draftTargets), [draftTargets])
  const dietDirty = splitPreset !== diet.splitPreset
    || proteinTier !== diet.proteinTier || waterMl !== diet.waterMl || fiberG !== diet.fiberG
    || learningEnabled !== diet.learningEnabled
    || (splitPreset === 'custom' && (
      Math.round(pPct * 10) !== diet.proteinPctX10
      || Math.round(cPct * 10) !== diet.carbsPctX10
      || Math.round(fPct * 10) !== diet.fatPctX10
    ))

  // The hero draws today's REAL windows with their kcal (new, approved 2026-10-12) from the hooks the windows editor
  // already uses: a saved split of today's day type → `compileTemplate` + `splitBudgetPct`; otherwise the recommended
  // rhythm → `placeWindows` (with the DRAFT meals-per-day, so the picture moves with the stepper) + `splitBudget`.
  // Fallback face (`beallitas.ablak-nelkul`): while the day or the budget has not resolved, N equal nameless vessels.
  const timeline = useFuelTimeline()
  const { templates } = useSlotTemplates()
  const ownSplit = templates.find((t) => t.dayType === timeline.dayType) ?? null
  const planned = ownSplit
    ? compileTemplate(ownSplit, { wake: timeline.wake, bed: timeline.bed, blocks: timeline.blocks })
    : placeWindows(timeline.wake, timeline.bed, mealsPerDay, timeline.blocks, timeline.restPerHour)
  const plannedBudgets = ownSplit ? splitBudgetPct(timeline.budget, planned) : splitBudget(timeline.budget, planned)
  const windowsKnown = !dayPending && !dayError && planned.length > 0 && timeline.budget.kcal > 0
  const heroWindows: TideWindow[] = windowsKnown
    ? planned.map((w, i) => ({ time: w.time, label: w.label, kcal: plannedBudgets[i]?.kcal ?? 0 }))
    : evenWindows(mealsPerDay)
  const mealCount = heroWindows.length

  const save = async () => {
    if (busy) return
    setSaveError(false)
    const beforeKcal = fuel.targets.kcal
    try {
      await Promise.all([
        setSettings({ mealsPerDay, caffeineCutoff }),
        setDiet(draft),
      ])
      // The save may have re-prescribed today's served kcal (the learning switch's own effect,
      // mezo-3n2so) — refetch the day and diff against the pre-save reading. Mock mode's fuelDay
      // seed never reacts to the switch, so this resolves to the same value there and the diff
      // is always 0 → plain "Mentve" (told to the owner as a known mock-mode simplification).
      await qc.refetchQueries({ queryKey: ['fuelDay', localDateString()] })
      const afterKcal = qc.getQueryData<{ targets: { kcal: number } }>(['fuelDay', localDateString()])
        ?.targets.kcal ?? beforeKcal
      const diff = Math.round(afterKcal - beforeKcal)
      toast.show({
        kind: 'success',
        text: diff !== 0 ? S.savedDiff(`${diff > 0 ? '+' : '−'}${fmtGrouped(Math.abs(diff))}`) : S.saved,
      })
      flushSync(() => setSaved(true))
      navigate('/settings', { state: originState })
    } catch { setSaveError(true) }
  }

  const dirty = !saved && ((touchedDiet && dietDirty) || (touchedFuel && (mealsPerDay !== settings.mealsPerDay || caffeineCutoff !== settings.caffeineCutoff)))
  const goSettings = () => navigate('/settings', { state: originState })
  const back = <FrameBack className="fo-backpill" onBack={goSettings}>{T.frame.backToSettings}</FrameBack>

  if (fuelError || dietError) {
    return (
      <Page nonav className="fb-page">
        <UnsavedChangesGuard dirty={dirty} />
        {back}
        <Card>
          <Empty icon="t-info" actions={<Btn sm onClick={() => { retryFuel(); retryDiet() }}>{T.retry}</Btn>}>
            <span role="alert">{S.loadError}</span>
          </Empty>
        </Card>
      </Page>
    )
  }

  // Betöltés közben csak a hős áll: semmit nem lehet átállítani, amíg a mentett értékek meg nem jöttek.
  if (isPending || dietPending) {
    return (
      <Page nonav className="fb-page">
        <UnsavedChangesGuard dirty={dirty} />
        {back}
        <Hero className="fb-hero" label={S.hero.label} verdict={<span role="status">{T.loading}</span>} sub={S.loadingSub}>
          <div className="fb-hg"><FuelWindowTide windows={evenWindows(4)} bare /></div>
        </Hero>
      </Page>
    )
  }

  const setPreset = (value: DietSettings['splitPreset']) => { setTouchedDiet(true); setSplitPreset(value) }
  const customFields = [
    [S.macros.proteinPct, pPct, setPPct],
    [S.macros.carbsPct, cPct, setCPct],
    [S.macros.fatPct, fPct, setFPct],
  ] as const

  return (
    <Page nonav className="fb-page" foot={<Btn grow className="fb-save" disabled={busy} onClick={() => void save()}>{T.save}</Btn>}>
      <UnsavedChangesGuard dirty={dirty} />
      {back}
      {saveError && <p className="fb-alert" role="alert">{S.saveError}</p>}

      <Hero
        className="fb-hero"
        label={S.hero.labelMeals(mealCount)}
        verdict={timeline.budget.kcal > 0 ? S.hero.verdict(fmtGrouped(timeline.budget.kcal), mealCount) : S.hero.verdictNoBudget(mealCount)}
        sub={windowsKnown ? S.hero.sub : `${S.hero.windowsLoading} ${S.hero.sub}`}
      >
        <div className={windowsKnown ? 'fb-hg' : 'fb-hg is-bare'}>
          <FuelWindowTide windows={heroWindows} cutoff={caffeineCutoff} bare={!windowsKnown} />
          {/* a rajz olvasata a képernyőolvasónak: a piszkozat két értéke egy mondatban */}
          <p className="sr-only">{S.hero.summary(mealsPerDay, caffeineCutoff)}</p>
        </div>
      </Hero>

      <Section n={1} title={S.rhythm.title} />
      <Card className="fb-rhythm">
        <div className="fb-two fb-ws">
          <div>
            <Lab>{S.rhythm.meals}</Lab>
            <Stepper
              name={S.rhythm.mealsName}
              value={<>{mealsPerDay}<small>{S.rhythm.mealsUnit}</small></>}
              n={mealsPerDay} min={3} max={6}
              onDec={() => { setTouchedFuel(true); setMealsPerDay(Math.max(3, mealsPerDay - 1)) }}
              onInc={() => { setTouchedFuel(true); setMealsPerDay(Math.min(6, mealsPerDay + 1)) }}
            />
          </div>
          <div>
            <Lab htmlFor={`${ids}cut`}>{S.rhythm.cutoff}</Lab>
            <Input id={`${ids}cut`} type="time" value={caffeineCutoff}
              onChange={(event) => {
                if (!event.target.value) return
                setTouchedFuel(true)
                setCaffeineCutoff(event.target.value)
              }} />
          </div>
        </div>
        <Note>{S.rhythm.cutoffNote}</Note>
        <Row icon="t-clock" title={S.rhythm.windows} sub={S.rhythm.windowsSub} aria-label={S.rhythm.windowsAria}
          onClick={() => navigate('/settings/fuel/slots', { state: originState })} />
        <Note>{S.rhythm.ownSplitNote}</Note>
      </Card>

      <Section n={2} title={S.macros.title} />
      <Card className="fb-mac" data-section="macros">
        <Lab htmlFor={`${ids}prof`}>{S.macros.profile}</Lab>
        <Select id={`${ids}prof`} value={splitPreset} onChange={(event) => setPreset(event.target.value as DietSettings['splitPreset'])}>
          {PRESET_KEYS.map((key) => <option key={key} value={key}>{S.macros.preset[key]}</option>)}
        </Select>

        {previewError || dayError ? (
          <>
            <Note className="fb-warn" role="alert">{S.macros.previewError}</Note>
            <Acts><Btn sm ghost onClick={() => { retryPreview(); retryDay() }}>{S.macros.previewRetry}</Btn></Acts>
          </>
        ) : previewPending || dayPending ? (
          <Txt role="status">{S.macros.previewPending}</Txt>
        ) : preview ? (
          <>
            <Lab>{(dietDirty ? S.macros.fromDraft : S.macros.fromTarget)(fmtGrouped(preview.kcal))}</Lab>
            <Vials height={96} items={([
              [M.fuelKozos.macro.protein, 't-meat', MACRO_COLOR.protein, preview.protein],
              [M.fuelKozos.macro.carbs, 't-carb', MACRO_COLOR.carbs, preview.carbs],
              [M.fuelKozos.macro.fat, 't-avocado', MACRO_COLOR.fat, preview.fat],
            ] as const).map(([label, icon, color, macro]) => ({
              label, icon, color, pct: macro.pct * 1.7, value: `${macro.pct}%`, note: S.macros.grams(fmtGrouped(macro.grams)),
            }))} />
            {dietDirty && <Note className="fb-refresh">{S.macros.previewNote}</Note>}
          </>
        ) : <Txt>{S.macros.targetPending}</Txt>}

        {splitPreset === 'custom' && (
          <>
            <div className="fb-3">
              {customFields.map(([label, value, setter], i) => (
                <div key={i}>
                  <Lab htmlFor={`${ids}c${i}`}>{label}</Lab>
                  <Input id={`${ids}c${i}`} type="number" min={0} max={100} step={0.5} value={value}
                    onChange={(event) => { setTouchedDiet(true); setter(Number(event.target.value)) }} />
                </div>
              ))}
            </div>
            {!customSumOk && <Note className="fb-bad" role="alert">{S.macros.sumError}</Note>}
            <Note>{S.macros.customNote}</Note>
          </>
        )}
      </Card>

      <Section n={3} title={S.targets.title} />
      <Card className="fb-targets">
        <div className="fb-two">
          <div>
            <Lab htmlFor={`${ids}water`}>{S.targets.water}</Lab>
            <Input id={`${ids}water`} type="number" min={500} max={8000} step={100} value={waterMl}
              onChange={(event) => { setTouchedDiet(true); setWaterMl(Number(event.target.value)) }} />
          </div>
          <div>
            <Lab htmlFor={`${ids}fiber`}>{S.targets.fiber}</Lab>
            <Input id={`${ids}fiber`} type="number" min={10} max={80} value={fiberG}
              onChange={(event) => { setTouchedDiet(true); setFiberG(Number(event.target.value)) }} />
          </div>
        </div>
      </Card>

      <Section n={4} title={S.tuning.title} />
      <Card className="fb-tuning">
        <Lab id={`${ids}tier`}>{S.tuning.proteinLevel}</Lab>
        {/* mezo-jb84: HÁROM fokozat, és mindegyik tényleg mozgatja a célt (a testsúly- és a zsírmentes-tömeg ágat is). */}
        <Pills role="group" aria-labelledby={`${ids}tier`}>
          {TIER_KEYS.map((key) => (
            <Pill key={key} on={proteinTier === key} onClick={() => { setTouchedDiet(true); setProteinTier(key) }}>{S.tuning.tier[key]}</Pill>
          ))}
        </Pills>
        <Note>{S.tuning.proteinNote}</Note>
        <Row icon="t-lens" title={S.tuning.learning} sub={S.tuning.learningSub}
          right={<Switch on={learningEnabled} label={S.tuning.learning}
            onChange={() => { setTouchedDiet(true); setLearningEnabled((value) => !value) }} />} />
      </Card>
    </Page>
  )
}
