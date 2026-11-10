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
