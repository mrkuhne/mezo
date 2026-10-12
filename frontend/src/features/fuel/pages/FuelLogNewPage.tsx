// ============================================================
// Mezo · FuelLogNewPage — /fuel/log/uj, a logolás saját oldala (mezo-bq2t)
// Folyadék (mezo-n4wf5.5): prototípus docs/design_2.0/prototypes/vilagos/fuel.js `log()` — a címsor
// a kereté (cím = az ablak neve / „Ablakon kívül" / „Javítás", fölötte „Logolás · nap · ma"), az oldal
// teste a MealComposer (az a `Page`, a lebegő gombsorral), a négy bejárat a FuelLogModes.
//
// A Mai lap blokk-gombjai ide navigálnak: a MealComposer teljes képernyőt kap, a címsor végig mutatja,
// MELYIK ablakba és MELYIK napra könyvelsz, a gombsor pedig az oldal aljára tapad.
//
// A kontextus az URL-ben él (d = nap, w = ablak-kulcs, ai = AI-panel), így a
// logolás deep-linkelhető és a böngésző-vissza természetes. Ismeretlen `w` nem
// hiba: ablakon kívüli logolásra esik vissza — sosem fabrikálunk ablakot.
//
// ADR 0056 (mezo-qe90y): a négy közvetlen út Fotó, Kamra, Recept, Szokásosak. A MealComposer
// szövegmezője és mikrofonja mindig látható; a fotó előnézete itt él, az AI csak Elemzésre indul.
// Az `?ai=1` továbbra is a szöveges AI-bejáratot jelenti, most már a közös felületen.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, asPastDayLane, tileKey, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { backfillOffset } from '@/features/fuel/logic/backfillWindow'
import { rankUsualMeals } from '@/features/fuel/logic/usualMeals'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { addDays, huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { useM } from '@/shared/i18n'
import { FrameBack, useFrameTitle } from '@/shared/ui/folyadek'
import { Strip } from '@/features/fuel/components/folyadek'
import { MealComposer } from '@/features/fuel/components/MealComposer'
import { FuelLogModes, type LogMode, type LogSource } from '@/features/fuel/components/FuelLogModes'

/** A catalog text with one `**bold**` run. */
const marked = (text: string) => text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))

