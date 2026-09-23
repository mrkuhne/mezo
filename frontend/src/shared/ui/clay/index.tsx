// ============================================================
// Mezo · Clay 3D icon set (design_2.0 — mezo-d20.1.2)
// The sprite SVGs are VERBATIM copies of docs/design_2.0/assets/
// clay-icons.svg + clay-spots.svg (1:1 fidelity contract). Never
// edit them here — new art lands in the design_2.0 sprites first,
// then gets re-copied.
// Visszaöltöztetés (mezo-ju4j6.3): the Titanium redraw (d302e941f) is rolled
// back. The 54 pre-Titanium symbols + all 24 spots come verbatim from
// docs/design_2.0/assets/restored-world/clay-{icons,spots}-pre-titanium.svg;
// the 13 Titanium-era names (Fuel fülsor, makrók, értékelés-dimenziók,
// vércukor, ⓘ) are redrawn in the clay material per the style bible §6.1. ClaySprites mounts the <symbol> defs once
// (AppLayout); ClayIcon/ClaySpot render <use> references.
// ============================================================
import { memo } from 'react'
import claySpotsRaw from './clay-spots.svg?raw'
import clayIconsRaw from './clay-icons.svg?raw'
import titaniumIconsRaw from './titanium-icons.svg?raw'

export type ClayIconName =
  | 'i-nap' | 'i-edzes' | 'i-fuel' | 'i-mezo' | 'i-polc' | 'i-viz' | 'i-alvas'
  | 'i-eletjel' | 'i-minta' | 'i-naplo' | 'i-cel' | 'i-stack' | 'i-suly' | 'i-sport'
  | 'i-futas' | 'i-meso' | 'i-emberek' | 'i-tudas' | 'i-ertesites' | 'i-growth'
  | 'i-info' | 'i-erme' | 'i-lang' | 'i-beallitas' | 'i-mikrofon' | 'i-kamra' | 'i-recept'
  | 'i-rend' | 'i-level' | 'i-hajnal' | 'i-video' | 'i-idozito' | 'i-kihivas'
  | 'i-checkin' | 'i-injekcio' | 'i-reggeli' | 'i-ebed' | 'i-snack' | 'i-vacsora'
  | 'i-memoar' | 'i-lombik' | 'i-kristaly' | 'i-retegek' | 'i-heti'
  | 'i-hold' | 'i-termes'
  // F7.4 (mezo-d20.8.4.1): the 8 LIFE-skill life-area symbols — the emoji set's clay successor.
  | 'i-life-tudatossag' | 'i-life-szemlelet' | 'i-life-konyha' | 'i-life-penzugyek'
  | 'i-life-produktivitas' | 'i-life-tanulas' | 'i-life-kapcsolatok' | 'i-life-regeneracio'
  // Receptműhely (mezo-92pb): the AI recipe workshop's own symbol — tányér + szikrák.
  | 'i-muhely'
  // Fuel Titanium (mezo-o6uv): a Fuel fülsor négy saját szimbóluma.
  | 'i-tanyer' | 'i-kiegeszito' | 'i-trend' | 'i-fazek'
  // Fuel Titanium S1a (mezo-33k6): az owner makró-identitása a Mai hero gyűrűsorához —
  // fehérje = hús, szénhidrát = gabona, zsír = avokádó, rost = növény (a víz már megvolt).
  | 'i-hus' | 'i-gabona' | 'i-avokado' | 'i-noveny'
  // Fuel Titanium S1b (mezo-33k6): az értékelés három dimenziójának SAJÁT arca — a generikus
  // szimbólumok nem illettek rájuk (owner). A napi kontextus marad az óra (`i-idozito`).
  | 'i-makro' | 'i-mikro' | 'i-feldolgozas'
  // Fuel · vércukor-válasz (mezo-6mi43): a negyedik Minőség-kártya és az üvegdoboza arca —
  // a prototípus „domb" metaforája (alapszint-tengely + válasz-görbe + csúcs-kavics).
  | 'i-vercukor'
  // Edzés-verdikt + rekord (mezo-ju4j6.11): a szett sorának három jele. A Titán-kor szöveg-
  // glifákat (▲/▼) és egy sárga korongot viselt itt — ezek a ház SAJÁT agyag szimbólumai,
  // és nagyobbak: a 22px-es cellában a korábbi jel olvashatatlan volt (owner 2026-09-19).
  | 'i-trend-fel' | 'i-trend-le' | 'i-erem'

