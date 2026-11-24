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
    // The five metric worlds first, then the two the life dashboard added (Pénz, Levél): they have no metric,
    // so anything that means "a metric" iterates `Hue.metrics`, not `allCases`.
    #expect(Hue.metrics.map(\.name) == ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus"])
    #expect(Hue.allCases.map(\.name) == ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus", "Pénz", "Levél", "Súly"])
}

/// The ninth area's world (owner 2026-11-24, `mezo-r36n9.158`): gold, the one colour the ring did not have.
@Test func sulyWorldIsGold() {
    #expect(rgb(Hue.suly.glow) == (0xE6, 0xB3, 0x3A))
    #expect(Hue.suly.orb.count == 4 && Hue.suly.sky.count == 3)
    #expect(Hue.suly.name == "Súly")
}

/// The Súly room's Test tab wears its own body mark (owner: „a test kapjon saját új ikont"); a Napló tab reads as a book.
@Test func testTabWearsTheBodyGlyph() {
    #expect(NKAreaTabs.glyph("Test") == "body-cream")
    #expect(NKAreaTabs.glyph("Napló") == "book-sage")
    #expect(NKGlyph.outlined.contains("body-cream"))
    #expect(NKGlyph.outlined.contains("cup-cream"))
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

// Kímélő mód paints a calm grey-blue sky (spike FrameMaiMode); a metric's sky stays its hue's.
@Test func calmSkyIsTheSpikeGreyBlue() {
    #expect(NKSky.calm.colors.count == 3)
    #expect(rgb(NKSky.calm.colors[0]) == (0x2A, 0x3A, 0x4E))
    #expect(rgb(NKSky.calm.colors[2]) == (0xD6, 0xE4, 0xDC))
    #expect(NK.deepGround(.calm).allSatisfy { rgb($0) != rgb(NK.ground) })
    for h in Hue.allCases { #expect(NKSky.hue(h).colors.map(rgb).elementsEqual(h.sky.map(rgb), by: ==)) }
}

@Test func backdropDefaultsToItsHuesSky() {
    #expect(NKBackdrop(hue: .alvas, heroHeight: 500, scrollY: 0).sky == .hue(.alvas))
    #expect(NKBackdrop(hue: .alvas, heroHeight: 500, scrollY: 0, sky: .calm).sky == .calm)
}
