// ============================================================
// Mezo · DaypartTabs — a Mai lap napszak-váltója (mezo-e26w). A három külön
// keretes pirula (`.segtabs`) helyére EGY vályú + egy csúszó bélyeg lép, az
// iOS szegmentált kontroll nyelvén. Két független jel, sosem összemosva:
// a NYOMOTT szegmens az, amit nézel (`selected`, a `?dp=`-ből derivált), az
// arany pötty pedig az, hol jár az óra (`current`) — a DayFaceStrip dual-signal
// öröksége. Prezentációs: nem birtokol state-et és nem olvas hookot.
// ============================================================
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

export interface DaypartTabsProps {
  /** Amit a képernyő mutat — a `?dp=`-ből, az órára visszaesve. */
  selected: DayFace
  /** Hol jár az óra — a kiválasztástól FÜGGETLENÜL jelölve. */
  current: DayFace
  onSelect: (face: DayFace) => void
}

export function DaypartTabs({ selected, current, onSelect }: DaypartTabsProps) {
  return (
    <div className="daytabs td-segwrap">
      <div className="td-seg" role="group" aria-label="Napszak">
        {DAY_FACES.map((face) => (
          <button
            key={face}
            type="button"
            className="np-press"
            aria-pressed={face === selected}
            onClick={() => onSelect(face)}
          >
            <em aria-hidden="true">{FACE_EMOJI[face]}</em> {FACE_LABEL[face]}
            {face === current && <span className="td-now" role="img" aria-label="most" />}
          </button>
        ))}
      </div>
    </div>
  )
}
