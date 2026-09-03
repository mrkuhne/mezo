// ============================================================
// Mezo · A fejléc aurora háttere (mezo-8az6) — a Huawei-féle „nem sáv, hanem felület"
// recept: wash + két elmosott fényfolt + napszak-grafika. A réteg alja maszkkal fakul
// a tartalomba (prototype.css), így nincs éles vágás a fejléc és az oldal között.
// Tisztán dekoratív: aria-hidden, és a CSS pointer-events: none-t ad rá.
// A látvány forrása: docs/design_2.0/prototypes/header-aurora.html
// ============================================================
import type { ReactElement } from 'react'
import type { DayFace } from '@/features/today/logic/dayFace'

/** A napszakok dekorációja. A viewBox mindenütt 240×92 — a sáv magassága. */
const DECO: Record<DayFace, ReactElement> = {
  reggel: (
    <>
      <path className="app-head-arc" d="M10 84 A 180 180 0 0 1 230 84" />
      <path className="app-head-arc" d="M44 84 A 140 140 0 0 1 196 84" opacity="0.55" />
      <circle className="app-head-dfill" cx="120" cy="38" r="11" />
    </>
  ),
  nap: (
    <>
      <circle className="app-head-arc" cx="188" cy="18" r="36" />
      <circle className="app-head-arc" cx="188" cy="18" r="56" opacity="0.5" />
      <ellipse className="app-head-dfill" cx="76" cy="56" rx="32" ry="10" opacity="0.45" />
      <ellipse className="app-head-dfill" cx="112" cy="70" rx="24" ry="8" opacity="0.3" />
    </>
  ),
  este: (
    <>
      <path className="app-head-arc" d="M230 78 A 180 180 0 0 0 10 78" opacity="0.5" />
      <circle className="app-head-dfill" cx="158" cy="22" r="2.4" />
      <circle className="app-head-dfill" cx="200" cy="40" r="1.7" />
      <circle className="app-head-dfill" cx="128" cy="44" r="1.4" />
      <circle className="app-head-dfill" cx="216" cy="16" r="1.4" />
      <circle className="app-head-dfill" cx="104" cy="20" r="1.8" />
      <path className="app-head-dfill" d="M188 60a14 14 0 1 1-6-25a11 11 0 0 0 6 25Z" />
    </>
  ),
}

export function HeaderAurora({ face }: { face: DayFace }) {
  return (
    <div className="app-head-bg" data-face={face} aria-hidden="true">
      <div className="app-head-wash" />
      <span className="app-head-blob b1" />
      <span className="app-head-blob b2" />
      <div className="app-head-deco">
        <svg viewBox="0 0 240 92" width="240" height="92">{DECO[face]}</svg>
      </div>
    </div>
  )
}