export type ClaySpotName =
  | 's-reggel' | 's-este' | 's-viz' | 's-energia' | 's-edzes' | 's-medal'
  | 's-orb' | 's-orb-ejszaka' | 's-orb-figyel' | 's-orb-unnepel'
  | 's-piheno' | 's-napzaras' | 's-hajtas' | 's-hegycel'
  // Karakter persona orb variants (mezo-1gim.13) — one per Csapat expert + szkeptikus.
  | 's-orb-doki' | 's-orb-edzo' | 's-orb-taplalkozo' | 's-orb-szomnologus'
  | 's-orb-pszichologus' | 's-orb-drill' | 's-orb-antropologus' | 's-orb-szkeptikus'
  // Szekció-spotok a shell-fejléchez (mezo-8az6): a Fuel és az Én darabja hiányzott.
  | 's-fuel' | 's-en'

/** The Titanium 3D content icons (üveg style bible §4, mezo-me75u.1): the companion-titanium
 *  sprite's 62 symbols verbatim + the custom icons drawn in its recipe, namespaced `t-*` (defs
 *  `tg-*`) so they share one DOM with the clay set. Source of truth + generator:
 *  docs/design_2.0/assets/titanium-icons.svg ← scripts/gen-titanium-sprite.mjs. CHROME keeps
 *  the clay icons (header, tabs); CONTENT wears these. */
export type Icon3DName =
  | 't-sun' | 't-water' | 't-moon' | 't-bolt' | 't-book' | 't-ring' | 't-gem' | 't-heart'
  | 't-dumbbell' | 't-volley' | 't-kettle' | 't-run' | 't-history' | 't-play' | 't-note'
  | 't-up' | 't-down' | 't-hold' | 't-record' | 't-journal' | 't-tick' | 't-skip' | 't-star'
  | 't-star-half' | 't-star-empty' | 't-repeat' | 't-peak' | 't-bike' | 't-swim' | 't-football'
  | 't-basket' | 't-tennis' | 't-hike' | 't-trx' | 't-crossfit' | 't-other' | 't-info'
  | 't-bowl' | 't-stack' | 't-chat' | 't-person' | 't-meat' | 't-avocado' | 't-protein'
  | 't-carb' | 't-fat' | 't-fiber' | 't-macro' | 't-micro' | 't-processing' | 't-clock'
  | 't-shield' | 't-sugar' | 't-salt' | 't-sprout' | 't-camera' | 't-link' | 't-plate'
  | 't-supps' | 't-trend' | 't-pot' | 't-score' | 't-snack' | 't-ultra' | 't-glucose'
  | 't-portion'

/** Mounts the clay + Titanium <symbol>/<gradient> defs once (main.tsx). */
export const ClaySprites = memo(function ClaySprites() {
  return (
    <span
      aria-hidden="true"
      // Verbatim sprite injection — the raw files are the 1:1 asset contract.
      dangerouslySetInnerHTML={{ __html: clayIconsRaw + claySpotsRaw + titaniumIconsRaw }}
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

/** A Titanium 3D sprite icon (bible §4). 64×64 art; inside a `.glass` it picks up the accent
 *  halo from the uveg kit (`.glass .t-ico`). */
export function Icon3D({ name, size = 32, className }: { name: Icon3DName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true"
      className={className ? `t-ico ${className}` : 't-ico'}>
      <use href={`#${name}`} />
    </svg>
  )
}

// Boop (mezo-ju4j6.15) — a kabalafigura a clay készlet része, de SAJÁT komponenssel jön:
// példányonként inline SVG, mert mozog (lásd `boop/Boop.tsx` fejlécét).
export { Boop, type BoopDomain } from './boop/Boop'
