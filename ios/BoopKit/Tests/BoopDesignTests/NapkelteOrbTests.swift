import Testing
import UIKit
import SwiftUI
@testable import BoopDesign

@Test func orbPaletteAlwaysFour() {
    #expect(orbPalette([.red, .blue, .green]).count == 4)
    #expect(orbPalette([.red]).count == 4)
    #expect(orbPalette([]).count == 4)
    #expect(orbPalette([.red, .blue, .green, .white, .black]).count == 4)
}

@Test func riseClamps() {
    #expect(riseFraction(score: 40) == 0)
    #expect(riseFraction(score: 100) == 1)
    #expect(riseFraction(score: 0) == 0)
    #expect(riseFraction(score: 130) == 1)
    #expect(abs(riseFraction(score: 78)! - 0.6333) < 0.001)
}

@Test func nilScoreIsLearning() { #expect(riseFraction(score: nil) == nil) }

@Test @MainActor func stillOrbUnderReducedMotion() {
    #expect(render(LivingOrb(palette: Hue.forma.orb, size: 100, level: 0.7, glow: false, motion: OrbMotion(), animated: false), width: 100, height: 100) != nil)
}

@Test @MainActor func stillOrbRendersWithAShortPalette() {
    #expect(render(StillOrb(palette: [.red, .blue], size: 60, level: 0.5), width: 60, height: 60) != nil)
}

@Test @MainActor func risingOrbRendersLearningState() {
    #expect(render(RisingOrb(hue: .forma, score: nil, display: "9 / 14", motion: OrbMotion()), height: 290) != nil)
}
