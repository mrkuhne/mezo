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
  // U2 (mezo-me75u.2) — owner OK on prototypes/uveg-fuel-tobbi.html#ikonok
  | 't-mic' | 't-gear' | 't-syringe' | 't-protocol' | 't-dawn' | 't-sleep' | 't-flame'
  | 't-calendar' | 't-pin' | 't-weight' | 't-pattern' | 't-chef'
  // A2 (mezo-a9bo7.8) — owner OK on prototypes/uveg-uzenofal.html#ikonok: the csapat-fal trio
  | 't-thumb-up' | 't-thumb-down' | 't-send' | 't-flask'
  // U3 (mezo-me75u.3) — owner OK on prototypes/uveg-nap.html#ikonok
  | 't-checkin' | 't-quick' | 't-steps' | 't-people' | 't-chain' | 't-quest' | 't-harvest'
  | 't-coin' | 't-orb' | 't-scroll'
  // U4 (mezo-me75u.4) — owner OK on prototypes/uveg-edzes.html#ikonok
  | 't-muscle' | 't-bandage'

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

/**
 * Content icons during the mixed-look üvegesítés (bible §4): a surface that still carries CLAY
 * names in its view-model renders them through this map onto the Titanium 3D set. Only
 * context-free meanings live here — a clay glyph that means two things (the flask is both an
 * "estimate" source and the fat-quality dimension) is mapped at its call site instead, by
 * passing an `Icon3DName` directly. Unmapped clay names fall back to the clay icon, so a slice
 * can migrate one surface at a time. Every entry was approved on a slice's "Új ikonok" sheet
 * or already shown on its approved prototype (U1: prototypes/fuel-uveg.html +
 * prototypes/uveg-alap-ikonok.html).
 */
export const CLAY_TO_3D: Partial<Record<ClayIconName, Icon3DName>> = {
  // macros + water (fuel-uveg.html)
  'i-hus': 't-meat', 'i-gabona': 't-carb', 'i-avokado': 't-avocado', 'i-noveny': 't-fiber',
  'i-viz': 't-water',
  // meal slots (fuel-uveg.html; the snack apple on uveg-alap-ikonok.html)
  'i-reggeli': 't-sun', 'i-ebed': 't-bowl', 'i-vacsora': 't-moon', 'i-snack': 't-snack',
  'i-tanyer': 't-plate', 'i-fuel': 't-bowl',
  // score, time, day share, energy, sources
  'i-kristaly': 't-score', 'i-idozito': 't-clock', 'i-cel': 't-ring', 'i-lang': 't-bolt',
  'i-edzes': 't-dumbbell', 'i-recept': 't-book', 'i-kamra': 't-stack', 'i-kiegeszito': 't-supps',
  'i-makro': 't-macro', 'i-mikro': 't-micro', 'i-feldolgozas': 't-processing',
  'i-vercukor': 't-glucose', 'i-eletjel': 't-heart',
  // U2 (mezo-me75u.2): the rest of Fuel (prototypes/uveg-fuel-tobbi.html + its Új ikonok sheet)
  'i-muhely': 't-chef', 'i-injekcio': 't-syringe', 'i-hajnal': 't-dawn', 'i-alvas': 't-sleep',
  'i-mikrofon': 't-mic', 'i-suly': 't-weight', 'i-minta': 't-pattern', 'i-polc': 't-stack',
  'i-video': 't-camera', 'i-naplo': 't-journal', 'i-hold': 't-moon', 'i-nap': 't-sun',
  'i-trend': 't-trend', 'i-fazek': 't-pot', 'i-stack': 't-protocol', 'i-beallitas': 't-gear',
  // U3 (mezo-me75u.3): Nap (prototypes/uveg-nap.html + its Új ikonok sheet). Ambiguous clay
  // glyphs stay at their call sites: i-kristaly on the Gyors node → t-quick and as a forecast →
  // t-orb, i-sport (Aktivitás → t-steps, the Sport tile → t-volley), i-lombik, i-termes, i-mezo.
  'i-checkin': 't-checkin', 'i-emberek': 't-people', 'i-rend': 't-chain', 'i-kihivas': 't-quest',
  'i-erme': 't-coin', 'i-memoar': 't-scroll', 'i-heti': 't-calendar', 'i-tudas': 't-book',
  'i-futas': 't-run',
  // U4 (mezo-me75u.4): Edzés (prototypes/uveg-edzes.html). The set-verdict glyphs, the medal and
  // the mesocycle are context-free; i-growth (overload here, growth on Én) and i-sport stay at
  // their call sites.
  'i-trend-fel': 't-up', 'i-trend-le': 't-down', 'i-erem': 't-record', 'i-meso': 't-peak',
}

/** A content icon: a Titanium name renders as is, a clay name through `CLAY_TO_3D`, and an
 *  unmapped clay name as the clay icon (the not-yet-re-dressed fallback). */
export function ContentIcon({ name, size = 32, className }: {
  name: ClayIconName | Icon3DName; size?: number; className?: string
}) {
  const t = name.startsWith('t-') ? (name as Icon3DName) : CLAY_TO_3D[name as ClayIconName]
  return t
    ? <Icon3D name={t} size={size} className={className} />
    : <ClayIcon name={name as ClayIconName} size={size} className={className} />
}

// Boop (mezo-ju4j6.15) — a kabalafigura a clay készlet része, de SAJÁT komponenssel jön:
// példányonként inline SVG, mert mozog (lásd `boop/Boop.tsx` fejlécét).
export { Boop, type BoopDomain, type BoopVariant } from './boop/Boop'
