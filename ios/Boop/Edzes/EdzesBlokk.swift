import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The block's load (B5, round 3)

// The owner's verdict on the first attempt: *„az hogy a blokkban mi mekkora terhelést kap
// nagyon béna, muscle map kép hiányzik, nem mond nekem túl sokat, hogy a kockák épen mit
// mutatnak és mennyi sorozat van mikor"* — and he pointed at the web app's own week page
// (`/train/mesocycles/:id/week`), which is far richer.
//
// What made that page good, and what is rebuilt here:
//   • it **says the meaning first** — „Még 3 szett fér bele", not a square;
//   • a **body** where every muscle is filled to where it stands against its own ceiling;
//   • the week's total as **one big number**, with last week's as a sentence;
//   • the muscles **ranked by the room they still have**, because those are the ones worth
//     looking at;
//   • a bar whose rim is **this plan's ceiling**, with the lowest useful level marked in it;
//   • and a muscle opens **its own page**, where the weeks are finally labelled — which was
//     his other complaint: the squares never said which week or how many sets.
//
// The maths is `muscleBands` / `blockWeekSummary` (BoopCore), the same rules as the web
// page's. The words are not: „Hamstring", „Core" and „MV-n tart · nem rámpázik" are exactly
// the badly-translated vocabulary he asked us to drop.

/// What each muscle gets out of the running block.
struct BlockLoadPage: View {
    let block: BlockPlan
    let hue: Hue
    let age: String?
    let onBack: () -> Void
    @State private var muscle: MuscleBand?

    private var bands: [MuscleBand] { muscleBands(block) }

    #if DEBUG
    /// `-previewMezo muscle`: the first muscle's page opens on its own.
    private var previewMuscle: Bool { UserDefaults.standard.string(forKey: "previewMezo") == "muscle" }
    #endif

    var body: some View {
        let summary = blockWeekSummary(bands)
        NKAreaSubPage(hue: hue, crumb: "Edzés · Mezociklus", eyebrow: "A mezociklus terhelése · \(block.currentWeek). hét",
                      title: "\(summary.muscles) izomcsoportot edzel ezen a héten",
                      sentence: "\(summary.stateLine) \(summary.deltaLine)".trimmingCharacters(in: .whitespaces),
                      onBack: onBack) {
            thisWeek(summary)
            perMuscle
            NKNote("A sáv azt mutatja, hol tartasz ahhoz képest, ameddig ebben a tervben elmész ezzel az izommal. A vonal benne az a szint, ami alatt már nem fejlődik. Koppints egy izomra, ha érdekel, mikor mennyit kap.", hue: hue)
        }
        .fullScreenCover(item: $muscle) { band in
            MuscleWeeksPage(band: band, block: block, hue: hue) { muscle = nil }
        }
        #if DEBUG
        .task { if previewMuscle { muscle = bands.first } }
        #endif
    }

