// ============================================================
// Mezo · Karakter — DetektorokPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-detektorok` (`DETECTOR_CATALOG`
// render) for the layout (a sage `leltarcard`, one row per detector: the one-line semantic +
// a ghost detector-key chip + the owning expert's name in their domain color) and the closing
// principle line, verbatim.
//
// CONTENT DEVIATES FROM THE PROTOTYPE'S DATA where the prototype's design-time guess about a
// detector's owning expert doesn't match what the real, shipped code actually does — this page
// lists the 32 REAL detectors (`backend/.../feature/character/detector/*Detector.java`,
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
//
// The seven round-2 detectors (mezo-1gim.15, Task 6) — comfort-eating, macro-adherence,
// hydration-consistency, protein-training-mismatch (all `taplalkozo`), late-eating-pattern
// (`szomnologus`), stack-skip-pattern (`drill`), med-cycle-covariance (`doki`) — are appended
// below in that order, `who` verified the same way against
// `backend/.../feature/character/detector/{ComfortEating,MacroAdherence,HydrationConsistency,
// ProteinTrainingMismatch,LateEatingPattern,StackSkipPattern,MedCycleCovariance}Detector.java`'s
// own `DetectorSignal(key(), who, ...)` calls. The catalog is now 20 detectors.
//
// The twelve round-3 detectors (mezo-1gim.15, Task 7) — self-calibration, decision-profile,
// streak-break-response, needs-domain-imbalance (all `pszichologus`), promise-vs-delivery,
// decision-review-backlog, restart-pattern, retro-logging-ratio, checkin-latency,
// checkin-slot-drift (all `drill`), gratitude-focus (`antropologus`), night-activity
// (`szomnologus`) — are appended below in that order, `who` verified the same way against
// `backend/.../feature/character/detector/{SelfCalibration,PromiseVsDelivery,DecisionProfile,
// DecisionReviewBacklog,GratitudeFocus,StreakBreakResponse,RestartPattern,RetroLoggingRatio,
// NightActivity,CheckinLatency,CheckinSlotDrift,NeedsDomainImbalance}Detector.java`'s own
// `DetectorSignal(key(), who, ...)` calls. The catalog is now 32 detectors.
//
// Round 4 (mezo-1gim.15, Task 8): the eight round-4 detectors — people-mood-link,
// mention-context-shift, weekend-gap (all `antropologus`), chat-topic-shift (`pszichologus`),
// knowledge-rejection-pattern, prediction-calibration, quest-completion-calibration,
// experiment-outcome-ledger (all `szkeptikus`) — are appended below in that order, `who` verified
// the same way against `backend/.../feature/character/detector/{PeopleMoodLink,
// MentionContextShift,WeekendGap,ChatTopicShift,KnowledgeRejectionPattern,PredictionCalibration,
// QuestCompletionCalibration,ExperimentOutcomeLedger}Detector.java`'s own
// `DetectorSignal(key(), who, ...)` calls. The catalog is now 40 detectors.
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

