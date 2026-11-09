import SwiftUI
import BoopCore
import BoopDesign

/// Edzés, Fuel, Boop and Én in v1: a Lágy page that says the part still lives in the web app and opens it.
struct WebOnlyTabView: View {
    enum Domain {
        case edzes, fuel, boop, en(Me)
        var name: String { switch self { case .edzes: "Edzés"; case .fuel: "Fuel"; case .boop: "Boop"; case .en: "Én" } }
        var article: String { switch self { case .edzes, .en: "az"; default: "a" } }
        var photo: String { switch self { case .edzes: "edz-sulyzotarto.jpg"; case .fuel: "zab.jpg"; case .boop: "mezo-vacsora.jpg"; case .en: "en-futam.jpg" } }
        var tabs: [String] {
            switch self {
            case .edzes: ["Mai", "Terv", "Sport", "Terhelés", "Tár"]
            case .fuel: ["Mai", "Kiegészítők", "Trendek", "Konyha"]
            case .boop: ["Üzenőfal", "A csapat", "Rólad", "Emlékek"]
            case .en: ["Hol tartok", "Súly", "Alvás", "Célok", "Napló"]
            }
        }
        var boopLine: (String, String, String) {
            switch self {
            case .edzes: ("Az edzéseid hamarosan ", "itt indulnak", ", addig a webes appban rögzítsd őket.")
            case .fuel: ("Az étkezéseidet hamarosan ", "fotóból", " rögzítjük itt, addig a webes appban logolj.")
            case .boop: ("A csapat üzenőfala ", "ide költözik", ": Alvás, Mozgás, Étkezés, Közérzet és én.")
            case .en: ("A súlyod útja és a céljaid ", "itt lesznek", ", a reggeleid mellett.")
            }
        }
    }
    let domain: Domain
    @Environment(\.openURL) private var openURL
    @Environment(Session.self) private var session
    @State private var askingSignOut = false

    var body: some View {
        LagyTabPage(head: TabHead(photo: domain.photo, tabs: domain.tabs, on: domain.tabs[0],
                                  eyebrow: "\(domain.name) · a webes appban", title: "Ez a rész még a webes appban él",
                                  sub: "Boop hamarosan átveszi.", pill: "Megnyitom", pillGlyph: nil),
                    verdict: ("Hamarosan \(domain.article) ", domain.name, " is itt lesz, egy koppintásra."),
                    pillAction: { openURL(BoopConfig.webAppURL) }) {
            BoopCard(pre: domain.boopLine.0, em: domain.boopLine.1, post: domain.boopLine.2)
                .padding(.horizontal, 16).padding(.top, 26).entrance(0.2)
            if case .en(let me) = domain {
                EnAccountSection(me: me, asking: $askingSignOut).padding(.horizontal, 16).padding(.top, 26).entrance(0.3)
            }
        }
        .confirmationDialog("Kijelentkezel?", isPresented: $askingSignOut, titleVisibility: .visible) {
            Button("Kijelentkezem", role: .destructive) { session.signOut() }
            Button("Mégse", role: .cancel) {}
        }
    }
}