    /// The week in one picture (Edzés redesign, spec 2026-11-27 §5.4, mezo-r36n9.197.4): the hero — the total and
    /// the body filled muscle by muscle, then the hardest-worked muscles as bars.
    private func thisWeek(_ summary: BlockWeekSummary) -> some View {
        MezoPageHero(label: "Ezen a héten", hue: hue,
                     trailing: age.map { AnyView(Text($0).nkFont(12).foregroundStyle(.white.opacity(0.5))) }) {
            HStack(alignment: .center, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(summary.total)")
                        .nkFont(52, .medium)
                        .foregroundStyle(hue.glow)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                    Text("szett ezen a héten")
                        .nkFont(13).foregroundStyle(.white.opacity(0.6))
                        .fixedSize(horizontal: false, vertical: true)
                    if let previous = summary.previous {
                        Text("múlt héten \(previous)")
                            .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                            .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                NKBodyMap(bands.map { NKBodyHeat(muscle: $0.muscle, level: $0.level) }, hue: hue, views: .both)
                    .frame(maxHeight: 170)
                    .accessibilityHidden(true)
            }
            EdzesMuscleBars(bands: bands, hue: hue)
        }
    }

    /// One row per muscle, the ones with room first — all inside one card.
    private var perMuscle: some View {
        NKSectionCard("Izmonként · ahol a legtöbb hely van, elöl", hue: hue) {
            VStack(spacing: 0) {
                ForEach(Array(bands.enumerated()), id: \.element.id) { i, band in
                    if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    Button { muscle = band } label: { MuscleBandRow(band: band, hue: hue) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

/// One muscle this week: what it is for in this block, what that means in a sentence, how
/// full it is against its own ceiling, and the number behind it.
private struct MuscleBandRow: View {
    let band: MuscleBand
    let hue: Hue

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            if NKBodyMark.canDraw(band.muscle) {
                NKBodyMark(muscle: band.muscle, hue: hue, height: 46)
                    .frame(width: 30)
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(muscleName(band.muscle).capitalizedFirst)
                        .nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                    Text(band.tier.hungarian.uppercased())
                        .nkFont(9, .semibold, design: .monospaced).tracking(1)
                        .foregroundStyle(tierColor)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Capsule().fill(tierColor.opacity(0.16)))
                }
                Text(band.verdict).nkFont(13).foregroundStyle(.white.opacity(0.62))
                NKLevelBar(level: band.level, hue: hue, ticks: ticks)
            }
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(band.current)").nkFont(21, .medium).foregroundStyle(.white)
                Text("szett").nkFont(11).foregroundStyle(.white.opacity(0.45))
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.35))
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(muscleName(band.muscle)), \(band.tier.hungarian), \(band.current) szett. \(band.verdict)")
    }

    /// The lowest useful level, marked inside the vessel — only when it is actually below the
    /// rim, because a mark sitting on the rim says nothing.
    private var ticks: [NKLevelTick] {
        guard band.ceiling > 0, band.mev > 0, band.mev < band.ceiling else { return [] }
        return [NKLevelTick(at: Double(band.mev) / Double(band.ceiling), label: "")]
    }

    private var tierColor: Color {
        switch band.tier {
        case .emphasize: hue.glow
        case .grow: Color(hex: 0x9FD8A8)
        case .maintain: .white.opacity(0.55)
        }
    }
}

// MARK: - One muscle, week by week

/// The page his other complaint asked for: *which* week, and *how many sets* — written down,
/// not left to a square.
private struct MuscleWeeksPage: View {
    let band: MuscleBand
    let block: BlockPlan
    let hue: Hue
    let onBack: () -> Void

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés · A mezociklus terhelése",
                      eyebrow: "\(muscleName(band.muscle)) · \(band.tier.hungarian.lowercased())",
                      title: muscleName(band.muscle).capitalizedFirst,
                      sentence: sentence, onBack: onBack) {
            // Edzés redesign (spec 2026-11-27 §5.4, mezo-r36n9.197.4): the hero is this muscle's weeks as a chart,
            // then its limits and where it is; the week-by-week rows keep every number in one card.
            MezoPageHero(label: "Hetenként", hue: hue) {
                MuscleWeeksChart(band: band, hue: hue)
            }
            NKSectionCard("A határai", hue: hue) {
                NKStatRow([
                    NKStat(value: "\(band.mev)", unit: "szett", label: "ennyitől fejlődik"),
                    NKStat(value: "\(band.ceiling)", unit: "szett", label: "eddig megy ez a terv", hot: true),
                    NKStat(value: "\(band.mrv)", unit: "szett", label: "ennyit bír el"),
                ], hue: hue)
            }
            if NKBodyMark.canDraw(band.muscle) {
                NKSectionCard("Hol van", hue: hue) {
                    NKBodyMap([NKBodyHeat(muscle: band.muscle, level: 1)], hue: hue)
                        .frame(maxHeight: 200)
                        .frame(maxWidth: .infinity)
                        .accessibilityHidden(true)
                }
            }
            NKSectionCard("Hétről hétre", hue: hue) {
                VStack(spacing: 0) {
                    ForEach(Array(band.weeks.enumerated()), id: \.element.week) { i, week in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        WeekRow(week: week, band: band, hue: hue)
                    }
                }
            }
            NKNote(note, hue: hue)
        }
    }

    private var sentence: String {
        let tierLine = switch band.tier {
        case .emphasize: "Ez egy kiemelt izom ebben a mezociklusban: a terv a legtöbbig viszi."
        case .grow: "Ezt építi a terv."
        case .maintain: "Ezt a terv most csak szinten tartja."
        }
        return "\(tierLine) \(band.verdict)"
    }