/** The 40 real detectors — key/who verified against the detector source (see header comment),
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
  { key: 'comfort-eating', who: 'taplalkozo', line: 'Rossz közérzetű napokon megugrik-e a bevitel — a feldolgozott étel aránya vagy a napi kalória, saját 8 hetes átlaghoz mérve.' },
  { key: 'macro-adherence', who: 'taplalkozo', line: 'A kalória- vagy fehérje-cél szisztematikus alul-/túllövése a valós napi célhoz képest.' },
  { key: 'hydration-consistency', who: 'taplalkozo', line: 'A napi vízcél 90%-át elérő napok aránya — csak sávváltáskor szólal meg.' },
  { key: 'protein-training-mismatch', who: 'taplalkozo', line: 'A fehérje pont az edzésnapokon marad-e el, az edzés nélküli napokhoz képest.' },
  { key: 'late-eating-pattern', who: 'szomnologus', line: 'Késő esti nagyobb étkezés után rosszabb-e az azt követő éjszaka.' },
  { key: 'stack-skip-pattern', who: 'drill', line: 'Ismétlődő kiegészítő-kihagyások — a pihenőnapi elhagyás és a felvétel előtti napok nem számítanak kihagyásnak.' },
  { key: 'med-cycle-covariance', who: 'doki', line: 'A check-in skálák ciklusnap szerinti eltérése a ciklus átlagától — érzékeny, leíró jel.' },
  { key: 'self-calibration', who: 'pszichologus', line: 'Együtt mozog-e az önértékelés a mérhető párjával: energia × előző éjszakai alvás, testi × ízületi terheltség. A mentális és a stressz skála kimarad — nincs objektív párjuk.' },
  { key: 'promise-vs-delivery', who: 'drill', line: 'A reggel kitűzött fókuszok és az esti napzárás viszonya — külön a lezárás aránya és a lezárt napok teljesülése.' },
  { key: 'decision-profile', who: 'pszichologus', line: 'A visszanézett döntések 1–5 kimenet-értékelése hat hét alatt; a döntés szövege példaként megy át, elemzés nélkül.' },
  { key: 'decision-review-backlog', who: 'drill', line: 'Hány döntés lépte túl a saját visszanézési határidejét anélkül, hogy átnézték volna.' },
  { key: 'gratitude-focus', who: 'antropologus', line: 'Melyik életterületre húznak a hála-bejegyzések négy hét alatt — a zárt címke alapján, sosem a szövegből.' },
  { key: 'streak-break-response', who: 'pszichologus', line: 'A legutóbbi megszakadt Életjel-sorozat utáni három nap: kaszkádol vagy visszaáll.' },
  { key: 'restart-pattern', who: 'drill', line: 'Mennyi idő telt el a megszakadás és az első újra teljes nap között. A sávok bevallottan heurisztikák — a szakirodalomban nincs validált vágópont.' },
  { key: 'retro-logging-ratio', who: 'drill', line: 'Aznap vagy utólag rögzít — az esemény- és a naplózó bejegyzések külön. Arról szól, mikor íródtak, nem arról, hogy pontosak-e.' },
  { key: 'night-activity', who: 'szomnologus', line: 'Hány napon írt éjfél és hajnali öt között a társnak. Ez a chat használatát bizonyítja, nem az ébrenlét teljes képét.' },
  { key: 'checkin-latency', who: 'drill', line: 'Mennyivel a saját idősávja után készül el a check-in (a soron tárolt idősáv és az első írás között).' },
  { key: 'checkin-slot-drift', who: 'drill', line: 'Melyik korábban rendszeres check-in idősáv kopott ki az elmúlt két hétben.' },
  { key: 'needs-domain-imbalance', who: 'pszichologus', line: 'Melyik Életjel-terület marad tartósan a többi mögött — a kontraszt a jel, nem az alacsony szint önmagában.' },
  { key: 'people-mood-link', who: 'antropologus', line: 'A mentális check-in máshol áll-e azokon a napokon, amikor embert említesz — együttjárás, nem irány, és sosem nevez embert.' },
  { key: 'mention-context-shift', who: 'antropologus', line: 'Milyen kontextusban kerülnek elő az emberek (a rendszer éjszakai címkéi), és nő-e a konfliktus-részarány.' },
  { key: 'weekend-gap', who: 'antropologus', line: 'Hétvégi alvásközép-eltolás (Roenneberg social jetlag, 1 h / 2 h sávok) és hétvégi logolás-rés. Hétvége = szombat–vasárnap.' },
  { key: 'chat-topic-shift', who: 'pszichologus', line: 'Melyik domén körül forognak a beszélgetéseid a társsal — a lekért eszközökből, a szöveg olvasása nélkül.' },
  { key: 'knowledge-rejection-pattern', who: 'szkeptikus', line: 'A javasolt tények és minták mekkora része maradt meg — a rendszer találati aránya, nem a te tulajdonságod. ÉRZÉKENY.' },
  { key: 'prediction-calibration', who: 'szkeptikus', line: 'A zárult predikciók találati aránya a kimondott magabiztossághoz képest: túlbiztos, alulbiztos vagy kalibrált volt a társ.' },
  { key: 'quest-completion-calibration', who: 'szkeptikus', line: 'Slotonkénti quest-teljesítés a motor saját sávjaihoz (85% / 50%) képest — a nehézség-kalibráció, a szöveg soha.' },
  { key: 'experiment-outcome-ledger', who: 'szkeptikus', line: 'Hány javasolt kísérlet és kihívás zárult jó kimenettel, és hány nem indult el (elvetve indulás előtt).' },
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
