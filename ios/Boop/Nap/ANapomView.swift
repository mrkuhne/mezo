import SwiftUI
import BoopCore
import BoopDesign

/// The whole day's stations as quiet one-line rows (spec §5.2: no cards hang off the A napom path).
func quietStations(_ steps: [PathStep]) -> [PathStation] {
    steps.map { PathStation(id: $0.id, time: $0.time, glyph: $0.glyph, title: $0.title, sub: $0.sub,
                            done: $0.done, isNow: $0.isNow, opens: false) }
}

// MARK: - Nap · A napom (spec §5.2, spike AuraSunrise `AuraNapTab` + AuraPath mode -1)

/// A shorter painted head (330 pt) with the title row and tabs, a serif "A napom" and the day's line, then the whole
/// day's path lit up to MOST. `header` is the same title row and tab strip the Mai hero uses.
struct ANapomView<Header: View>: View {
    let brief: Brief
    @ViewBuilder let header: Header

    var body: some View {
        // Evening paths arrive with Task 14.
        let stations = quietStations(PathBuilder.steps(for: nil, brief: brief, now: Date(), evening: false))
        NKTabPage(hue: .mozgas, heroHeight: 330, compact: nil) {
            VStack(spacing: 0) {
                header
                VStack(spacing: 6) {
                    Text("A napom").nkFont(38, design: .serif).foregroundStyle(.white)
                    Text([dayLine(brief.date), "élő nézet"].compactMap { $0 }.joined(separator: " · "))
                        .nkFont(15).foregroundStyle(.white.opacity(0.8))
                }
                .padding(.top, 70)
                Spacer(minLength: 0)
            }
        } content: {
            if stations.allSatisfy(\.isNow) {
                Text("Ma még nincs semmi a napodban. Ha jön egy edzés, egy étkezés vagy egy megbeszélés, itt sorakozik.")
                    .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                    .padding(.top, 4)
            } else {
                DayPath(stations: stations, hue: .mozgas) { _ in EmptyView() }
                    .padding(.top, -24)     // the head's lower third is haze; the path starts in it (spike)
            }
            Color.clear.frame(height: 90)
        }
    }
}
