import Foundation
import Testing
@testable import Boop

struct GreetingTests {
    func at(_ h: Int, _ m: Int = 0) -> Date {
        Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: h, minute: m))!
    }
    @Test func greetingFollowsTheClock() {
        #expect(greeting(at(6, 50)) == "Jó reggelt")
        #expect(greeting(at(9, 59)) == "Jó reggelt")
        #expect(greeting(at(10)) == "Szép napot")
        #expect(greeting(at(17, 59)) == "Szép napot")
        #expect(greeting(at(18)) == "Jó estét")
        #expect(greeting(at(22, 25)) == "Jó estét")
        #expect(greeting(at(3)) == "Jó estét")
    }
}
