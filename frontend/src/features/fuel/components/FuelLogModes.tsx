// ============================================================
// Mezo · FuelLogModes — a villámgyors logolás módváltós héja (Fuel Titanium S1c, mezo-33k6;
// fagyasztott manifeszt A4 fotó-AI · A5 szöveg-AI · A6 hang · A7 szokásosak).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/food.js
// `modeTabs` (:17), `photoView` (:23), `voiceView` (:24), `textView` (:25), `usualView` (:26),
// `failedView` (:27); CSS: fuel-pages.css `/* Logger mode tabs */` (:2), `/* Camera demo */`
// (:7), `/* Voice demo */` (:25), `/* Usuals */` (:33), `/* Failure state */` (:41).
//
// A PROTOTÍPUS DEMÓ, EZ NEM AZ. A prototípus kamerája, felismerője és AI-ja hamis: minta-
// exponálás, beégetett joghurt-banán piszkozat, „nincs valódi AI-hívás" feliratok. Innen CSAK a
// LAYOUT és az ÁLLAPOTOK jönnek át. A fotó egy VALÓDI `<input type="file" capture>`, és a
// felismerést a `MealComposer` meglévő ága végzi (resizeImage → draftMealFromAi → a user
// jóváhagyja) — ez a héj egyetlen AI-hívást sem indít, egyetlen tételt sem ment.
//
// Owner-döntések, amiket az anatómia hordoz:
//   • a mód-sorrend FIX: fotó → hang → gépelés → szokásosak, és a felület a fotón nyit,
//   • a felismerés kudarca TELJES ÉRTÉKŰ állapot, ami a másik három utat kínálja — nem toast,
//   • a hang nem új backend: a leiratozott mondat ugyanabba a szövegmezőbe megy (A6),
//   • előzmény nélkül a szokásosak fül őszintén üres — nem találunk ki szokásokat.
// ============================================================
import type { CSSProperties } from 'react'
import { huInt } from '@/shared/lib/huNum'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { VoiceBubble } from '@/shared/ui/voice/VoiceBubble'
import type { UsualMeal } from '@/features/fuel/logic/usualMeals'
import type { MealSlot } from '@/data/types'

export type LogMode = 'photo' | 'voice' | 'text' | 'usual'

/** A négy mód a jóváhagyott sorrendben. A címkék a fülek EGYETLEN szövegei (a tesztje ezt
 *  a sorrendet és ezeket a szavakat őrzi). Üveg (mezo-me75u.2, uveg-fuel-tobbi `log()`): a
 *  Titanium 3D ikonok, és minden fül a SAJÁT hue-jában világít, ha aktív. */
const MODES: { id: LogMode; label: string; icon: Icon3DName; color: string }[] = [
  { id: 'photo', label: 'Fotó', icon: 't-camera', color: 'var(--dv-coral)' },
  { id: 'voice', label: 'Hang', icon: 't-mic', color: 'var(--dv-lav)' },
  { id: 'text', label: 'Gépelés', icon: 't-journal', color: 'var(--dv-sage)' },
  { id: 'usual', label: 'Szokásosak', icon: 't-repeat', color: 'var(--dv-amber)' },
]

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Reggeli', lunch: 'Ebéd', snack: 'Uzsonna', dinner: 'Vacsora',
}

/** „Hányszor, mikor" — a sor saját provenanciája. Soha nem becsült „≈" szám, mint a prototípusban. */
function usualHint(u: UsualMeal): string {
  const times = u.count === 1 ? 'egyszer logoltad' : `${huInt(u.count)}× logoltad`
  return `${SLOT_LABEL[u.slot]} · ${times}`
}

/** A valódi fotó-bemenet: a kamera közvetlenül, ugyanaz az input, amit a composer AI-panelje
 *  használ — csak a folyamat ELEJÉRE hozva. A héj nem elemez, csak átadja a fájlt. */
function PhotoView({ onPhoto }: { onPhoto: (file: File) => void }) {
  return (
    <div className="fmx-camera">
      <label className="fmx-finder glass">
        <span aria-hidden="true" /><span aria-hidden="true" />
        <span aria-hidden="true" /><span aria-hidden="true" />
        <Icon3D name="t-plate" size={92} className="uv-float" />
        <b>Fotózd le a tányért</b>
        <input type="file" accept="image/*" capture="environment" aria-label="Étel fotó · kamera"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f) }} />
      </label>
      <p className="fmx-mode-hint">
        Fotózd le a tányért — a felismert tételeket lent átírhatod, és csak utána mentünk.
      </p>
    </div>
  )
}

/** A hang-fül: VALÓDI felismerő (`useVoiceInput`, ugyanaz a leiratozó végpont, amit a chat és a
 *  napló használ). A mondat a hívóhoz megy, onnan a composer AI-szövegmezőjébe — nincs
 *  mintamondat-gomb és nincs hamis felismerő. */
