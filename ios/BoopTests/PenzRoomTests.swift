import Foundation
import Testing
@testable import Boop
import BoopCore

@Suite("Pénz room — what the page shows")
@MainActor
struct PenzRoomTests {
    private func allowance(weekRemaining: Int64) -> PenzAllowance {
        PenzAllowance(date: "2026-11-19",
                      month: .init(month: "2026-11", free: .huf(31_400_000), spent: .huf(21_900_000), remaining: .huf(9_500_000)),
                      week: .init(start: "2026-11-16", end: "2026-11-22", budget: .huf(7_700_000), spent: .huf(4_250_000),
                                  remaining: .huf(weekRemaining), perDay: .huf(862_500)),
                      lines: [])
    }

    @Test func maStatsAreWeekMonthAndPerDayNeverAnInventedInvestableFigure() {
        let s = penzMaStats(allowance(weekRemaining: 3_450_000))
        #expect(s.map(\.label) == ["ennyi maradt a hétből", "a hónapból, 12 napra", "ennyi jut ma egy napra"])
        #expect(s[0].hot && s[0].value == "34\u{00A0}500", "Outfit figures group with a plain no-break space")
        #expect(!s.contains { $0.label.contains("befektet") })
    }

    @Test func aNegativeWeekIsNeverLitInTheHue() {
        let s = penzMaStats(allowance(weekRemaining: -320_000))
        #expect(!s[0].hot && s[0].value == "\u{2212}3\u{00A0}200")
    }

    @Test func sectionGlyphsAreTheSpikesAndPendingRowsReadAsWaiting() {
        #expect(penzSectionGlyph("HONNAN JÖN EZ A SZÁM") == "scale-ink")
        #expect(penzSectionGlyph("MIRE GYŰJTÖK") == "star-sun")
        #expect(penzSectionGlyph("A MAI TÉTELEK") == "e-penz")
        #expect(areaGlyph(.penz) == "e-penz")
        let pending = PenzItem(id: "p", title: "Piac", sub: "x", value: "1\u{202F}890", glyph: "bowl-cream", pending: true, needsReview: false)
        #expect(penzRow(pending).id == "p")
    }

    @Test func copyNeverUrgesOrPromises() {
        for text in [penzVerdictRuleText, penzMonthEndText] {
            for banned in ["most kell", "sürgős", "add el!", "garantált", "biztos hozam"] {
                #expect(!text.lowercased().contains(banned))
            }
        }
    }
}
