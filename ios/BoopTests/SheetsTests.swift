import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// The detail sheets and A napom (Task 13): routing, week series, axis times, the energy magnifier, the full-day path.
struct SheetsTests {

    // MARK: Routing from Boop mondja's phrases

    @Test func eachLinkOpensItsOwnSheet() {
        #expect(DetailSheet(.sleep) == .sleep)
        #expect(DetailSheet(.heart) == .pulse)
        #expect(DetailSheet(.day) == .day)
    }

    // MARK: Week series (missing days stay missing, never 0)

    @Test func aWeekWithoutAnyValueHasNoSeries() {
        #expect(weekSeries([nil, nil, nil, nil, nil, nil, nil]) == nil)
        #expect(weekSeries([]) == nil)
    }

    @Test func missingDaysStayMissingAndTheAverageSkipsThem() {
        let s = weekSeries([72, 64, nil, 80, 70, 76, 88])
        #expect(s?.values == [72, 64, nil, 80, 70, 76, 88])
        #expect(s?.average == 75)
    }

    @Test func weekLabelsEndOnTheBriefsDay() {
        // 2026-11-10 is a Tuesday (kedd)
        #expect(weekLabels(endingOn: "2026-11-10") == ["Sze", "Cs", "P", "Szo", "V", "H", "K"])
        #expect(weekLabels(endingOn: "nonsense", count: 3) == ["", "", ""])
    }

    @Test func dayNamesAreHungarian() {
        #expect(weekdayName("2026-11-10") == "kedd")
        #expect(dayLine("2026-11-10") == "Kedd, november 10.")
        #expect(weekdayName("x") == nil)
    }

    @Test func deepDeltaComparesWithTheDaysBeforeToday() {
        #expect(deepDelta(deep: 88, week: [72, 64, nil, 80, 70, 76, 88]) == 16)    // prior avg 72.4
        #expect(deepDelta(deep: 88, week: [nil, 88]) == nil)                       // nothing before today
    }

    // MARK: Sleep

    @Test func axisTimesSpreadOverTheNight() {
        #expect(axisTimes(start: "22:48", minutes: 432, count: 4) == ["22:48", "01:12", "03:36", "06:00"])
        #expect(axisTimes(start: "bad", minutes: 432, count: 4).isEmpty)
    }

    @Test func legendUsesTheStageMinutesInOrder() {
        let rows = sleepLegend(deep: 90, rem: 90, light: 150, awake: 30, hypnogram: [])
        #expect(rows.map(\.label) == ["Ébren", "REM", "Könnyű", "Mély"])
        #expect(rows.map(\.stage) == [0, 1, 2, 3])
        #expect(rows.first?.time == "30p")
        #expect(rows.last?.time == "1ó 30p")
        #expect(abs(rows.map(\.share).reduce(0, +) - 1) < 0.001)
    }

    @Test func legendFallsBackToTheHypnogramAndDropsMissingStages() {
        let rows = sleepLegend(deep: nil, rem: nil, light: nil, awake: nil,
                               hypnogram: [(stage: 2, minutes: 60), (stage: 3, minutes: 20), (stage: 2, minutes: 20)])
        #expect(rows.map(\.label) == ["Könnyű", "Mély"])
        #expect(rows.first?.time == "1ó 20p")
        #expect(sleepLegend(deep: nil, rem: nil, light: nil, awake: nil, hypnogram: []).isEmpty)
    }

    // MARK: Day: the energy magnifier

    private let hourly = [0.35, 0.5, 0.68, 0.82, 0.9, 0.86, 0.74, 0.6, 0.52, 0.44, 0.5, 0.62, 0.7, 0.66, 0.55, 0.45, 0.36, 0.28, 0.2]
    private var input: MagnifierInput {
        MagnifierInput(hourly: hourly,
                       busy: (0..<72).map { (16..<20).contains($0) || (40..<44).contains($0) },
                       session: .init(title: "Vállak és hát", time: "17:30", minutes: 60),
                       meals: [.init(time: "12:30", title: "Csirkés rizs")])
    }
    private func at(_ minutes: Int) -> Double { Double(minutes - 360) / 1080 }

