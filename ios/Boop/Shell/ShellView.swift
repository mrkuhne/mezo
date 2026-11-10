import SwiftUI
import BoopCore
import BoopDesign

/// The five domains in the floating bottom bar. In v1 only Nap is Boop's own; the rest point to the web app.
/// One painted landscape runs behind all five: switching slides it toward the tapped domain while the skies blend,
/// the page content cross-fades over it, and the bar's selection capsule glides to the new icon.
struct ShellView: View {
    let me: Me
    @SceneStorage("tab") private var tab = "Nap"
    /// The switch in flight: the domain we came from, which side the new one sits on, and how far along (0 → 1).
    @State private var fromTab = "Nap"
    @State private var direction: CGFloat = 1
    @State private var progress: Double = 1
    /// Last sky each domain asked for (Nap re-colours with its orbs); unseen domains use their default.
    @State private var skies: [String: NKBackdrop] = [:]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            NKBackdropPanorama(from: sky(fromTab), to: sky(tab), direction: direction, progress: progress,
                               travel: reduceMotion ? 0 : 0.5)
            ZStack {
                page(tab)
                    .id(tab)
                    .onPreferenceChange(NKBackdropKey.self) { [tab] sky in if let sky { skies[tab] = sky } }
                    // The old page leaves quickly and the new one arrives just after, so text never doubles up.
                    .transition(.asymmetric(insertion: .opacity.animation(.easeOut(duration: 0.5).delay(0.3)),
                                            removal: .opacity.animation(.easeIn(duration: 0.22))))
            }
            .environment(\.nkBackdropHosted, true)
            NKNav(selected: Binding(get: { tab }, set: select))
        }
        .preferredColorScheme(.dark)
        .onAppear { fromTab = tab }
    }

    @ViewBuilder private func page(_ tab: String) -> some View {
        switch tab {
        case "Edzés": WebOnlyTabView(domain: .edzes)
        case "Fuel": WebOnlyTabView(domain: .fuel)
        case "Boop": WebOnlyTabView(domain: .boop)
        case "Én": WebOnlyTabView(domain: .en(me))
        default: NapView()
        }
    }

    private func sky(_ tab: String) -> NKBackdrop { domainPanels(skies)[Int(domainIndex(tab))] }

    /// The old land starts from where it is now (no jump), then the blend runs to the new one.
    private func select(_ new: String) {
        guard new != tab else { return }
        var still = Transaction(); still.disablesAnimations = true
        withTransaction(still) {
            fromTab = tab
            direction = domainIndex(new) >= domainIndex(tab) ? 1 : -1
            progress = 0
        }
        DispatchQueue.main.async {
            withAnimation(.smooth(duration: 0.95)) {
                tab = new
                progress = 1
            }
        }
    }
}

/// The bar's order as backdrop positions (unknown names count as Nap).
func domainIndex(_ tab: String) -> Double {
    Double(NKNav.items.map(\.label).firstIndex(of: tab) ?? 0)
}

/// One sky per domain in bar order: what the domain last reported, else its default colour world.
func domainPanels(_ skies: [String: NKBackdrop]) -> [NKBackdrop] {
    let defaults: [String: Hue] = ["Nap": .forma, "Edzés": .mozgas, "Fuel": .fuel, "Boop": .forma, "Én": .alvas]
    return NKNav.items.map { item in
        skies[item.label] ?? NKBackdrop(hue: defaults[item.label] ?? .forma, heroHeight: 560, scrollY: 0)
    }
}

/// "hétfő, 06:50" from the device clock, Hungarian.
func hungarianNow(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "hu_HU")
    f.dateFormat = "EEEE, HH:mm"
    return f.string(from: date)
}

/// Time-of-day greeting: reggel 5–10, napközben 10–18, este 18–5.
func greeting(_ date: Date = Date(), calendar: Calendar = .current) -> String {
    switch calendar.component(.hour, from: date) {
    case 5..<10: "Jó reggelt"
    case 10..<18: "Szép napot"
    default: "Jó estét"
    }
}
