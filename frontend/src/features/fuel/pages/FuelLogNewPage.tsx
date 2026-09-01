// ============================================================
// Mezo · FuelLogNewPage — /fuel/log/uj, a logolás saját oldala (mezo-bq2t)
// Forrás: docs/design_2.0/prototypes/fuel-log-oldal.html (`renderCmpHead`,
// `.cmp-head` / `.cmp-daychip` / `.pastnote` / `.cmp-savebar`) +
// docs/superpowers/specs/2026-09-01-fuel-logolas-sajat-oldal-design.md
//
// A /fuel/log blokk-CTA-i ide navigálnak a helyben nyíló composer helyett: a
// MealComposer teljes képernyőt kap, a fejléc végig mutatja, MELYIK ablakba és
// MELYIK napra könyvelsz, a mentés-sáv pedig az oldal aljára tapad.
//
// A kontextus az URL-ben él (d = nap, w = ablak-kulcs, ai = AI-panel), így a
// logolás deep-linkelhető és a böngésző-vissza természetes. Ismeretlen `w` nem
// hiba: ablakon kívüli logolásra esik vissza — sosem fabrikálunk ablakot.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, asPastDayLane, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { addDays, huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { MealComposer } from '@/features/fuel/components/MealComposer'

// A /fuel/log stepperével azonos korlát (mezo-1j3z): egy hét pótlás, nem nyílt főkönyv.
// A ?d= deep link ugyanide clampel — ami kívül esik (vagy nem parse-olható), az MA lesz,
// sosem csúszik el csendben egy rossz napra.
const MAX_BACK = 7

export function FuelLogNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Egyszer rögzítve (mezo-1j3z, 4. finding): újraszámolva egy éjfél utáni re-render
  // elmozdítaná a `date`-et — és vele a nyitott composer logDate-jét — szerkesztés közben.
  const [today] = useState(() => localDateString())

  const offset = (() => {
    const d = searchParams.get('d')
    if (!d) return 0
    const diff = Math.round((+new Date(today) - +new Date(d)) / 86_400_000)
    return Number.isFinite(diff) && diff >= 1 && diff <= MAX_BACK ? diff : 0
  })()
  const date = addDays(today, -offset)
  const past = offset > 0
  const ai = searchParams.get('ai') === '1'

  const { plan, budget } = useFuelTimeline(date)
  const { fuel } = useFuelDay(date)
  const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const lane = past ? asPastDayLane(laneRaw) : laneRaw
  // A `w` az ablak SAJÁT kulcsa (`${time}-${label}`) — pontos egyezés, sosem index.
  // Ismeretlen kulcs → null: ablakon kívüli logolás, látható MIKOR szegmenssel.
  const wKey = searchParams.get('w')
  const tile: WindowTileVM | null = lane.tiles.find(t => t.key === wKey) ?? null

  // Az ablakból indított logolás a terv receptjét is hozza — pontosan úgy, ahogy a
  // /fuel/log blokkja tette. Az AI-ág kihagyja: a user a ✨ utat választotta.
  const slot = tile != null ? plan.slots.find(s => `${s.time}-${s.label}` === tile.key) : undefined
  const prefill = slot?.suggestedRecipeId && !ai
    ? { source: 'recipe' as const, recipeId: slot.suggestedRecipeId }
    : null

  // Mentés és Mégse ugyanoda tér vissza: a lista, ugyanazon a napon. `replace`, hogy a
  // böngésző-vissza ne dobjon vissza a már lezárt composerbe.
  const back = () => navigate(`/fuel/log${past ? `?d=${date}` : ''}`, { replace: true })

  const dayLabel = `${huMonthDay(date).toLowerCase()}.`

  return (
    <MozaikPage tone={past ? 'gold' : 'coral'} className="flognew-page">
      <PageHead onBack={back} label="‹ Vissza" />
      <div className={`flognew-head${past ? ' is-past' : ''}`}>
        <div className="flognew-ic"><ClayIcon name={tile?.icon ?? 'i-fuel'} size={26} /></div>
        <div className="flognew-txt">
          <div className="flognew-eyebrow">{past ? 'Pótlás' : 'Logolás'}</div>
          <div className="flognew-title">{tile ? tile.label : 'Ablakon kívül'}</div>
          <div className="flognew-sub">
            {tile ? `${tile.time} · ablak` : 'szabad tétel · te választod a mikort'}
          </div>
        </div>
        <span className="flognew-daychip">
          <b>{dayLabel}</b>
          <small>{past ? huWeekdayFullIso(date).toLowerCase() : 'ma'}</small>
        </span>
      </div>
      {past && (
        <div className="flognew-pastnote">
          <i aria-hidden="true" />
          Amit itt logolsz, <b>{dayLabel}</b> napra könyvelődik — pontszámot is kap.
        </div>
      )}
      <PageBody>
        <MealComposer
          fixedSlot={tile?.slotKey}
          prefill={prefill}
          aiPanelOpenOnMount={ai}
          logDate={past ? date : undefined}
          logTime={past ? tile?.time : undefined}
          saveLabel={past ? `✓ Pótlás · ${dayLabel}` : undefined}
          onSaved={back}
          onCancel={back}
        />
      </PageBody>
    </MozaikPage>
  )
}
