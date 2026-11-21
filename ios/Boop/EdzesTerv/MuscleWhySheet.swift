import SwiftUI
import BoopCore
import BoopDesign

// The per-muscle „miért?" sheet (mezo-r36n9.113, spike screen 4): the dial, the band and where the week's sets sit,
// a warning when the muscle is trained heavy two days running, and why the band is what it is — the boxes follow the
// server's `basis.source`; a source this build does not know shows only the first box.

struct MuscleWhySheet: View {
    let muscle: WireMuscleEvaluation
    let tier: MuscleTier
    /// dayIndex → the day's long name („Hétfő"), and its weekday (0 = Monday) for the sentence.
    let dayName: (Int) -> String?
    let weekday: (Int) -> Int?

    private var inside: Bool { muscle.fit == "inside" }
    private var source: String? { muscle.basis?.source }
    private var known: Bool { ["landmarks_rp", "maintain_third", "sport_adjusted"].contains(source ?? "") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline) {
                    Text(SubMuscles.groupName(muscle.muscle)).nkFont(30, design: .serif).foregroundStyle(.white)
                    Spacer()
                    PlanTierPill(tier: tier)
                }
                PlanArcGauge(value: muscle.weeklySets, band: muscle.band, inside: inside)
                    .frame(height: 124)
                    .overlay(alignment: .bottom) {
                        VStack(spacing: 0) {
                            Text("\(muscle.weeklySets)").nkFont(44, .medium).foregroundStyle(.white)
                            Text("sorozat hetente").nkFont(11).foregroundStyle(.white.opacity(0.5))
                        }
                        .accessibilityHidden(true)
                    }
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    PlanPill("Sáv \(muscle.band.low)–\(muscle.band.high)", color: planTierColor(tier == .maintain ? .grow : tier), mark: .target)
                    ForEach(muscle.spread.filter { $0.sets > 0 }, id: \.dayIndex) { s in
                        if let name = dayName(s.dayIndex) { PlanPill("\(name) \(s.sets)", mark: .calendar) }
                    }
                    if muscle.band.sportAdjusted { PlanPill("a sport miatt lejjebb", color: planWarn, mark: .spark) }
                }

                ForEach(Array((muscle.consecutiveHeavy ?? []).enumerated()), id: \.offset) { _, c in
                    if let hint = hint(c) {
                        HStack(alignment: .top, spacing: 10) {
                            PlanMark(.flame, color: planWarn, size: 18).padding(.top, 1)
                            Text(hint).nkFont(13.5).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                    }
                }

                box("Mi ez a sáv",
                    "Az a heti kemény sorozatszám, amitől ez az izom még nő, és amit még jól kipihensz. \(muscle.band.low) alatt lassabban fejlődik, \(muscle.band.high) fölött már inkább csak fáraszt.")
                if known {
                    box("Honnan jön",
                        "Kutatások szerint edzett embereknél izmonként heti 12–20 kemény sorozat jó tartomány: több sorozat több növekedést hoz, egy határig. A te sávod ebből a becslésből jön; Hangsúly szinten a felső részéhez közelítünk."
                        + (source == "sport_adjusted" ? " A sport is terheli ezt az izmot, ezért a sávja lejjebb van." : ""))
                    box("És a Tartás",
                        "Ahol egy izom csak Tartást kap, ott a növelő adag nagyjából harmada is megtartja a méretét. Ezért egyik izom sem megy le nullára, akkor sem, ha épp nincs fókuszban.")
                    Text("Forrás: összefoglaló kutatások a heti sorozatszám és az izomnövekedés kapcsolatáról (2017, 2022), és a megtartó edzésről (2011).")
                        .nkFont(11.5).foregroundStyle(.white.opacity(0.42)).fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 2)
                }
            }
            .padding(.horizontal, 22).padding(.top, 28).padding(.bottom, 30)
        }
        .scrollIndicators(.hidden)
        .preferredColorScheme(.dark)
    }

    /// „A hát két egymást követő napon kap nehéz adagot: hétfőn 7, kedden 4 kemény sorozatot."
    private func hint(_ c: WireConsecutive) -> String? {
        guard let a = weekday(c.dayIndex), let b = weekday(c.nextDayIndex) else { return nil }
        let name = SubMuscles.groupName(muscle.muscle).lowercased()
        let article = "aáeéiíoóöőuúüű".contains(name.first ?? "x") ? "Az" : "A"
        return "\(article) \(name) két egymást követő napon kap nehéz adagot: \(planWeekdayOn(a)) \(c.sets), \(planWeekdayOn(b)) \(c.nextSets) kemény sorozatot. Ha az egyik napról egy gyakorlatot máshová teszel, rendben lesz."
    }

    private func box(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
            Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
    }
}
