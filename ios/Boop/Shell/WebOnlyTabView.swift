import SwiftUI
import BoopCore
import BoopDesign

/// Edzés, Fuel, Boop and Én in v1: a Lágy page that says the part still lives in the web app and opens it.
struct WebOnlyTabView: View {
    enum Domain {
        case edzes, fuel, boop, en(Me)
        var name: String { switch self { case .edzes: "Edzés"; case .fuel: "Fuel"; case .boop: "Boop"; case .en: "Én" } }
        var article: String { switch self { case .edzes, .en: "az"; default: "a" } }
        /// The domain's colour world until its own round (Edzés orange, Fuel green, Boop violet, Én blue).
        var hue: Hue { switch self { case .edzes: .mozgas; case .fuel: .fuel; case .boop: .forma; case .en: .alvas } }
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
        NKTabPage(hue: domain.hue, heroHeight: 560, compact: nil) {
            VStack(spacing: 0) {
                Text("boop").font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).tracking(3).foregroundStyle(.white).padding(.top, 58)
                NKTabStrip(tabs: domain.tabs, selected: .constant(domain.tabs[0])).padding(.top, 12).allowsHitTesting(false)
                Spacer()
                Text("\(domain.name) · a webes appban".uppercased()).nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.8))
                Text("Ez a rész még a webes appban él").nkFont(36, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
                    .padding(.horizontal, 24).padding(.top, 8)
                Text("Hamarosan \(domain.article) \(domain.name) is itt lesz, egy koppintásra.").nkFont(16)
                    .foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 8)
                NKPill("Megnyitom", wide: false) { openURL(BoopConfig.webAppURL) }.padding(.top, 18).padding(.bottom, 60)
            }
        } content: {
            NKBoopCard(pre: domain.boopLine.0, em: domain.boopLine.1, post: domain.boopLine.2)
            if case .en(let me) = domain { EnAccountSection(me: me, asking: $askingSignOut) }
            Color.clear.frame(height: 90)
        }
        .confirmationDialog("Kijelentkezel?", isPresented: $askingSignOut, titleVisibility: .visible) {
            Button("Kijelentkezem", role: .destructive) { session.signOut() }
            Button("Mégse", role: .cancel) {}
        }
    }
}
