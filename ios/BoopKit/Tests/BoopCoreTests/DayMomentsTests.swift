import Foundation
import Testing
@testable import BoopCore

/// The pins on the day curve (`mezo-r36n9.56`). They are only a re-reading of the brief, so every rule that could
/// put a pin in the wrong place — the order, the hours, an empty day, a moment outside the curve — is a test.
struct DayMomentsTests {

    @Test func aClockTimeBecomesAFractionalHour() {
        let lunch: Double = 12 + 40.0 / 60
        #expect(dayMomentHour("12:40") == lunch)
        #expect(dayMomentHour("06:00") == 6.0)
        #expect(dayMomentHour("24:00") == nil)
        #expect(dayMomentHour("nope") == nil)
    }

    @Test func anEmptyDayHasNoPinsRatherThanPlaceholders() throws {
        #expect(dayMoments(try BriefFixture().brief()).isEmpty)
    }

    @Test func theDaysMomentsComeInClockOrder() throws {
        let b = try BriefFixture(
            sleep: #"{"bedtime":"22:50","wakeup":"06:53","totalMin":432,"hypnogram":[]}"#,
            bedtimeTarget: #""22:45""#,
            session: #"{"title":"Felsőtest","plannedTime":"18:30","minutes":75,"exercises":[]}"#,
            meals: #"[{"time":"12:40","title":"Ebéd","kcal":600,"proteinG":46,"logged":true}]"#
        ).brief()
        let m = dayMoments(b)
        #expect(m.map(\.id) == ["wake", "meal-0", "session", "bedtime"])
        let want: [Double] = [6 + 53.0 / 60, 12 + 40.0 / 60, 18.5, 22.75]
        #expect(m.map(\.hour) == want)
    }

    @Test func aMomentSaysWhatItWas() throws {
        let b = try BriefFixture(
            sleep: #"{"bedtime":"22:50","wakeup":"06:53","totalMin":432,"hypnogram":[]}"#,
            meals: #"[{"time":"12:40","title":"Ebéd","kcal":600,"proteinG":46,"logged":true}]"#
        ).brief()
        let m = dayMoments(b)
        #expect(m[0].detail == "06:53 · 7ó 12p alvás")
        #expect(m[1].label == "ebéd")
        #expect(m[1].detail == "12:40 · Ebéd · 46 g fehérje")
    }

    @Test func aMomentOutsideTheCurveIsLeftOff() throws {
        // the curve is 06:00–24:00: a 05:30 wake-up has nowhere to sit
        let b = try BriefFixture(sleep: #"{"bedtime":"21:30","wakeup":"05:30","totalMin":480,"hypnogram":[]}"#).brief()
        #expect(dayMoments(b).isEmpty)
    }

    @Test func theBusiestStretchOfTheCalendarIsOnePinInItsMiddle() throws {
        // 09:00–12:00 is slots 12…23, and a shorter one at 14:00
        let b = try BriefFixture(busyRuns: [12...23, 32...34]).brief()
        let c = try #require(dayMoments(b).first { $0.id == "calendar" })
        #expect(c.hour == 10.5 as Double)
        #expect(c.detail.hasPrefix("09:00–12:00"))
    }

    @Test func aShortMeetingIsNotWorthAPin() throws {
        #expect(dayMoments(try BriefFixture(busyRuns: [12...14]).brief()).isEmpty)
    }

    @Test func aCrowdedDayKeepsTheEarliestMomentsAndNeverMoreThanTheCap() throws {
        let meals = (8...13).map { #"{"time":"\#($0):00","title":"Étkezés","kcal":1,"proteinG":1,"logged":true}"# }
            .joined(separator: ",")
        let b = try BriefFixture(bedtimeTarget: #""22:45""#, meals: "[\(meals)]").brief()
        let m = dayMoments(b, cap: 4)
        #expect(m.count == 4)
        let want: [Double] = [8, 9, 10, 11]
        #expect(m.map(\.hour) == want)
    }

    @Test func thePlannedSessionTimeIsUsedUntilTheRealOneIsKnown() throws {
        let planned = try BriefFixture(session: #"{"title":"Felsőtest","plannedTime":"18:30","minutes":75,"exercises":[]}"#).brief()
        #expect(dayMoments(planned).first?.hour == 18.5 as Double)
        let moved = try BriefFixture(session: #"{"title":"Felsőtest","time":"19:15","plannedTime":"18:30","minutes":75,"exercises":[]}"#).brief()
        #expect(dayMoments(moved).first?.hour == 19.25 as Double)
    }
}
