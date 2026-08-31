// ============================================================
// Mezo · Karakter — DetektorokPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-detektorok` (`DETECTOR_CATALOG`
// render) for the layout (a sage `leltarcard`, one row per detector: the one-line semantic +
// a ghost detector-key chip + the owning expert's name in their domain color) and the closing
// principle line, verbatim.
//
// CONTENT DEVIATES FROM THE PROTOTYPE'S DATA where the prototype's design-time guess about a
// detector's owning expert doesn't match what the real, shipped code actually does — this page
// lists the 13 REAL detectors (`backend/.../feature/character/detector/*Detector.java`,
// `DetectorRegistry`-discovered), and the "who" here is each detector's REAL
// `DetectorSignal(key, who, ...)` expert argument, not the prototype's `DETECTOR_CATALOG.who`.
// Two of the original five differ: `logging-gap` is really owned by `drill` (not the
// prototype's `taplalkozo` guess), and `journal-silence` is really owned by `drill` too (not the
// prototype's `pszichologus` guess — `journal-note`, the OTHER journal detector, is the one
// that's really `pszichologus`-owned). Verified against the detector source directly, not
// copied from the prototype's array.
//
// The eight round-1 detectors (mezo-1gim.15, Task 5) — rir-calibration, niggle-map,
// sport-interference, meso-adherence, progression-adherence (all `edzo`), hr-recovery-trend
// (`doki`), sleep-performance-chain (`szomnologus`), avoidance-pattern (`drill`) — are appended
// below in that order, `who` verified the same way against
// `backend/.../feature/character/detector/{RirCalibration,NiggleMap,SportInterference,
// MesoAdherence,ProgressionAdherence,HrRecoveryTrend,SleepPerformanceChain,AvoidancePattern}
// Detector.java`'s own `DetectorSignal(key(), who, ...)` calls.
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { useCharacterExperts } from '@/data/hooks'
import { expertColor } from '@/features/character/expertColors'

interface DetectorEntry {
  key: string
  who: string
  line: string
}

/** The 13 real detectors — key/who verified against the detector source (see header comment),
 *  one-line semantics paraphrasing what each `detect()` actually checks. */
export const DETECTORS: DetectorEntry[] = [
  { key: 'logging-gap', who: 'drill', line: 'N napja nincs étkezés logolva (2+ egymást követő nap, 14 napos honest cap) — hiányzó kaja-napló jelzés.' },
  { key: 'under-logging', who: 'taplalkozo', line: 'A héten 3+ nap kaja-log nélkül, miközben a súlytrend emelkedik — negatív, tükröző jel.' },
  { key: 'checkin-gap', who: 'drill', line: 'Ma nincs check-in, miközben a heti átlag aktív szokást mutat.' },
  { key: 'journal-silence', who: 'drill', line: '7 napja nincs naplóbejegyzés — csend a naplóban.' },
  { key: 'journal-note', who: 'pszichologus', line: 'Friss naplóbejegyzés érkezett — a hangnem/tartalom felszínre kerül (max 500 karakter).' },
  { key: 'rir-calibration', who: 'edzo', line: 'Szettpárokon nézi: a mondott RIR megjósolja-e a következő szettet — az irányt is jelzi.' },
  { key: 'niggle-map', who: 'edzo', line: 'Ismétlődő ízület-jelzés ugyanannál a gyakorlatnál, vagy váll-terhelés sorozat a sportnapokon.' },
  { key: 'sport-interference', who: 'edzo', line: 'Nagy terhelésű sportnap után visszaesik-e a másnapi gym-teljesítmény.' },
  { key: 'meso-adherence', who: 'edzo', line: 'Kihagyott edzésnapok a heti terv ellen — deload-héten nem riaszt.' },
  { key: 'progression-adherence', who: 'edzo', line: 'A beírt súly szisztematikusan alá- vagy túllövi-e a targetet.' },
  { key: 'hr-recovery-trend', who: 'doki', line: '8 hetes pulzus-megnyugvás trend — csak sávváltáskor szólal meg.' },
  { key: 'sleep-performance-chain', who: 'szomnologus', line: 'Rossz alvás utáni napokon visszaesik-e az edzés-teljesítmény.' },
  { key: 'avoidance-pattern', who: 'drill', line: 'Ugyanannál a gyakorlatnál ismétlődő szett-kihagyások.' },
]

const PRINCIPLE = 'A kód csak észlel — az értelmezés mindig az adott szakértő LLM-hívása. '
  + 'Egy detektor sosem ítél, csak jelez.'

export function DetektorokPage() {
  const navigate = useNavigate()
  const { experts, isLoading } = useCharacterExperts()

  if (isLoading) return null

  const expertName = (key: string) => experts.find((e) => e.key === key)?.displayName ?? key

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter/gepterem')} label="‹ Gépterem" />
      <PageHero name="Detektorok" sub="a ma aktív katalógus, egy mondatban" />
      <PageBody principle={PRINCIPLE}>
        <div className="kr-leltarcard sage">
          {DETECTORS.map((d) => (
            <div className="kr-lrow" key={d.key}>
              <div className="kr-lw">{d.line}</div>
              <div className="kr-rmeta col">
                <span className="kr-detchip ghost">{d.key}</span>
                <small style={{ color: expertColor(d.who) }}>{expertName(d.who)}</small>
              </div>
            </div>
          ))}
        </div>
      </PageBody>
    </div>
  )
}
