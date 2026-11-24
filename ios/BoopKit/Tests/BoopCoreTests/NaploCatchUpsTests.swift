import Foundation
import Testing
@testable import BoopCore

/// What a day's sheet offers to catch up (`mezo-r36n9.159`, spec §3.4): today only the moments already passed and
/// not done; a past day inside the week every missing moment, the close and the gym day; outside the week nothing.
struct NaploCatchUpsTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    func at(_ s: String) -> Date {
        let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)!
    }
    func done(_ slot: String) -> LedgerCheckIn {
        LedgerCheckIn(id: UUID(), slot: slot, capturedAt: at("2026-11-23 10:05"), values: ["energy": 6], pain: nil,
                      painRegions: [], painIntensity: nil, cravingKinds: [], askedItems: ["energy"], quickExit: false, snapshot: nil)
    }
    let pull = (id: UUID(), title: "Pull Day")

    @Test func todayOffersOnlyPassedMissingMoments() {
        let eleven = NaploCatchUps.compute(date: "2026-11-24", today: "2026-11-24", now: at("2026-11-24 11:00"), checkIns: [],
                                           closed: false, templateDay: pull, completedThatDay: false, calendar: cal)
        #expect(eleven.missingMoments == [.reggel])
        #expect(eleven.canClose == false)
        #expect(eleven.gymTemplateId == nil)
        let half = NaploCatchUps.compute(date: "2026-11-24", today: "2026-11-24", now: at("2026-11-24 14:30"), checkIns: [],
                                         closed: false, templateDay: nil, completedThatDay: false, calendar: cal)
        #expect(half.missingMoments == [.reggel])
        let later = NaploCatchUps.compute(date: "2026-11-24", today: "2026-11-24", now: at("2026-11-24 14:31"), checkIns: [],
                                          closed: false, templateDay: nil, completedThatDay: false, calendar: cal)
        #expect(later.missingMoments == [.reggel, .delben])
    }

    @Test func todayWithTheMorningDoneOffersNothingAtEleven() {
        let out = NaploCatchUps.compute(date: "2026-11-24", today: "2026-11-24", now: at("2026-11-24 11:00"), checkIns: [done("06:30")],
                                        closed: false, templateDay: nil, completedThatDay: false, calendar: cal)
        #expect(out.missingMoments.isEmpty)
    }

    @Test func aPastDayOffersEverythingMissing() {
        let out = NaploCatchUps.compute(date: "2026-11-23", today: "2026-11-24", now: at("2026-11-24 11:00"),
                                        checkIns: [done("06:30"), done("14:00")], closed: false, templateDay: pull,
                                        completedThatDay: false, calendar: cal)
        #expect(out.missingMoments == [.delben])
        #expect(out.canClose)
        #expect(out.gymTemplateId == pull.id)
        #expect(out.gymTitle == "Pull Day")
    }

    @Test func aClosedDayAndADoneGymDayOfferNeither() {
        let out = NaploCatchUps.compute(date: "2026-11-23", today: "2026-11-24", now: at("2026-11-24 11:00"),
                                        checkIns: [done("06:30"), done("10:00"), done("14:00")], closed: true, templateDay: pull,
                                        completedThatDay: true, calendar: cal)
        #expect(out.missingMoments.isEmpty)
        #expect(out.canClose == false)
        #expect(out.gymTemplateId == nil)
        #expect(out.isEmpty)
    }

    @Test func outsideTheWeekNothing() {
        let old = NaploCatchUps.compute(date: "2026-11-17", today: "2026-11-24", now: at("2026-11-24 11:00"), checkIns: [],
                                        closed: false, templateDay: pull, completedThatDay: false, calendar: cal)
        #expect(old.isEmpty)
        let future = NaploCatchUps.compute(date: "2026-11-25", today: "2026-11-24", now: at("2026-11-24 11:00"), checkIns: [],
                                           closed: false, templateDay: pull, completedThatDay: false, calendar: cal)
        #expect(future.isEmpty)
        let edge = NaploCatchUps.compute(date: "2026-11-18", today: "2026-11-24", now: at("2026-11-24 11:00"), checkIns: [],
                                         closed: false, templateDay: nil, completedThatDay: false, calendar: cal)
        #expect(edge.missingMoments == [.reggel, .delben, .delutan])
    }
}
