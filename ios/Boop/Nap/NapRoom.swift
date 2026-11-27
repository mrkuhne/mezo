import SwiftUI
import BoopCore
import BoopDesign

/// The Nap room's two tabs (`mezo-r36n9.196`, decision #135): today's page, and the last 14 days (the old Napló place).
enum NapTab: String, CaseIterable {
    case ma = "Ma"
    case napok = "Napok"
}

/// The Nap room's head words per tab. Ma: Boop's line for the day and how full the calendar is (no calendar → no
/// sentence, never an invented percent). Napok: what the list is and how to use it.
func napRoomHead(_ brief: Brief?, tab: NapTab) -> (headline: String, sentence: String) {
    switch tab {
    case .ma:
        let sentence = dayFullness(brief).map { "A napod \($0) %-a foglalt." } ?? ""
        return (kezdolapLine(brief), sentence)
    case .napok:
        return ("Két hét visszafelé",
                "Minden nap egy sor: mit ettél, edzettél, hogy aludtál. Egy napra koppintva megnyílik.")
    }
}

/// The Nap room: a ring room like every other (`NKAreaPage` with its own bar **Ma · Napok · Boop**). The Ma tab is
/// the day page the ring's centre used to open (morning summary, the day, the wall); Napok is the day list.
struct NapRoomPage<Ma: View, Napok: View>: View {
    let brief: Brief?
    @Binding var tab: NapTab
    let onBack: (@MainActor @Sendable () -> Void)?
    let onAsk: (@MainActor @Sendable () -> Void)?
    @ViewBuilder let ma: () -> Ma
    @ViewBuilder let napok: () -> Napok

    var body: some View {
        let head = napRoomHead(brief, tab: tab)
        let full = dayFullness(brief)
        NKAreaPage(hue: .alvas, name: "Nap",
                   eyebrow: tab == .napok ? "Nap · az elmúlt 14 nap" : "Nap · \(brief.map { dayHeadline($0.date) } ?? "ma")",
                   level: full.map { min(1, max(0.08, Double($0) / 100)) }, display: full.map { "\($0)" },
                   headline: head.headline, sentence: head.sentence,
                   glyph: tab == .napok ? "napok-ink" : "sun-ink",
                   tabs: [NKAreaTab(NapTab.ma.rawValue), NKAreaTab(NapTab.napok.rawValue, glyph: "napok-ink")],
                   selectedTab: Binding(get: { tab.rawValue }, set: { tab = NapTab(rawValue: $0) ?? .ma }),
                   onBack: onBack, onAsk: onAsk) {
            switch tab {
            case .ma: ma()
            case .napok: napok()
            }
        }
    }
}

/// A day opened from the Napok tab (its `yyyy-MM-dd`): the day's sheet hangs at the Nap room's page level.
struct NapOpenDay: Identifiable, Equatable { let id: String }
