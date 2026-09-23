// ============================================================
// Mezo · StackPageScaffold — a Protokoll és az Új elem közös lapváza.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `head()` + `protokoll()` / `stackUj()`):
// a fejléc egy kerek üveg vissza-gomb + szemöldök (a szülőlap neve) + laptitulus; a hős KERET
// NÉLKÜLI halo a nagy 3D ikonnal és a nagy számmal. A `compact` változat (Új elem) hős nélkül
// fut: a nagy szám (lépés/3) a fejléc jobb szélére kerül, a lépés nevét a lépés-sáv mondja.
// A navigáció változatlan: a vissza-gomb ugyanoda visz, mint eddig.
// ============================================================
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContentIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, type PageTone } from '@/shared/ui/mozaik'

interface StackPageScaffoldProps {
  tone: PageTone
  // S5 (mezo-qt5q): a `/fuel/stack/manage` négyes megszűnt — a Kezelés a Protokoll-lap
  // szekciója lett (D3), tehát a visszaút oda vezet, nem egy leváltott útvonalra.
  backTo: '/fuel/stack' | '/fuel/stack/protocol'
  backLabel: '‹ Stack' | '‹ Protokoll'
  icon: ClayIconName | Icon3DName
  name: string
  big?: ReactNode
  sub?: string
  /** a hős halójának színe (`--c`) */
  accent?: string
  /** `compact`: nincs hős, a nagy szám a fejléc jobb szélén áll */
  variant?: 'hero' | 'compact'
  children: ReactNode
}

export function StackPageScaffold({
  tone, backTo, backLabel, icon, name, big, sub, accent = 'var(--dv-sage)', variant = 'hero',
  children,
}: StackPageScaffoldProps) {
  const navigate = useNavigate()
  const eyebrow = backLabel.replace('‹', '').trim()
  return (
    <MozaikPage tone={tone} className="stk-detail-page">
      <div className="fsx-subhead">
        <button type="button" className="glass is-round" onClick={() => navigate(backTo)}
          aria-label="Vissza">‹</button>
        <span>
          <small>{eyebrow}</small>
          <strong>{name}</strong>
        </span>
        {variant === 'compact' && big !== undefined && (
          <span className="fsx-subhead-num">{big}</span>
        )}
      </div>
      <EntranceGroup>
        {variant === 'hero' && (
          <div className="stk-page-hero fsx-halo-hero uv-halo"
            style={{ '--c': accent } as React.CSSProperties}>
            <span className="fsx-halo-art" aria-hidden="true"><ContentIcon name={icon} size={84} /></span>
            {big !== undefined && <strong className="fsx-halo-num">{big}</strong>}
            {sub && <small className="fsx-halo-sub">{sub}</small>}
          </div>
        )}
        <PageBody className="stk-detail-body">{children}</PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
