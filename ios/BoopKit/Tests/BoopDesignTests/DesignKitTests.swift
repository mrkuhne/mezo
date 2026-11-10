import Testing
import UIKit
import SwiftUI
@testable import BoopDesign

@Test func fontsRegister() {
    Lagy.registerFonts()
    #expect(!UIFont.fontNames(forFamilyName: Lagy.outfitFamily).isEmpty)
    #expect(!UIFont.fontNames(forFamilyName: Lagy.manropeFamily).isEmpty)
}

@Test func everyCatalogGlyphExists() {
    for entry in Glyph.catalog {
        #expect(UIImage(named: "g-\(entry)", in: .module, with: nil) != nil, "missing glyph \(entry)")
    }
}

@Test func tokensMatchCanon() {
    func rgb(_ c: Color) -> (Int, Int, Int) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(c).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))
    }
    #expect(rgb(Lagy.paper) == (0xF6, 0xF4, 0xEF))
    #expect(rgb(Lagy.sage) == (0x5F, 0xB0, 0x8A))
    #expect(rgb(Lagy.deep) == (0x2E, 0x6B, 0x52))
}

@Test func hungarianDecimal() {
    #expect(hu1(82.4) == "82,4")
    #expect(hu1(80) == "80,0")
}

@Test func codeFieldsNeverAutocorrect() {
    #expect(LagyField.Kind.code.autocorrectionDisabled)
    #expect(!LagyField.Kind.code.capitalizesWords)
    #expect(LagyField.Kind.email.autocorrectionDisabled)
    #expect(LagyField.Kind.name.capitalizesWords)
}
