import Foundation
import Testing
@testable import BoopCore

/// The Megvolt sheet's pure parts (`mezo-r36n9.161`, spec §3.6): what each exercise row says, which rows need a typed
/// weight, the default start time, and the payload that carries only the typed overrides.
struct AsPlannedTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    func at(_ s: String) -> Date {
        let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)!
    }
    let row = UUID(), curl = UUID(), face = UUID(), template = UUID()

    func workout() -> TodayWorkout {
        TodayWorkout(templateSessionId: template, dayLabel: "Hét", title: "Pull Day", exercises: [
            PlannedExercise(id: row, name: "Evezés", muscle: "hát", type: .compound,
                            sets: [PrescribedSet(kind: .warmup, targetKg: 40, targetReps: 8), PrescribedSet(kind: .working, targetKg: 60, targetReps: 8)],
                            warmupCount: 1, workingCount: 3, repMin: 6, repMax: 8, targetRIR: 1),
            PlannedExercise(id: curl, name: "Bicepsz", muscle: "kar", type: .isolation,
                            sets: [PrescribedSet(kind: .working, targetKg: 12.5, targetReps: 12)],
                            warmupCount: 0, workingCount: 3, repMin: 10, repMax: 12, targetRIR: 1),
            PlannedExercise(id: face, name: "Face pull", muscle: "hát", type: .isolation,
                            sets: [PrescribedSet(kind: .working, targetKg: nil, targetReps: 15)],
                            warmupCount: 0, workingCount: 3, repMin: 12, repMax: 15, targetRIR: 1),
        ])
    }

    @Test func rowsSayTheSetsRepsAndWeight() {
        let rows = asPlannedRows(workout(), overrides: [:])
        #expect(rows.map(\.name) == ["Evezés", "Bicepsz", "Face pull"])
        #expect(rows.map(\.setsText) == ["3 × 8 · 60 kg", "3 × 12 · 12,5 kg", "3 × 15 · – kg · írd be"])
        #expect(rows.map(\.needsWeight) == [false, false, true])
    }

    @Test func anOverrideShowsAndATypedWeightBooksAnUnprescribedExercise() {
        let rows = asPlannedRows(workout(), overrides: [row: 62.5, face: 20])
        #expect(rows[0].setsText == "3 × 8 · 62,5 kg")
        #expect(rows[2].setsText == "3 × 15 · 20 kg")
        #expect(rows[2].needsWeight == false)
    }

    @Test func defaultTimeIsThePlansElseSixInTheEvening() {
        #expect(asPlannedDefaultTime(session: "17:30", on: "2026-11-23", calendar: cal) == at("2026-11-23 17:30"))
        #expect(asPlannedDefaultTime(session: nil, on: "2026-11-23", calendar: cal) == at("2026-11-23 18:00"))
        #expect(asPlannedDefaultTime(session: "nonsense", on: "2026-11-23", calendar: cal) == at("2026-11-23 18:00"))
    }

    @Test func thePayloadKeepsOnlyTypedOverrides() {
        let p = asPlannedPayload(workout: workout(), date: "2026-11-23", startedAt: at("2026-11-23 18:00"), overrides: [face: 20])
        #expect(p?.templateSessionId == template)
        #expect(p?.date == "2026-11-23")
        #expect(p?.startedAt == at("2026-11-23 18:00"))
        #expect(p?.overrides == [WorkoutAsPlannedPayload.Override(exerciseId: face, weightKg: 20)])
        #expect(asPlannedPayload(workout: TodayWorkout(), date: "2026-11-23", startedAt: at("2026-11-23 18:00"), overrides: [:]) == nil)
    }


    /// The Napló's gym door reads the queue too (spec §3.6): a booking still waiting counts, one the server refused
    /// does not, and other kinds of items are not bookings.
    @Test func queuedBookingsAreReadWithoutTheFailedOnes() {
        let kept = WorkoutAsPlannedPayload(templateSessionId: template, date: "2026-11-23", startedAt: at("2026-11-23 18:00"), overrides: [])
        let refused = WorkoutAsPlannedPayload(templateSessionId: template, date: "2026-11-22", startedAt: at("2026-11-22 18:00"), overrides: [])
        let items = [
            OutboxItem(kind: .workoutAsPlanned, date: kept.date, capturedAt: kept.startedAt, payload: TrainPayloadCodec.encode(kept)),
            OutboxItem(kind: .workoutAsPlanned, date: refused.date, capturedAt: refused.startedAt,
                       payload: TrainPayloadCodec.encode(refused), failure: "Ezt az edzésnapot ezen a héten már teljesítetted."),
            OutboxItem(kind: .journal, date: "2026-11-23", capturedAt: at("2026-11-23 18:00"), payload: Data()),
        ]
        #expect(asPlannedBookings(in: items) == [kept])
    }

    /// The gym door stays away when the booking could not land (spec §3.4, §3.6): the template day done on any day of
    /// the date's Mon–Sun week (the server's once-a-week rule), or a booking for it still in the queue.
    @Test func theGymDayIsDoneFromTheWeeksHistoryOrAQueuedBooking() {
        let week = (from: "2026-11-23", to: "2026-11-29")
        let other = UUID()
        func day(_ date: String, _ id: UUID?, _ status: WorkoutStatus = .completed) -> WorkoutHistoryDay {
            WorkoutHistoryDay(id: UUID(), templateSessionId: id, date: date, status: status, origin: .meso, title: "Pull Day")
        }
        #expect(gymDone(templateSessionId: template, week: week, history: [day("2026-11-25", template)], queued: []))
        #expect(!gymDone(templateSessionId: template, week: week,
                         history: [day("2026-11-25", other), day("2026-11-22", template), day("2026-11-24", template, .active)], queued: []))
        let booked = WorkoutAsPlannedPayload(templateSessionId: template, date: "2026-11-24", startedAt: at("2026-11-24 18:00"), overrides: [])
        let lastWeek = WorkoutAsPlannedPayload(templateSessionId: template, date: "2026-11-20", startedAt: at("2026-11-20 18:00"), overrides: [])
        #expect(gymDone(templateSessionId: template, week: week, history: [], queued: [booked]))
        #expect(!gymDone(templateSessionId: template, week: week, history: [], queued: [lastWeek]))
    }
}