    @Test func energyIndexRunsFromSixToMidnight() {
        #expect(energyIndex(minutes: 360) == 0)
        #expect(energyIndex(minutes: 930) == 9.5)
        #expect(energyIndex(minutes: 1440) == 18)
        #expect(energyIndex(minutes: 200) == 0)
        #expect(energyIndex(minutes: 1600) == 18)
    }

    @Test func theReadingSnapsToQuarterHoursAndNamesTheTime() {
        #expect(magnifierReading(fraction: 0, input).time == "06:00")
        #expect(magnifierReading(fraction: at(930), input).time == "15:30")
        #expect(magnifierReading(fraction: 1, input).time == "24:00")
        #expect(magnifierReading(fraction: at(937), input).time == "15:30")   // 15:37 snaps back
        #expect(magnifierReading(fraction: -0.2, input).minutes == 360)
        #expect(magnifierReading(fraction: 1.4, input).minutes == 1440)
    }

    @Test func percentIsTheInterpolatedLevelRounded() {
        #expect(magnifierReading(fraction: at(930), input).percent == 47)       // between 0.44 and 0.5
        #expect(magnifierReading(fraction: 0, input).percent == 35)
        #expect(magnifierReading(fraction: 1, input).percent == 20)
        let half = MagnifierInput(hourly: [0, 0.25], busy: [], session: nil, meals: [])
        #expect(magnifierReading(fraction: 30.0 / 1080, half).percent == 13)  // 12.5 rounds up
        // past the last value the line holds its end
        #expect(magnifierReading(fraction: 1, half).percent == 25)
    }

    @Test func noEnergyCurveMeansNoPercentNeverZero() {
        let none = MagnifierInput(hourly: [], busy: [], session: nil, meals: [])
        #expect(magnifierReading(fraction: 0.5, none).percent == nil)
        #expect(magnifierReading(fraction: 0.5, none).level == nil)
    }

    @Test func whatIsOnReadsTheSessionMealsAndCalendar() {
        #expect(magnifierReading(fraction: at(17 * 60 + 45), input).what == "Edzés · Vállak és hát")
        #expect(magnifierReading(fraction: at(10 * 60 + 15), input).what == "Megbeszélés")
        #expect(magnifierReading(fraction: at(12 * 60 + 30), input).what == "Csirkés rizs")
        #expect(magnifierReading(fraction: at(14 * 60), input).what == "Szabad idő")
        #expect(magnifierReading(fraction: at(18 * 60 + 30), input).what == "Szabad idő")   // the session ended
        let both = MagnifierInput(hourly: hourly, busy: (0..<72).map { $0 == 46 },
                                  session: .init(title: "Futás", time: "17:30", minutes: nil), meals: [])
        #expect(magnifierReading(fraction: at(17 * 60 + 30), both).what == "Edzés · Futás · Megbeszélés")
    }

    @Test func theHourStepChangesOncePerHour() {
        #expect(magnifierReading(fraction: at(15 * 60), input).hour == 15)
        #expect(magnifierReading(fraction: at(15 * 60 + 45), input).hour == 15)
        #expect(magnifierReading(fraction: at(16 * 60), input).hour == 16)
    }

    @Test func dayTitleReadsTheCalendar() {
        #expect(dayTitle(events: 6, conflict: true) == "Szoros, de belefér")
        #expect(dayTitle(events: 0, conflict: false) == "Szabad napod van")
        #expect(dayTitle(events: 3, conflict: false) == "Belefér minden")
    }

    // MARK: Day: keeping the conflict ("Marad így")

    @Test func keepingHidesTheCardButTheConflictTitleStays() {
        let open = dayConflict(hasConflict: true, moved: false, kept: false)
        let kept = dayConflict(hasConflict: true, moved: false, kept: true)
        #expect(open.showCard && !kept.showCard)
        #expect(open.title(events: 2) == "Szoros, de belefér")
        #expect(kept.title(events: 2) == "Szoros, de belefér")
        // a moved session settles it: no card, no conflict title
        let moved = dayConflict(hasConflict: true, moved: true, kept: false)
        #expect(!moved.showCard && moved.title(events: 2) == "Belefér minden")
        #expect(!dayConflict(hasConflict: false, moved: false, kept: false).showCard)
    }

