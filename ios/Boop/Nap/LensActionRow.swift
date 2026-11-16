import SwiftUI
import BoopCore
import BoopDesign

/// What the hero pill shows. `speaks` = the Forma check-in is done: the pill is *Boop elmondja* and the voice circle hides.
struct MaiPill: Equatable { let glyph: String?, title: String, speaks: Bool }

func lensPill(_ action: LensAction?) -> MaiPill {
    guard let action else { return MaiPill(glyph: nil, title: MaiText.speak, speaks: true) }
    return MaiPill(glyph: action.glyph, title: action.title, speaks: false)
}

/// Fuel's quick actions under the pills. Each one does its thing (B4): the composer open, the composer with a coffee
/// already typed, or a glass of water straight onto the day.
struct FuelChip: Equatable {
    enum Action: Equatable { case compose, coffee, water(Int) }
    let title, glyph: String
    let action: Action
}
let fuelChips = [FuelChip(title: "Étel rögzítése", glyph: "bowl-cream", action: .compose),
                 FuelChip(title: "Kávé", glyph: "drop-sky", action: .coffee),
                 FuelChip(title: "Víz +250 ml", glyph: "drop-sky", action: .water(250))]

/// Mozgás pill's long-press menu.
func workoutMenu(sessionTitle: String?) -> [String] {
    [sessionTitle.map { "Mai edzés · \($0)" } ?? "Mai edzés", "Futás", "Séta"]
}

/// The toast of an action that arrives in a later slice.
func soonToast(_ what: String) -> String { "\(what) · hamarosan" }

/// The short name of a lens action for its "hamarosan" toast.
func soonName(_ kind: LensKind) -> String {
    switch kind {
    case .checkin: "Check-in"
    case .eveningCheckin: "Esti check-in"
    case .bedtime: "Emlékeztető"
    case .windDown: "Esti levezetés"
    case .workout: "Edzés"
    case .photo: "Fotózás"
    case .breath: "Légzés"
    }
}

/// Fixed words of the Mai hero.
enum MaiText {
    static let speak = "Boop elmondja"
    static let mute = "Némítás"
    static let unmute = "Hang bekapcsolása"
    static let replay = "Mondd újra"
    static let breathDone = "Kész"
    static let inhale = "Belégzés"
    static let exhale = "Kilégzés"
    static let breathLine = "Kövesd a gömböt: négy másodperc be, négy másodperc ki."
    static let breathEnded = "Egy perc légzés · kész"
    static let learning = "még tanulom"
    static let problemCaps = "MEGAKADTAM"
    static let problemTitle = "Most nem jött meg a reggeled"
    static let problemSentence = "Az adataid megvannak, csak az összefoglalóm akadt el útközben. Próbáljuk újra."
    static let retry = "Újra próbálom"
}

// The hero action row (one white pill + Boop's glass orb + Fuel's quick chips) lived here until 2026-11-16: the
// owner saw the rebuilt day page and said it does not belong on it, and the read-aloud it carried went with it
// (`mezo-r36n9.56`). What is left in this file is what the rest of the page still uses: the page's own strings,
// the "hamarosan" toast and the pill-copy helpers. The row itself is in git history.
