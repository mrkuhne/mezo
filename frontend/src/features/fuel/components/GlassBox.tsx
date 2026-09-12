// ============================================================
// Mezo · GlassBox (Fuel Titanium, mezo-jb84)
//
// A Fuel üvegdobozai eddig natív `<dialog>` + `showModal()` voltak. Az a TOP LAYER-be teszi az
// elemet: a doboz a BÖNGÉSZŐ ablakához méreteződik, nem a telefon-kerethez, amiben az app él.
// Élesben ez így nézett ki: 641 px-es napi doboz egy 416 px-es telefon fölé lógva, a keretből
// kiszabadulva — a lap tartalma alatta levágva. A `showModal()` egyébként hasznos (fókuszcsapda,
// Escape, inert háttér), csak nem fér össze azzal, hogy a shell egy keretbe rajzolja az appot.
//
// A ház válasza erre a `Sheet` primitív mintája: a `.phone-screen`-be PORTÁLOZUNK, és abszolút
// pozíciót használunk — így a doboz és a hátlapja pontosan a készülék-viewportot fedi, a
// tab-bart is beleértve. Ez a komponens ugyanezt adja, üvegdoboz-alakban.
//
// Megtartja, amit a `showModal()` adott: Escape zár, a hátlap koppintása zár, a megnyíló doboz
// megkapja a fókuszt, és a felolvasó dialógusként látja (`role="dialog"` + `aria-modal`).
// ============================================================
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface GlassBoxProps {
  children: ReactNode
  onClose: () => void
  /** Az a cím-elem, ami a dobozt megnevezi a felolvasónak. */
  labelledBy?: string
  /** Extra osztály a dobozra — a hívó felületek saját hangolásaihoz. */
  className?: string
  /** Inline stílus (pl. dimenzió-hue CSS-változó) a dobozra. */
  style?: CSSProperties
}

export function GlassBox({ children, onClose, labelledBy, className, style }: GlassBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  // A keretbe rajzolunk, hogy az abszolút pozíció a KÉSZÜLÉK viewportjához igazodjon.
  // Tesztben (jsdom) nincs `.phone-screen`, ott a body a cél — a viselkedés ugyanaz.
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)

  useEffect(() => {
    boxRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fmx-glass-layer">
      {/* A hátlap REDUNDÁNS kijárat a doboz saját „Bezárom" gombja és az Escape mellett, ezért
          nem külön gomb: így nem duplázza a kisegítő technológiának ugyanazt a parancsot (és
          nem ütközik a doboz gombjának nevével). A ház `Sheet` primitívje ugyanezt teszi. */}
      <div className="fmx-glass-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={style}
        className={className ? `fmx-glass glass ${className}` : 'fmx-glass glass'}
      >
        {children}
      </div>
    </div>,
    target,
  )
}