function VoiceView({ onTranscript }: { onTranscript: (text: string) => void }) {
  const voice = useVoiceInput(onTranscript)
  const recording = voice.state === 'recording'
  const label = voice.state === 'unsupported'
    ? 'Hang · ez a böngésző nem tud hangot rögzíteni'
    : recording ? 'Hallgatlak — koppints a leállításhoz'
      : voice.state === 'transcribing' ? 'Leiratozom a felvételt…' : 'Hang · mondd el, mit ettél'

  return (
    <div className="fmx-voice">
      <button type="button" className={`fmx-mic glass${recording ? ' is-live' : ''}`}
        onClick={voice.toggle}
        disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
        aria-label={label} aria-pressed={recording}>
        <Icon3D name="t-mic" size={62} />
      </button>
      <p className="fmx-mode-hint">
        {voice.state === 'unsupported'
          ? 'Ez a böngésző nem tud hangot rögzíteni — gépeléssel vagy fotóval ugyanoda jutsz.'
          : recording ? 'Hallgatlak. Mondd el egy mondatban, mit ettél.'
            : voice.state === 'transcribing' ? 'Leiratozom, amit mondtál…'
              : 'Koppints, és mondd el egy mondatban. A leírt mondatot lent még átírhatod.'}
      </p>
      <VoiceBubble voice={voice} domain="fuel" />
    </div>
  )
}

/** A gépelés-fül: a composer ✨ szövegmezője ALATT nyílik (a lap nyitja ki), ez a fül maga a
 *  meghívó — nem egy második szövegmező, ami külön AI-hívóhelyet csinálna. */
function TextView() {
  return (
    <div className="fmx-typed">
      <p className="fmx-mode-hint">
        Írd le egy mondatban, mit ettél — lent a <Icon3D name="t-score" size={15} className="fmx-inline-ico" /> mezőben.
        Az AI tételekre bontja, te pedig átírhatod, mielőtt mentünk.
      </p>
    </div>
  )
}

function UsualView({ usuals, onUsual }: { usuals: UsualMeal[]; onUsual: (u: UsualMeal) => void }) {
  if (usuals.length === 0) {
    return (
      <p className="fmx-mode-empty uv-empty">
        Még tanulom, mit szoktál enni. Pár logolás után itt lesznek a szokásosaid — addig fotó,
        hang vagy gépelés.
      </p>
    )
  }
  return (
    <>
      <p className="fmx-mode-hint">Amihez ilyenkor a leggyakrabban nyúlsz — egy koppintás, aztán jóváhagyod.</p>
      <div className="fmx-usuals">
        {usuals.map(u => (
          <button key={u.key} type="button" className="fmx-usual glass" onClick={() => onUsual(u)}>
            <span className="fmx-usual-art uv-well" aria-hidden="true"><Icon3D name="t-plate" size={34} /></span>
            <span className="fmx-usual-copy">
              <strong>{u.title}</strong>
              <small>{usualHint(u)}</small>
            </span>
            {/* Őszinte-null: ismeretlen energia „—", nem becsült szám. */}
            <b>{u.kcal == null ? '—' : huInt(u.kcal)}{u.kcal != null && <small>kcal</small>}</b>
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * A felismerés kudarca (A4): saját állapot, nem hibajelzés. Nem találgat a user háta mögött,
 * és mindhárom másik utat felajánlja — ugyanoda vezetnek.
 */
function FailedView({ onMode }: { onMode: (m: LogMode) => void }) {
  return (
    <div className="fmx-failed uv-empty">
      <span className="fmx-failed-art" aria-hidden="true">
        <Icon3D name="t-camera" size={62} />
        <i>?</i>
      </span>
      <small>ŐSZINTÉN SZÓLVA</small>
      <strong>Ezt a tányért nem ismertem fel.</strong>
      <p>Nem találgatok a hátad mögött. Válassz egy másik utat — ugyanoda vezet.</p>
      <button type="button" className="fmx-failed-cta" onClick={() => onMode('text')}>Leírom szöveggel</button>
      <button type="button" className="fmx-failed-cta is-quiet" onClick={() => onMode('usual')}>
        A szokásosakból választok
      </button>
      <button type="button" className="fmx-failed-cta is-quiet" onClick={() => onMode('photo')}>Új fotót készítek</button>
    </div>
  )
}

export function FuelLogModes({ mode, onMode, onPhoto, onUsual, onTranscript, failed, usuals }: {
  mode: LogMode
  onMode: (m: LogMode) => void
  onPhoto: (file: File) => void
  onUsual: (u: UsualMeal) => void
  /** A6: a leiratozott mondat — a hívó adja a composer AI-szövegmezőjének (a héj nem ment). */
  onTranscript: (text: string) => void
  failed: boolean
  usuals: UsualMeal[]
}) {
  return (
    /* S1c.2 (mezo-33k6): a `log-forrasok` kalauz-horgony ITT ül, valahányszor a héj jelen van —
       a teljes oldalon EZ a „honnan adod hozzá" felület (a composer ✨ kártyája eltűnt alóla).
       A héj nélküli LogFlow-overlayben ugyanezt a nevet a composer forrás-sora viseli, tehát
       mindkét felületen pontosan egy elem hordozza, és a „Mutasd meg" sosem mutat a semmibe. */
    <div className="fmx-logmodes" data-kalauz-anchor="log-forrasok">
      <div className="fmx-modes glass" role="tablist" aria-label="Naplózási mód">
        {MODES.map(m => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
            className={`fmx-mode${mode === m.id ? ' is-active' : ''}`}
            style={{ '--c': m.color } as CSSProperties}
            onClick={() => onMode(m.id)}>
            <Icon3D name={m.icon} size={30} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      {failed
        ? <FailedView onMode={onMode} />
        : mode === 'photo' ? <PhotoView onPhoto={onPhoto} />
          : mode === 'voice' ? <VoiceView onTranscript={onTranscript} />
            : mode === 'text' ? <TextView />
              : <UsualView usuals={usuals} onUsual={onUsual} />}
    </div>
  )
}
