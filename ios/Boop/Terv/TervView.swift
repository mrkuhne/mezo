import SwiftUI
import BoopCore
import BoopDesign

/// "12,4" — one decimal, Hungarian comma.
func hungarianKg(_ kg: Double) -> String { String(format: "%.1f", locale: Locale(identifier: "hu_HU"), kg) }

/// Terv, for now: today's weight and session from the brief.
struct TervView: View {
    @Environment(MorningStore.self) private var morning: MorningStore?
    @Environment(PenzStore.self) private var penz: PenzStore?

    var body: some View {
        PlacePage(hue: .fuel, title: "Terv", line: "Amihez Boop a napjaidat igazítja") {
            let day = morning?.brief?.day
            if let w = day?.weight {
                card("SÚLYOD", "\(hungarianKg(w.kg)) → \(hungarianKg(w.trendKg)) kg", "mért érték → trend")
            }
            if let s = day?.session {
                let when = [s.time ?? s.plannedTime, s.minutes.map { "\($0) perc" }].compactMap { $0 }.joined(separator: " · ")
                card("MAI EDZÉS", s.title, when)
            }
            // Pénz (L5): the week's remainder and the per-day figure, the moment there is money data. There is no way
            // to open an area from Terv yet, so the card is read-only.
            if let a = penz?.allowance, penz?.isEmpty == false {
                let w = penzWeek(a)
                card("PÉNZ · EZEN A HÉTEN",
                     penzOutfit(w.remaining >= 0 ? "\(penzFtUnit(w.remaining)) maradt" : "\(penzFtUnit(-w.remaining))-tal a keret fölött"),
                     penzOutfit("napi \(penzFtUnit(w.perDay))"))
            }
            if day?.weight == nil && day?.session == nil && (penz?.allowance == nil || penz?.isEmpty == true) {
                NKNotLiveYet(hue: .fuel, title: "A terveid ide költöznek",
                             line: "Az edzés- és étrendterved beállítása hamarosan itt lesz. Addig, ha módosítani szeretnél, szólj, és megcsináljuk.")
            }
        }
        // Reads once (the cache answers offline); the area page refreshes it.
        .task { await penz?.load() }
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
