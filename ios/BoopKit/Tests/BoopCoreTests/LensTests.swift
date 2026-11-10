import Foundation
import Testing
@testable import BoopCore

struct LensTests {
    @Test func eachOrbHasItsAction() throws {
        let b = try BriefFixture().brief()
        let kinds = MetricKey.allCases.map { Lens.action(for: $0, brief: b, now: at(9), evening: false)?.kind }
        #expect(kinds == [.checkin, .bedtime, .workout, .photo, .breath])
    }

    @Test func doneFormaCheckinHasNoPill() throws {
        var f = BriefFixture(); f.checkins = #"[{"slot":"morning","time":"08:00","done":true}]"#
        #expect(Lens.action(for: .forma, brief: try f.brief(), now: at(9), evening: false) == nil)
    }

    @Test func bedtimeTitleCarriesTheTarget() throws {
        var f = BriefFixture(); f.bedtimeTarget = #""22:45""#
        let a = Lens.action(for: .alvas, brief: try f.brief(), now: at(9), evening: false)
        #expect(a?.title == "Lefekvés 22:45 · Emlékeztess")
    }
}