export function FuelLogNewPage() {
  const M = useM()
  const P = M.fuelLog.page
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Egyszer rögzítve (mezo-1j3z, 4. finding): újraszámolva egy éjfél utáni re-render
  // elmozdítaná a `date`-et — és vele a nyitott composer logDate-jét — szerkesztés közben.
  const [today] = useState(() => localDateString())

  // A pótlási ablak EGY szabály (S1d, mezo-33k6): ugyanaz a helper clampeli a /fuel/log
  // stepperjét és a Mai lapozóját is, hogy a lapozó ne érhessen el olyan napot, amit ez a
  // lap visszautasít. Ami kívül esik (vagy nem parse-olható), az MA lesz.
  const offset = backfillOffset(searchParams.get('d'), today)
  const date = addDays(today, -offset)
  const past = offset > 0
  const ai = searchParams.get('ai') === '1'

  const { plan, budget, nowHHmm } = useFuelTimeline(date)
  const { fuel } = useFuelDay(date)
  const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const lane = past ? asPastDayLane(laneRaw) : laneRaw
  // A `w` az ablak SAJÁT kulcsa (`${time}-${label}`) — pontos egyezés, sosem index.
  // Ismeretlen kulcs → null: szabad induló kontextus, az evés idejét külön lehet megadni.
  const wKey = searchParams.get('w')
  const tile: WindowTileVM | null = lane.tiles.find(t => t.key === wKey) ?? null

  // Az ablakból indított logolás a terv receptjét is hozza — pontosan úgy, ahogy a
  // /fuel/log blokkja tette. Az AI-ág kihagyja: a user az AI utat választotta.
  const slot = tile != null ? plan.slots.find(s => tileKey(s) === tile.key) : undefined
  const prefill = slot?.suggestedRecipeId && !ai
    ? { source: 'recipe' as const, recipeId: slot.suggestedRecipeId }
    : null

  // Mentés és Mégse ugyanoda tér vissza: a napi lista, ugyanazon a napon. `replace`, hogy a
  // böngésző-vissza ne dobjon vissza a már lezárt composerbe.
  // S5 (mezo-qt5q): a napi lista a MAI lap (`/fuel`) — a `/fuel/log` oldal megszűnt, és egy
  // belső navigáció nem futhat bele a redirectjébe.
  const back = () => navigate(`/fuel${past ? `?d=${date}` : ''}`, { replace: true })

  const dayLabel = P.day(huMonthDay(date))

  // A kamera az alapnézet; a szöveg és mikrofon a héj alatt végig elérhető. A héj állapotai itt
  // élnek, a felismerés pedig a composer egyetlen AI-hívóhelyén fut.
  const [mode, setMode] = useState<LogMode>('photo')
  const [failed, setFailed] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [sourceAction, setSourceAction] = useState<{ source: LogSource; seq: number } | null>(null)
  const openSource = (source: LogSource) =>
    setSourceAction(prev => ({ source, seq: (prev?.seq ?? 0) + 1 }))
  const [aiTextIn, setAiTextIn] = useState<{ text: string; seq: number } | null>(null)
  const pushAiText = (text: string) =>
    setAiTextIn(prev => ({ text, seq: (prev?.seq ?? 0) + 1 }))
  // A szokásosak a nap logolt étkezéseiből rangsorolódnak, a terv saját órájával (nincs ambiens
  // idő). Előzmény nélkül a lista üres — a héj ezt őszintén ki is mondja.
  const usuals = rankUsualMeals(fuel.meals, nowHHmm)

  // ── A8: `?edit=<mealId>` — egy MÁR logolt étkezés javítása (mezo-33k6) ──────────────────────
  // Ilyenkor a négy rögzítő út nem jön: nem új étkezést veszünk fel, hanem egy meglévőt
  // javítunk. A nap ugyanaz a `?d=` szerződés, hogy a múltbeli étkezés ideje megmaradjon.
  const editMealId = searchParams.get('edit') ?? undefined
  const editMeal = editMealId != null ? fuel.meals.find(m => m.id === editMealId) : undefined
  const editing = editMealId != null

  const windowSpan = slot?.windowFrom && slot.windowTo ? `${slot.windowFrom}–${slot.windowTo}` : tile?.time
  useFrameTitle({
    title: editing ? P.edit : tile ? tile.label : P.outside,
    eyebrow: editing
      ? (editMeal != null ? mealDisplayName(editMeal) ?? P.meal : P.meal)
      : P.eyebrow(past ? P.late : P.log, dayLabel, past ? huWeekdayFullIso(date).toLowerCase() : P.today),
  })

  const modes = (compact: boolean) => (
    <FuelLogModes
      mode={mode}
      compact={compact}
      onMode={(m) => { setFailed(false); setMode(m) }}
      onSource={openSource}
      photo={photo}
      onPhoto={(file) => { setFailed(false); setPhoto(file) }}
      onRemovePhoto={() => setPhoto(null)}
      // A szokásos sor neve a szövegmezőbe kerül; a user külön indítja az elemzést.
      onUsual={(u) => { pushAiText(u.title); setMode('photo') }}
      failed={failed}
      usuals={usuals}
    />
  )

  return (
    <MealComposer
      head={(
        <>
          <FrameBack className="fo-backpill" onBack={back} label={P.back}>‹ {P.back}</FrameBack>
          {past && !editing && <Strip icon="t-history">{marked(P.pastNote(dayLabel))}</Strip>}
        </>
      )}
      // Javításnál a négy rögzítő út nem jelenik meg: itt nem új étkezést veszünk fel.
      shell={editing ? undefined : modes}
      room={{
        label: tile ? P.windowLabel(tile.label, windowSpan ?? tile.time) : P.free,
        windowName: tile?.label,
        budgetKcal: tile?.budgetKcal ?? null,
      }}
      fixedSlot={tile?.slotKey}
      prefill={prefill}
      aiPanelOpenOnMount={!editing || ai}
      incomingPhoto={photo}
      incomingAiText={aiTextIn}
      sourceAction={sourceAction}
      onAiFailed={() => { setFailed(true); setPhoto(null) }}
      onAiSucceeded={() => setFailed(false)}
      // A héj adja a négy bejáratot; a composer szövegmezőt és a későbbi megerősítést adja.
      shellOwnsEntry={!editing}
      editMealId={editMealId}
      eatingTimeWindows={!editing ? plan.slots : undefined}
      logDate={past ? date : undefined}
      saveLabel={past ? P.saveLate(dayLabel) : undefined}
      onSaved={back}
      onCancel={back}
    />
  )
}
