import Testing
import UIKit
import SwiftUI
@testable import BoopDesign

private func rgb(_ c: Color) -> (Int, Int, Int) {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    UIColor(c).getRed(&r, green: &g, blue: &b, alpha: &a)
    return (Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))
}

@Test func hueNamesAndOrder() {
    #expect(Hue.allCases.map(\.name) == ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus"])
}

@Test func everyHueHasThreeSkiesAndFourOrbColours() {
    for h in Hue.allCases {
        #expect(h.sky.count == 3)
        #expect(h.orb.count == 4)
    }
}

@Test func groundMatchesSpec() { #expect(rgb(NK.ground) == (0x0D, 0x12, 0x18)) }

@Test func formaGlowMatchesSpike() { #expect(rgb(Hue.forma.glow) == (0x8B, 0x6C, 0xF0)) }

@Test func deepGroundIsNeverTheBareGround() {
    for h in Hue.allCases {
        let g = NK.deepGround(h)
        #expect(g.count == 3)
        #expect(g.allSatisfy { rgb($0) != rgb(NK.ground) })
    }
}
