// ============================================================
// Mezo · Clay 3D icon set (design_2.0 — mezo-d20.1.2)
// The sprite SVGs are VERBATIM copies of docs/design_2.0/assets/
// clay-icons.svg + clay-spots.svg (1:1 fidelity contract). Never
// edit them here — new art lands in the design_2.0 sprites first,
// then gets re-copied. ClaySprites mounts the <symbol> defs once
// (AppLayout); ClayIcon/ClaySpot render <use> references.
// ============================================================
import { memo } from 'react'
import claySpotsRaw from './clay-spots.svg?raw'
import clayIconsRaw from './clay-icons.svg?raw'

export type ClayIconName =
  | 'i-nap' | 'i-edzes' | 'i-fuel' | 'i-mezo' | 'i-polc' | 'i-viz' | 'i-alvas'
  | 'i-eletjel' | 'i-minta' | 'i-naplo' | 'i-cel' | 'i-stack' | 'i-suly' | 'i-sport'
  | 'i-futas' | 'i-meso' | 'i-emberek' | 'i-tudas' | 'i-ertesites' | 'i-growth'
  | 'i-erme' | 'i-lang' | 'i-beallitas' | 'i-mikrofon' | 'i-kamra' | 'i-recept'
  | 'i-rend' | 'i-level' | 'i-hajnal' | 'i-video' | 'i-idozito' | 'i-kihivas'
  | 'i-checkin' | 'i-injekcio' | 'i-reggeli' | 'i-ebed' | 'i-snack' | 'i-vacsora'
  | 'i-memoar' | 'i-lombik' | 'i-kristaly' | 'i-retegek' | 'i-heti'
  | 'i-hold' | 'i-termes'
  // F7.4 (mezo-d20.8.4.1): the 8 LIFE-skill life-area symbols — the emoji set's clay successor.
  | 'i-life-tudatossag' | 'i-life-szemlelet' | 'i-life-konyha' | 'i-life-penzugyek'
  | 'i-life-produktivitas' | 'i-life-tanulas' | 'i-life-kapcsolatok' | 'i-life-regeneracio'
  // Receptműhely (mezo-92pb): the AI recipe workshop's own symbol — tányér + szikrák.
  | 'i-muhely'

export type ClaySpotName =
  | 's-reggel' | 's-este' | 's-viz' | 's-energia' | 's-edzes' | 's-medal'
  | 's-orb' | 's-orb-ejszaka' | 's-orb-figyel' | 's-orb-unnepel'
  | 's-piheno' | 's-napzaras' | 's-hajtas' | 's-hegycel'
  // Karakter persona orb variants (mezo-1gim.13) — one per Csapat expert + szkeptikus.
  | 's-orb-doki' | 's-orb-edzo' | 's-orb-taplalkozo' | 's-orb-szomnologus'
  | 's-orb-pszichologus' | 's-orb-drill' | 's-orb-antropologus' | 's-orb-szkeptikus'
  // Szekció-spotok a shell-fejléchez (mezo-8az6): a Fuel és az Én darabja hiányzott.
  | 's-fuel' | 's-en'

/** Mounts the clay <symbol>/<gradient> defs once. Rendered by AppLayout. */
export const ClaySprites = memo(function ClaySprites() {
  return (
    <span
      aria-hidden="true"
      // Verbatim sprite injection — the raw files are the 1:1 asset contract.
      dangerouslySetInnerHTML={{ __html: clayIconsRaw + claySpotsRaw }}
    />
  )
})

interface ClayProps<N extends string> { name: N; size?: number; className?: string }

function ClayUse({ name, size = 24, className }: ClayProps<string>) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={className}>
      <use href={`#${name}`} />
    </svg>
  )
}

export function ClayIcon(props: ClayProps<ClayIconName>) {
  return <ClayUse {...props} />
}

export function ClaySpot(props: ClayProps<ClaySpotName>) {
  return <ClayUse {...props} />
}
