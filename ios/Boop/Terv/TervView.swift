import SwiftUI
import BoopCore
import BoopDesign

/// "12,4" — one decimal, Hungarian comma.
func hungarianKg(_ kg: Double) -> String { String(format: "%.1f", locale: Locale(identifier: "hu_HU"), kg) }

/// Terv, for now: today's weight and session from the brief, and the way to the web app where the plans live.
struct TervView: View {
    @Environment(MorningStore.self) private var morning: MorningStore?
    @Environment(\.openURL) private var openURL

    var body: some View {
        PlacePage(hue: .fuel, title: "Terv", line: "Amihez Boop a napjaidat igazítja") {
            if let day = morning?.brief?.day {
                if let w = day.weight {
                    card("SÚLYOD", "\(hungarianKg(w.kg)) → \(hungarianKg(w.trendKg)) kg", "mért érték → trend")
                }
                if let s = day.session {
                    let when = [s.time ?? s.plannedTime, s.minutes.map { "\($0) perc" }].compactMap { $0 }.joined(separator: " · ")
                    card("MAI EDZÉS", s.title, when)
                }
            }
            NKBoopCard(pre: "Az edzés- és étrendtervedet ", em: "a webes appban", post: " állítsd be, ide hamarosan átköltözik.",
                       action: "Megnyitom") { openURL(BoopConfig.webAppURL) }
        }
    }

    private func card(_ label: String, _ title: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono(label)
            Text(title).font(.nkNumber(26)).foregroundStyle(.white)
            if !sub.isEmpty { Text(sub).nkFont(14).foregroundStyle(.white.opacity(0.6)) }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        .accessibilityElement(children: .combine)
    }
}
