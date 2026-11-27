import SwiftUI

// Étel colours (decision #125, owner 2026-11-28): one main colour — green — and two sub colours, honey and coral.
// Every score dimension wears its own shade of the three families. This slice uses it in the recipe evaluation; the
// rest of Étel follows in its own issue.

enum DayMacro: CaseIterable, Equatable, Sendable { case kcal, protein, carbs, fat }

enum EtelPalette {
    static let main = Color(hex: 0x3FBF8F)    // zöld
    static let honey = Color(hex: 0xF4C860)   // méz
    static let coral = Color(hex: 0xF28B6E)   // korall
    static let mint = Color(hex: 0x7FDCC0)
    /// The weakest marker — amber, never red (shame-free).
    static let amber = Color(red: 0.96, green: 0.78, blue: 0.38)
    /// „Eddig ma" on the day bars.
    static let eatenGrey = Color(white: 0.62)

    static func dimension(_ id: String) -> Color {
        switch id {
        case "macro": main
        case "micro": Color(hex: 0xA9D86B)            // lime
        case "who": coral
        case "fat_quality": honey
        case "nova": mint
        case "plant_diversity": Color(hex: 0x6CC46A)  // levél
        case "energy_density": Color(hex: 0xF5A65B)   // barack
        default: Color(hex: 0xF2A3B3)                 // rózsa (portion)
        }
    }

    static func dayMacro(_ key: DayMacro) -> Color {
        switch key {
        case .kcal: main
        case .protein: coral
        case .carbs: honey
        case .fat: mint
        }
    }
}
