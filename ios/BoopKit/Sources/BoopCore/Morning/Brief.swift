import Foundation
import BoopAPI

/// The five metrics, keyed as the backend sends them. Same cases and order as BoopDesign's `Hue`
/// (BoopCore does not import BoopDesign; the app layer bridges `MetricKey.rawValue` ↔ `Hue`).
public enum MetricKey: String, CaseIterable, Sendable { case forma, alvas, mozgas, fuel, pulzus }

/// Plain mirror of the backend's `BoopBrief` (the generated types stay inside BoopCore).
/// Optional = the server says "no data" (null).
public struct Brief: Sendable, Equatable {
    public struct Metric: Sendable, Equatable {
        public let key: MetricKey
        public let score: Int?
        public let display: String
        public let caption: String?
        public let headline: String
        public let sentence: String
        public let trendUp: Bool?
    }
    public enum State: String, Sendable { case good, okay, tired, learning }
    public enum Link: String, Sendable { case sleep, heart, day }
    public struct Line: Sendable, Equatable {
        public let text: String; public let link: Link?
        public init(text: String, link: Link?) { self.text = text; self.link = link }
    }
    public struct Energy: Sendable, Equatable { public let hourly: [Double]; public let dipHour: Int? }
    public struct Conflict: Sendable, Equatable { public let text: String; public let suggestedTime: String }
    public struct Segment: Sendable, Equatable { public let stage: Int; public let minutes: Int }
    public struct Sleep: Sendable, Equatable {
        /// Null when the night was logged without times (the sleep API allows it).
        public let bedtime: String?, wakeup: String?
        public let totalMin: Int
        public let deepMin, remMin, lightMin, awakeMin: Int?
        public let hypnogram: [Segment]
    }
    public struct HrToday: Sendable, Equatable { public let min, avg, max: Int? }
    public struct Exercise: Sendable, Equatable { public let name: String; public let sets: Int }
    public struct Session: Sendable, Equatable {
        public let title: String
        public var time: String?
        public let plannedTime: String?
        public let minutes: Int?
        public let exercises: [Exercise]
        /// B3: finished today (train/sport log or a wearable workout in the planned window).
        public var done: Bool = false
        /// Minutes / average HR of what was actually done (HR nil when the source has none).
        public var doneMinutes: Int?
        public var avgHr: Int?
    }
    public struct Meal: Sendable, Equatable { public let time, title: String; public let kcal, proteinG: Int; public let logged: Bool }
    public struct Checkin: Sendable, Equatable {
        public enum Slot: String, Sendable { case morning, midday, afternoon, evening }
        public let slot: Slot
        public let time: String
        public let done: Bool
        public let summary: String?
    }
    public struct Intention: Sendable, Equatable { public let creed: String?; public let foci: [String] }
    public struct Observation: Sendable, Equatable, Identifiable {
        public let id: String
        public let lead, bold, tail: String
        public let strength: Int
    }
    public struct CalendarDay: Sendable, Equatable {
        public let count: Int
        /// 72 slots, 06:00–24:00 in 15-minute steps; true = busy.
        public let busySlots: [Bool]
    }
    public struct Weight: Sendable, Equatable { public let kg, trendKg: Double }
    public struct Recovery: Sendable, Equatable { public let reason: String; public let day: Int }
    public struct Day: Sendable, Equatable {
        public let sleep: Sleep?
        public let bedtimeTarget: String?
        public let deepSleepWeek: [Int?]
        public let restingHrWeek: [Int?]
        public let hrToday: HrToday?
        /// Null = no wearable day yet (never a fake 0).
        public let steps: Int?
        public let stepsGoal: Int
        public let activeKcal: Int?
        public var session: Session?
        public let meals: [Meal]
        public let kcalSoFar, kcalTarget, proteinG, proteinTarget, carbsG, fatG: Int
        public let checkins: [Checkin]
        public let intention: Intention
        public var observations: [Observation]
        public let calendar: CalendarDay
        public let weight: Weight?
        public let recovery: Recovery?
    }

