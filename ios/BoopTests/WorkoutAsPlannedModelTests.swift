import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Megvolt sheet's model (`mezo-r36n9.161`): a typed weight parses with a comma, an emptied field drops the
/// override, and nothing is bookable before the day's prescription arrived.
@MainActor
struct WorkoutAsPlannedModelTests {
    @Test func aTypedWeightParsesWithACommaAndAnEmptyFieldDropsIt() {
        let m = WorkoutAsPlannedModel(templateSessionId: nil, date: "2026-11-23", title: "Pull Day", train: nil)
        let ex = UUID()
        m.setWeight("62,5", for: ex)
        #expect(m.overrides[ex] == 62.5)
        m.setWeight("", for: ex)
        #expect(m.overrides[ex] == nil)
        m.setWeight("0", for: ex)
        #expect(m.overrides[ex] == nil)
    }

    @Test func nothingIsBookableWithoutThePrescription() async {
        let m = WorkoutAsPlannedModel(templateSessionId: nil, date: "2026-11-23", title: "Pull Day", train: nil)
        await m.load()
        #expect(m.payload == nil)
        #expect(m.problem != nil)
    }

    @Test func thePlansTimeIsTheDefaultStartElseSixPm() {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        let m = WorkoutAsPlannedModel(templateSessionId: nil, date: "2026-11-23", title: "Pull Day", train: nil, calendar: cal)
        #expect(m.startedAt == cal.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 18)))
        m.useSessionTime("17:30")
        #expect(m.startedAt == cal.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 17, minute: 30)))
    }
}
