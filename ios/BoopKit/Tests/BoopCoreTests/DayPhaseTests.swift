import Foundation
import Testing
@testable import BoopCore

struct DayPhaseTests {
    func phase(_ h: Int, _ m: Int) -> DayPhase { DayPhase.at(at(h, m), calendar: budapest) }

    @Test func phaseAt0359IsEste() { #expect(phase(3, 59) == .este) }
    @Test func phaseAt0400IsReggel() { #expect(phase(4, 0) == .reggel) }
    @Test func phaseAt0959IsReggel() { #expect(phase(9, 59) == .reggel) }
    @Test func phaseAt1000IsNapkozben() { #expect(phase(10, 0) == .napkozben) }
    @Test func phaseAt1759IsNapkozben() { #expect(phase(17, 59) == .napkozben) }
    @Test func phaseAt1800IsEste() { #expect(phase(18, 0) == .este) }
    @Test func phaseAt2330IsEste() { #expect(phase(23, 30) == .este) }
    @Test func names() { #expect(DayPhase.allCases.map(\.name) == ["Reggel", "Napközben", "Este"]) }
}
