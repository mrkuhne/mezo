// Layout-aware loading skeleton for TrainTodayPage (mezo-f2z). Mirrors the real
// Mai shape — DayStrip (7 cells) → the frameless gym hero (status pill / big art /
// eyebrow / big title / sub-line / muscle chips / fact pills / the glass CTA row) → the
// energy card → the muscle-impact card → the „Vagy inkább" pair — so the swap to real
// content does not reflow. The weekly timeline it used to mirror moved to Heti
// (mezo-9bbc), and TrainWeekSkeleton mirrors it there.
// ÜVEG (mezo-me75u.4): sizes track the glass geometry of the `.trm` block in prototype.css
// (`uveg edzes mai`); the placeholders sit on the same `.trm-sec` rail as the real sections.
import { Skeleton } from '@/shared/ui/Skeleton'

export default function TrainTodaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" className="trm trm-sk">
      {/* DayStrip — 7 flat cells in one row (`.trm-daystrip`: a 7-column grid, cell 62px
          tall, radius 15), so the navigator does not pop in. */}
      <div className="trm-daystrip">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="trm-sk-day" width="100%" height={62} radius={15} />
        ))}
      </div>
      {/* The frameless hero — centred: status pill, 98px art, eyebrow, 38px title, sub-line,
          the muscle-chip row, the fact pills, then the glass CTA row. */}
      <div className="trm-sk-hero">
        <Skeleton width={110} height={22} radius={999} />
        <Skeleton width={98} height={98} radius={30} />
        <Skeleton width="46%" height={11} />
        <Skeleton width="58%" height={38} />
        <Skeleton width="44%" height={13} />
        <div className="trm-sk-row">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width={28} height={28} radius={999} />
          ))}
        </div>
        <div className="trm-sk-row">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width={78} height={30} radius={999} />
          ))}
        </div>
        {/* the glass CTA row (`.trm-start`) — padding 12px + the 46px art + 12px = 70px. */}
        <Skeleton width="100%" height={70} radius={22} />
      </div>
      {/* The energy card (`.trm-energy`, glass):
            padding 15 + 15                                    = 30
          + `.trm-chead` (the 40px flame, the tallest cell)      = 40
          + `.trm-energy-main` (margin-top 8, 46px numeral)      = 54
          + `.trm-esplit` (margin 10/0/8, 8px bar)               = 26
          + `.trm-energy-split` (one 11.5px line ≈ 16)           = 16
          + `.trm-energy-note` (margin-top 10, 11px ≈ 16)        = 26
          ─────────────────────────────────────────────────────────────
                                                          total ≈ 192px */}
      <div className="trm-sec">
        <Skeleton width="100%" height={192} radius={22} />
      </div>
      {/* The muscle-impact card (`.trm-mus`, glass). `dayImpact` always surfaces the four
          big families at minimum, so 4 rows is the reserved count:
            padding 15 + 15                                    = 30
          + `.trm-chead`                                         = 40
          + 4× `.trm-mus-row` (margin-top 10 + the 28px well)    = 152
          + `.trm-mus-note` (margin-top 10, two 11px lines ≈ 32) = 42
          ─────────────────────────────────────────────────────────────
                                                          total ≈ 264px */}
      <div className="trm-sec">
        <Skeleton width="100%" height={264} radius={22} />
      </div>
      {/* the „Vagy inkább" pair (`.trm-alt`) — padding 13 + 13, the 44px art, the eyebrow
          and the title with their 6px gaps ≈ 110px each. */}
      <div className="trm-sec">
        <div className="trm-alt">
          <Skeleton width="100%" height={110} radius={20} />
          <Skeleton width="100%" height={110} radius={20} />
        </div>
      </div>
    </div>
  )
}
