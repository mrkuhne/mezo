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

    var body: some View {
        let summary = blockWeekSummary(bands)
        NKAreaSubPage(hue: hue, crumb: "Edzés · Blokk", eyebrow: "A blokk terhelése · \(block.currentWeek). hét",
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
    }

    /// The week in one picture: the total, and the body filled muscle by muscle.
    private func thisWeek(_ summary: BlockWeekSummary) -> some View {
        NKBare("EZEN A HÉTEN", hue: hue, trailing: age) {
            HStack(alignment: .center, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(summary.total)")
                        .nkFont(52, .medium)
                        .foregroundStyle(hue.glow)
                    Text("szett ezen a héten")
                        .nkFont(13).foregroundStyle(.white.opacity(0.6))
                    if let previous = summary.previous {
                        Text("múlt héten \(previous)")
                            .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                            .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                NKBodyMap(bands.map { NKBodyHeat(muscle: $0.muscle, level: $0.level) }, hue: hue, views: .both)
                    .frame(maxHeight: 190)
            }
        }
    }

    /// One row per muscle, the ones with room first.
    private var perMuscle: some View {
        NKBare("IZMONKÉNT · AHOL A LEGTÖBB HELY VAN, ELÖL", hue: hue) {
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
        NKAreaSubPage(hue: hue, crumb: "Edzés · A blokk terhelése",
                      eyebrow: "\(muscleName(band.muscle)) · \(band.tier.hungarian.lowercased())",
                      title: muscleName(band.muscle).capitalizedFirst,
                      sentence: sentence, onBack: onBack) {
            NKBare("HETENKÉNT", hue: hue) {
                VStack(spacing: 0) {
                    ForEach(Array(band.weeks.enumerated()), id: \.element.week) { i, week in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        WeekRow(week: week, band: band, hue: hue)
                    }
                }
            }
            NKBare("A HATÁRAI", hue: hue) {
                NKStatRow([
                    NKStat(value: "\(band.mev)", unit: "szett", label: "ennyitől fejlődik"),
                    NKStat(value: "\(band.ceiling)", unit: "szett", label: "eddig megy ez a terv", hot: true),
                    NKStat(value: "\(band.mrv)", unit: "szett", label: "ennyit bír el"),
                ], hue: hue)
            }
            if NKBodyMark.canDraw(band.muscle) {
                NKBare("HOL VAN", hue: hue) {
                    NKBodyMap([NKBodyHeat(muscle: band.muscle, level: 1)], hue: hue)
                        .frame(maxHeight: 200)
                        .frame(maxWidth: .infinity)
                }
            }
            NKNote(note, hue: hue)
        }
    }

    private var sentence: String {
        let tierLine = switch band.tier {
        case .emphasize: "Ez egy kiemelt izom ebben a blokkban: a terv a legtöbbig viszi."
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