    // MARK: Day: anchors on the curve (spec §10.3)

    private var anchored: MagnifierInput {
        var i = input; i.dipHour = 15; return i
    }

    @Test func anchorsAreTheMealsTheDipAndTheSessionInTimeOrder() {
        let a = curveAnchors(anchored)
        #expect(a.map(\.minutes) == [750, 900, 1050])
        #expect(a.map(\.kind) == [.meal, .dip, .session])
        #expect(a.map(\.title) == ["Csirkés rizs", "Mélypont", "Vállak és hát"])
        #expect(curveAnchors(MagnifierInput(hourly: [], busy: [], session: nil, meals: [])).isEmpty)
    }

    @Test func theMagnifierLandsOnAnAnchorWithinTenMinutes() {
        let near = magnifierReading(fraction: at(17 * 60 + 38), anchored)
        #expect(near.time == "17:30" && near.anchor?.kind == .session)
        let dip = magnifierReading(fraction: at(14 * 60 + 52), anchored)
        #expect(dip.time == "15:00" && dip.what == "Mélypont")
        let far = magnifierReading(fraction: at(17 * 60 + 45), anchored)
        #expect(far.time == "17:45" && far.anchor == nil)
    }

    // MARK: The shared move guard

    @MainActor @Test func aSecondMoveWhileOneIsInFlightDoesNothing() async {
        let store = MorningStore(client: makeClient(tokens: MemoryTokenStore("t"), transport: PreviewTransport()), onUnauthorized: {})
        await store.load(date: Date())
        let log = ToastLog()
        let t1 = Task { await moveSession(store, to: "18:30", planned: "17:30", toast: { log.items.append($0) }, undoToast: { t, _ in log.items.append(t) }) }
        let t2 = Task { await moveSession(store, to: "18:30", planned: "17:30", toast: { log.items.append($0) }, undoToast: { t, _ in log.items.append(t) }) }
        await t1.value; await t2.value
        #expect(log.items == ["Áttettem 18:30-ra"])
        // two undos at once: one "Visszatettem", no spurious failure
        log.items = []
        let u1 = Task { await undoSessionMove(store, planned: "17:30", toast: { log.items.append($0) }) }
        let u2 = Task { await undoSessionMove(store, planned: "17:30", toast: { log.items.append($0) }) }
        await u1.value; await u2.value
        #expect(log.items == ["Visszatettem 17:30-ra"])
    }

    @Test func nowMarkerOnlyInsideTheDay() {
        #expect(nowFraction(minutes: 360) == 0)
        #expect(nowFraction(minutes: 900) == 0.5)
        #expect(nowFraction(minutes: 300) == nil)
    }

    @Test func aMovedSessionHasNoConflictToShow() {
        #expect(sessionMoved(planned: "17:30", time: "18:30"))
        #expect(!sessionMoved(planned: "17:30", time: "17:30"))
        #expect(!sessionMoved(planned: nil, time: "18:30"))
    }

    // MARK: A napom

    @Test func theFullDayShowsEveryStationAsAQuietRow() {
        let steps = [
            PathStep(id: "wake", time: "06:17", glyph: "sun-ink", title: "Ébredés", sub: "", done: true, isNow: false),
            PathStep(id: "now", time: "08:40", glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true),
            PathStep(id: "session", time: "17:30", glyph: "dumbbell-ink", title: "Vállak és hát", sub: "60 perc",
                     done: false, isNow: false, opens: true),
        ]
        let st = quietStations(steps)
        #expect(st.map(\.id) == ["wake", "now", "session"])
        #expect(st.allSatisfy { !$0.opens })
        #expect(st[1].isNow && st[0].done)
    }
}

@MainActor final class ToastLog { var items: [String] = [] }
