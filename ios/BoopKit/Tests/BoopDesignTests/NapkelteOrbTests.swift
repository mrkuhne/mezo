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

/// Owner, 2026-11-12: every metric's hero orb sits where Fuel's did — on the horizon, whatever the score.
@Test func heroOrbSitsOnTheHorizonForEveryScore() {
    #expect(heroOrbCenterY(height: 290) == 282)
    #expect(heroOrbCenterY(height: 400) == 392)
}

/// The number rides above the horizon line, inside the orb's visible half.
@Test func heroLabelStaysInTheVisibleHalf() {
    let lift = heroLabelLift(orbSize: 156)
    #expect(lift > 20 && lift < 78)
}

@Test @MainActor func stillOrbUnderReducedMotion() {
    #expect(render(LivingOrb(palette: Hue.forma.orb, size: 100, level: 0.7, glow: false, motion: OrbMotion(), animated: false), width: 100, height: 100) != nil)
}

@Test @MainActor func stillOrbRendersWithAShortPalette() {
    #expect(render(StillOrb(palette: [.red, .blue], size: 60, level: 0.5), width: 60, height: 60) != nil)
}

@Test @MainActor func risingOrbRendersLearningState() {
    #expect(render(RisingOrb(hue: .forma, score: nil, display: "9 / 14", motion: OrbMotion()), height: 290) != nil)
}

@Test func noDataIsSpokenAsNincsAdat() {
    #expect(orbSpoken("–") == "nincs adat")
    #expect(orbSpoken("74") == "74")
    #expect(orbSpoken("7ó 12p") == "7ó 12p")
}

@Test func noDataDashIsNumberSized() {
    #expect(risingDisplaySize(score: nil, display: "–") == risingDisplaySize(score: 74, display: "74"))
    #expect(risingDisplaySize(score: nil, display: "9 / 14") < risingDisplaySize(score: 74, display: "74"))
}