    private var note: String {
        band.step > 0
            ? "Hétfőtől \(band.step) szettel többet kap, ha a hét jól megy."
            : "Hétfőtől ugyanennyit kap — ebben a tervben ez a felső értéke."
    }
}

/// One muscle's weeks as bars: the plan faint, what was done lit, the current week glowing, against the muscle's own
/// limit (`mrv`) so the bars read the same as the rows below.
struct MuscleWeeksChart: View {
    let band: MuscleBand
    let hue: Hue

    var body: some View {
        let top = Double(max(1, band.mrv, band.weeks.map { max($0.planned, $0.actual ?? 0) }.max() ?? 1))
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(band.weeks, id: \.week) { w in
                    VStack(spacing: 6) {
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 6).fill(.white.opacity(w.isCurrent ? 0.18 : 0.10))
                                .frame(height: max(6, CGFloat(Double(w.planned) / top) * 96))
                            if let actual = w.actual {
                                RoundedRectangle(cornerRadius: 6).fill(hue.glow.opacity(w.isCurrent ? 1 : 0.75))
                                    .frame(height: CGFloat(Double(actual) / top) * 96)
                            }
                        }
                        .frame(height: 96, alignment: .bottom)
                        .shadow(color: w.isCurrent ? hue.glow.opacity(0.5) : .clear, radius: 8)
                        Text("\(w.week)").nkFont(11.5, w.isCurrent ? .semibold : .regular, design: .monospaced)
                            .foregroundStyle(.white.opacity(w.isCurrent ? 0.95 : 0.5))
                            .lineLimit(1).fixedSize()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Self.accessibilityText(band.weeks))
            HStack(spacing: 14) {
                legend(hue.glow, "megcsinált szett")
                legend(.white.opacity(0.18), "terv")
            }
            .accessibilityHidden(true)
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 12, height: 12)
            Text(text).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
    }

    /// What VoiceOver reads for the chart: where the current week stands.
    static func accessibilityText(_ weeks: [MuscleVolumeWeek]) -> String {
        guard let c = weeks.first(where: \.isCurrent) else { return "\(weeks.count) hét szettjei" }
        let done = c.actual.map { "\($0) megvolt a tervezett \(c.planned)-\(evesBolBol(c.planned))" } ?? "\(c.planned) tervezett"
        return "\(weeks.count) hét szettjei; a \(c.week). héten \(done)"
    }
}

/// One week of one muscle: the week number, what was planned, and what was actually done.
private struct WeekRow: View {
    let week: MuscleVolumeWeek
    let band: MuscleBand
    let hue: Hue

    var body: some View {
        HStack(spacing: 12) {
            Text("\(week.week). hét")
                .nkFont(13, week.isCurrent ? .semibold : .regular, design: .monospaced)
                .foregroundStyle(week.isCurrent ? hue.glow : .white.opacity(0.55))
                .frame(width: 58, alignment: .leading)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(phaseWord)
                        .nkFont(11, design: .monospaced)
                        .foregroundStyle(.white.opacity(0.45))
                    if week.isCurrent {
                        Text("MOST").nkFont(9, .semibold, design: .monospaced).tracking(1)
                            .foregroundStyle(NK.ground)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Capsule().fill(hue.glow))
                    }
                }
                NKLevelBar(level: Double(week.planned) / Double(max(1, band.mrv)), hue: hue)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 1) {
                Text(value).nkFont(15, .medium).foregroundStyle(.white.opacity(0.92))
                Text(valueLabel).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(week.week). hét, \(phaseWord), \(value) \(valueLabel)")
    }

    private var phaseWord: String { week.phase.hungarian.lowercased() }

    /// What actually happened, when it has happened: „14 / 16". A week still to come shows
    /// only what is planned — there is no second number to show yet, and a 0 would be a lie.
    private var value: String {
        guard let actual = week.actual else { return "\(week.planned)" }
        return "\(actual) / \(week.planned)"
    }

    private var valueLabel: String { week.actual == nil ? "tervezett" : "megvolt / terv" }
}

extension String {
    /// „hát" → „Hát", without touching the rest of the word.
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}
