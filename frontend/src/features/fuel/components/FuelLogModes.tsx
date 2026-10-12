// Mezo · FuelLogModes — a naplózó négy bejárata (Fotó · Kamra · Recept · Szokásosak), ADR 0056.
// Folyadék (mezo-n4wf5.5, prototípus fuel.js `log()` — `.fu-modes`, `.fx-ph`, `.fu-fail`): négy csempe egy
// sorban, alattuk a kiválasztott út teste (fotó-mező / csatolt fotó / szokásosak / „nem ismertem fel").
// `compact` (már vannak tételek: „Adj hozzá még"): csak a csempék és az, amihez teendő tartozik — az üres
// fotó-mező és a súgója elmarad, a csatolt fotó, a szokásosak és a hiba-állapot megmarad.
import { useEffect, useRef, useState } from 'react'
import { m, useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import type { Icon3DName } from '@/shared/ui/clay'
import { Btn, Bub, Empty, Lk, Note, Row } from '@/shared/ui/folyadek'
import type { UsualMeal } from '@/features/fuel/logic/usualMeals'

/** Only the camera and usuals replace the content below the action row. Pantry and recipe
 * open the composer's existing pickers; text and voice stay visible in the composer. */
export type LogMode = 'photo' | 'usual'
export type LogSource = 'pantry' | 'recipe'

const ACTIONS: { id: 'photo' | LogSource | 'usual'; icon: Icon3DName }[] = [
  { id: 'photo', icon: 't-camera' },
  { id: 'pantry', icon: 't-stack' },
  { id: 'recipe', icon: 't-book' },
  { id: 'usual', icon: 't-repeat' },
]

function UsualView({ usuals, onUsual }: { usuals: UsualMeal[]; onUsual: (u: UsualMeal) => void }) {
  const M = useM()
  const L = M.fuelLog.modes
  if (usuals.length === 0) return <Empty icon="t-repeat">{L.usualEmpty}</Empty>
  // the window names are the shared logic labels, read at render
  const slot = m().fuelLogika.slot
  return (
    <>
      <Note className="fg-usual-hint">{L.usualHint}</Note>
      {usuals.map(u => (
        <Row key={u.key} className="fg-usual" icon="t-plate" title={u.title} chev={false}
          sub={u.count === 1 ? L.usualOnce(slot[u.slot]) : L.usualTimes(slot[u.slot], fmtGrouped(u.count))}
          value={u.kcal == null ? '—' : <>{fmtGrouped(u.kcal)}<small>kcal</small></>}
          onClick={() => onUsual(u)} />
      ))}
    </>
  )
}

export function FuelLogModes({ mode, onMode, onSource, photo, onPhoto, onRemovePhoto, onUsual, failed, usuals, compact = false }: {
  mode: LogMode
  onMode: (m: LogMode) => void
  onSource: (source: LogSource) => void
  photo: File | null
  onPhoto: (file: File) => void
  onRemovePhoto: () => void
  onUsual: (u: UsualMeal) => void
  failed: boolean
  usuals: UsualMeal[]
  /** The draft already has lines: the tiles stand above the composer's field („Adj hozzá még"). */
  compact?: boolean
}) {
  const M = useM()
  const L = M.fuelLog.modes
  const fileInput = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return }
    const url = URL.createObjectURL(photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const openPhoto = () => {
    onMode('photo')
    fileInput.current?.click()
  }

  const body = mode === 'usual' ? <UsualView usuals={usuals} onUsual={onUsual} />
    : failed ? (
      <div className="fg-fail">
        <Bub icon="t-camera" size={56} color="var(--fo-warn)" />
        <small>{L.failedEyebrow}</small>
        <strong>{L.failedTitle}</strong>
        <p>{L.failedText}</p>
        <Btn sm onClick={openPhoto}>{L.failedCta}</Btn>
      </div>
    ) : photo ? (
      <div className="fg-ph has">
        <span className="fg-pimg">
          {photoUrl ? <img src={photoUrl} alt={L.photoAlt} /> : <Bub icon="t-plate" size={56} />}
        </span>
        <span className="fg-pcap">
          <span><strong>{L.attached}</strong><small>{photo.name}</small></span>
          <Lk onClick={openPhoto}>{L.replace}</Lk>
          <button type="button" className="fg-x" aria-label={L.remove} onClick={onRemovePhoto}>×</button>
        </span>
      </div>
    ) : compact ? null : (
      <>
        <button type="button" className="fg-ph" onClick={openPhoto}>
          <Bub icon="t-plate" size={56} />
          <strong>{L.take}</strong>
          <small>{L.tap}</small>
        </button>
        <Note>{L.note}</Note>
      </>
    )

  return (
    <div className="fg-shell" data-kalauz-anchor="log-forrasok">
      <div className="fg-modes" role="group" aria-label={L.group}>
        {ACTIONS.map(action => {
          const on = mode === action.id
          // with lines on the page the camera tile is only outlined while a photo is attached
          const lit = on && !(compact && action.id === 'photo' && !photo)
          return (
            <button key={action.id} type="button" className={lit ? 'on' : undefined} aria-pressed={on}
              onClick={() => {
                if (action.id === 'photo') openPhoto()
                else if (action.id === 'usual') onMode('usual')
                else { onMode('photo'); onSource(action.id) }
              }}>
              <Bub icon={action.icon} size={34} />
              <span>{L[action.id]}</span>
            </button>
          )
        })}
      </div>
      <input ref={fileInput} className="fg-file" type="file" accept="image/*"
        capture="environment" aria-label={L.cameraInput}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onPhoto(file)
          e.target.value = ''
        }} />
      {body != null && <div className="fg-mode">{body}</div>}
    </div>
  )
}
