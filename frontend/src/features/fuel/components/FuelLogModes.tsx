import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { huInt } from '@/shared/lib/huNum'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import type { UsualMeal } from '@/features/fuel/logic/usualMeals'
import type { MealSlot } from '@/data/types'

/** Only the camera and usuals replace the content below the action row. Pantry and recipe
 * open the composer's existing pickers; text and voice stay visible in the composer. */
export type LogMode = 'photo' | 'usual'
export type LogSource = 'pantry' | 'recipe'

const ACTIONS: { id: 'photo' | LogSource | 'usual'; label: string; icon: Icon3DName; color: string }[] = [
  { id: 'photo', label: 'Fotó', icon: 't-camera', color: 'var(--dv-coral)' },
  { id: 'pantry', label: 'Kamra', icon: 't-stack', color: 'var(--dv-amber)' },
  { id: 'recipe', label: 'Recept', icon: 't-book', color: 'var(--dv-lav)' },
  { id: 'usual', label: 'Szokásosak', icon: 't-repeat', color: 'var(--dv-sage)' },
]

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Reggeli', lunch: 'Ebéd', snack: 'Uzsonna', dinner: 'Vacsora',
}

function usualHint(u: UsualMeal): string {
  const times = u.count === 1 ? 'egyszer logoltad' : `${huInt(u.count)}× logoltad`
  return `${SLOT_LABEL[u.slot]} · ${times}`
}

function UsualView({ usuals, onUsual }: { usuals: UsualMeal[]; onUsual: (u: UsualMeal) => void }) {
  if (usuals.length === 0) {
    return (
      <p className="fmx-mode-empty uv-empty">
        Még tanulom, mit szoktál enni. Pár logolás után itt lesznek a szokásosaid — addig fotózd
        le, vagy írd le lent.
      </p>
    )
  }
  return (
    <>
      <p className="fmx-mode-hint">Amihez ilyenkor a leggyakrabban nyúlsz — koppints rá, majd elemezd a szövegmezőből.</p>
      <div className="fmx-usuals">
        {usuals.map(u => (
          <button key={u.key} type="button" className="fmx-usual glass" onClick={() => onUsual(u)}>
            <span className="fmx-usual-art uv-well" aria-hidden="true"><Icon3D name="t-plate" size={34} /></span>
            <span className="fmx-usual-copy">
              <strong>{u.title}</strong>
              <small>{usualHint(u)}</small>
            </span>
            <b>{u.kcal == null ? '—' : huInt(u.kcal)}{u.kcal != null && <small>kcal</small>}</b>
          </button>
        ))}
      </div>
    </>
  )
}

export function FuelLogModes({ mode, onMode, onSource, photo, onPhoto, onRemovePhoto, onUsual, failed, usuals }: {
  mode: LogMode
  onMode: (m: LogMode) => void
  onSource: (source: LogSource) => void
  photo: File | null
  onPhoto: (file: File) => void
  onRemovePhoto: () => void
  onUsual: (u: UsualMeal) => void
  failed: boolean
  usuals: UsualMeal[]
}) {
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

  return (
    <div className="fmx-logmodes" data-kalauz-anchor="log-forrasok">
      <div className="fmx-modes glass" role="group" aria-label="Hozzáadás">
        {ACTIONS.map(action => (
          <button key={action.id} type="button"
            className={`fmx-mode${mode === action.id ? ' is-active' : ''}${action.id === 'usual' ? ' is-usual' : ''}`}
            style={{ '--c': action.color } as CSSProperties}
            aria-pressed={mode === action.id}
            onClick={() => {
              if (action.id === 'photo') openPhoto()
              else if (action.id === 'usual') onMode('usual')
              else { onMode('photo'); onSource(action.id) }
            }}>
            <Icon3D name={action.icon} size={30} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <input ref={fileInput} className="fmx-photo-input" type="file" accept="image/*"
        capture="environment" aria-label="Étel fotó · kamera"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onPhoto(file)
          e.target.value = ''
        }} />
      {mode === 'usual' ? <UsualView usuals={usuals} onUsual={onUsual} />
        : failed ? (
          <div className="fmx-failed uv-empty">
            <span className="fmx-failed-art" aria-hidden="true"><Icon3D name="t-camera" size={62} /><i>?</i></span>
            <small>ŐSZINTÉN SZÓLVA</small>
            <strong>Ezt a tányért nem ismertem fel.</strong>
            <p>Írd le lent, mit ettél, vagy próbáld meg új fotóval. A szöveget és az új fotót együtt is elemezheted.</p>
            <button type="button" className="fmx-failed-cta" onClick={openPhoto}>Új fotót készítek</button>
          </div>
        ) : (
          <>
            <div className={`fmx-finder glass${photo ? ' has-photo' : ''}`}>
              <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
              {photo ? (
                <div className="fmx-photo-show">
                  {photoUrl && <img src={photoUrl} alt="A kiválasztott étel fotója" />}
                  <div className="fmx-photo-caption">
                    <span><strong>Ételfotó csatolva</strong><small>{photo.name}</small></span>
                    <span className="fmx-photo-controls">
                      <button type="button" onClick={openPhoto}>Csere</button>
                      <button type="button" aria-label="Fotó eltávolítása" onClick={onRemovePhoto}>×</button>
                    </span>
                  </div>
                </div>
              ) : (
                <button type="button" className="fmx-camera-open" onClick={openPhoto}>
                  <Icon3D name="t-plate" size={72} className="uv-float" />
                  <strong>Fotózd le a tányért</strong>
                  <small>Koppints a fotózáshoz</small>
                </button>
              )}
            </div>
            <p className="fmx-mode-hint">Fotózhatsz, vagy lent rögtön leírhatod, mit ettél.</p>
          </>
        )}
    </div>
  )
}