    public let date: String
    public let generatedAt: Date
    public let state: State
    public let nightsKnown: Int
    public let metrics: [Metric]
    public let brief: [Line]
    public let energy: Energy
    public let tonightTip: String
    public let nextMealTip: String?
    public let conflict: Conflict?
    public var day: Day

    /// The metric of a key. The server always sends all five; a missing one reads as "no data".
    public func metric(_ key: MetricKey) -> Metric {
        metrics.first { $0.key == key }
            ?? Metric(key: key, score: nil, display: "–", caption: nil, headline: "", sentence: "", trendUp: nil)
    }
}

extension Brief {
    init(_ b: Components.Schemas.BoopBrief) {
        let d = b.day
        self.init(
            date: b.date, generatedAt: b.generatedAt, state: State(rawValue: b.state.rawValue) ?? .learning,
            nightsKnown: b.nightsKnown,
            metrics: b.metrics.compactMap { m in
                MetricKey(rawValue: m.key.rawValue).map {
                    Metric(key: $0, score: m.score, display: m.display, caption: m.caption, headline: m.headline,
                           sentence: m.sentence, trendUp: m.trendUp)
                }
            },
            brief: b.brief.map { Line(text: $0.text, link: $0.link.flatMap { Link(rawValue: $0.rawValue) }) },
            energy: Energy(hourly: b.energy.hourly, dipHour: b.energy.dipHour),
            tonightTip: b.tonightTip, nextMealTip: b.nextMealTip,
            conflict: b.conflict.map { Conflict(text: $0.text, suggestedTime: $0.suggestedTime) },
            day: Day(
                sleep: d.sleep.map { s in
                    Sleep(bedtime: s.bedtime, wakeup: s.wakeup, totalMin: s.totalMin, deepMin: s.deepMin, remMin: s.remMin,
                          lightMin: s.lightMin, awakeMin: s.awakeMin,
                          hypnogram: s.hypnogram.map { Segment(stage: $0.stage, minutes: $0.minutes) })
                },
                bedtimeTarget: d.bedtimeTarget, deepSleepWeek: d.deepSleepWeek, restingHrWeek: d.restingHrWeek,
                hrToday: d.hrToday.map { HrToday(min: $0.min, avg: $0.avg, max: $0.max) },
                steps: d.steps, stepsGoal: d.stepsGoal, activeKcal: d.activeKcal,
                session: d.session.map { s in
                    Session(title: s.title, time: s.time, plannedTime: s.plannedTime, minutes: s.minutes,
                            exercises: s.exercises.map { Exercise(name: $0.name, sets: $0.sets) },
                            done: s.done ?? false, doneMinutes: s.doneMinutes, avgHr: s.avgHr)
                },
                meals: d.meals.map { Meal(time: $0.time, title: $0.title, kcal: $0.kcal, proteinG: $0.proteinG, logged: $0.logged) },
                kcalSoFar: d.kcalSoFar, kcalTarget: d.kcalTarget, proteinG: d.proteinG, proteinTarget: d.proteinTarget,
                carbsG: d.carbsG, fatG: d.fatG,
                checkins: d.checkins.compactMap { c in
                    Checkin.Slot(rawValue: c.slot.rawValue).map { Checkin(slot: $0, time: c.time, done: c.done, summary: c.summary) }
                },
                intention: Intention(creed: d.intention.creed, foci: d.intention.foci),
                observations: d.observations.map { Observation(id: $0.id, lead: $0.lead, bold: $0.bold, tail: $0.tail, strength: $0.strength) },
                calendar: CalendarDay(count: d.calendar.count, busySlots: d.calendar.busySlots),
                weight: d.weight.map { Weight(kg: $0.kg, trendKg: $0.trendKg) },
                recovery: d.recovery.map { Recovery(reason: $0.reason, day: $0.day) }
            )
        )
    }
}

extension Brief {
    /// Decodes the server's brief JSON (ISO-8601 dates) through the same mapping the client uses; app tests build
    /// their fixtures this way.
    public init(json: Data) throws {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        self.init(try d.decode(Components.Schemas.BoopBrief.self, from: json))
    }
}
