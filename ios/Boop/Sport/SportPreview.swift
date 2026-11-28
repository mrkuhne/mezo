#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (`-preview shell -previewHome sport`, `mezo-r36n9.203`): the sport endpoints answered locally
/// with an invented, real-looking week (four evenings of volleyball beside five gym mornings) — never the owner's. The
/// Mac's firewall blocks the simulator app's network, so this is how the Sport area is looked at.
///
/// - `-sportMoment before|recorded|done|skipped|nosport|sportonly` (default `before`): tonight's volleyball before the
///   game · the watch recorded it · logged · skipped · a gym-only day („Ma nincs sport" + the next one) · a sport-only day.
/// - `-sportState ready|empty|loading|error|offline` (default `ready`): no rhythm and no sport yet · the first read
///   never answers · the server failing · no net with the week cached five hours ago.
/// - `-sportSheet log|skip`: the room opens with that sheet up.
/// A skip and its undo change the transport's week, so the room's re-read shows the server's own picture.
enum SportPreview {
    static var moment: String { UserDefaults.standard.string(forKey: "sportMoment") ?? "before" }
    static var state: String { UserDefaults.standard.string(forKey: "sportState") ?? "ready" }

    static let raw = RawJSONClient(transport: SportPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })

    @MainActor static func store(cache: ServerCache?) -> SportStore {
        let store = SportStore(client: SportClient(raw: raw), cache: nil)
        if state == "offline" { store.debugShow(week(), offline: true, age: 5 * 3600) }
        return store
    }

    private static var zone: TimeZone { TimeZone(identifier: "Europe/Budapest") ?? .current }

    private static func ymd(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = zone; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }

    /// The fixture's week around today: Monday..Sunday, today's sport per `-sportMoment`.
    static func week(skippedId: String? = nil) -> SportOverview {
        var cal = Calendar(identifier: .iso8601); cal.timeZone = zone
        let now = Date()
        let monday = cal.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        let dates = (0..<7).map { ymd(cal.date(byAdding: .day, value: $0, to: monday) ?? now) }
        let today = ymd(now)
        let ti = dates.firstIndex(of: today) ?? 2
        let m = skippedId != nil ? "skipped" : moment

        let gymNames = ["Hát", "Láb + kar", "Mell + bicepsz", "Bicepsz fókusz", "Tricepsz + core"]
        let sportDays: Set<Int> = m == "nosport" ? Set([0, 1, 4].filter { $0 != ti } + (ti < 6 ? [ti + 1] : [])) : Set([0, 1, 4].filter { $0 != ti } + [ti])
        let gymDays: Set<Int> = m == "sportonly" ? Set([0, 1, 2, 3, 4].filter { $0 != ti }) : Set([0, 1, 2, 3, 4] + [ti])
        var days: [SportWeekDay] = []
        var done = 0, planned = 0
        for (i, date) in dates.enumerated() {
            var gym: [SportLaneItem] = []
            if gymDays.contains(i) {
                gym.append(SportLaneItem(layer: "GYM", label: gymNames[i % gymNames.count], time: "07:00", durationMin: 70,
                                         state: i <= ti ? "DONE" : "PLANNED"))
            }
            var sport: [SportLaneItem] = []
            if sportDays.contains(i) {
                planned += 1
                let state: String
                if i < ti { state = "DONE" } else if i > ti { state = "PLANNED" } else {
                    state = m == "done" ? "DONE" : m == "skipped" ? "SKIPPED" : "PLANNED"
                }
                if state == "DONE" { done += 1 }
                sport.append(SportLaneItem(layer: "SPORT", sport: "VOLLEYBALL", time: "18:00", durationMin: 120, state: state,
                                           load: state == "DONE" ? (i == ti ? 819 : [780, 840, 600][i % 3]) : nil,
                                           skipId: state == "SKIPPED" ? (skippedId ?? "preview-skip") : nil))
            }
            days.append(SportWeekDay(date: date, gym: gym, sport: sport))
        }

        var tonight: SportTonight?
        if m != "nosport" {
            let health = SportHealthWorkout(activityType: "volleyball", start: "\(today)T17:04:00Z", minutes: 117, kcal: 812, avgHr: 138)
            switch m {
            case "recorded":
                tonight = SportTonight(sport: "VOLLEYBALL", time: "18:00", durationMin: 120, kind: "practice", location: "Sportcsarnok",
                                       moment: "RECORDED", health: health)
            case "done":
                tonight = SportTonight(sport: "VOLLEYBALL", time: "18:00", durationMin: 120, kind: "practice", location: "Sportcsarnok",
                                       moment: "DONE", health: health,
                                       session: SportLoggedSession(id: "s1", sport: "VOLLEYBALL", durationMin: 117, rpe: 7, load: 819,
                                                                   kcal: 812, setsPlayed: 5, shoulderStrain: 6))
            case "skipped":
                tonight = SportTonight(sport: "VOLLEYBALL", time: "18:00", durationMin: 120, kind: "practice", location: "Sportcsarnok",
                                       moment: "SKIPPED",
                                       skip: SportSkipInfo(id: skippedId ?? "preview-skip", reason: "TIRED", freePass: true))
            default:
                tonight = SportTonight(sport: "VOLLEYBALL", time: "18:00", durationMin: 120, kind: "practice", location: "Sportcsarnok",
                                       moment: "BEFORE", startsInMinutes: 380)
            }
        }
        var hints: [SportHint] = []
        if ti + 1 < 7, gymDays.contains(ti + 1), sportDays.contains(ti) {
            hints.append(SportHint(key: "SPORT_BEFORE_LEG_MORNING", date: dates[ti + 1], severity: "WATCH", sport: "VOLLEYBALL",
                                   heavy: m == "done"))
        }
        return SportOverview(weekStart: dates[0], weekEnd: dates[6], today: today, days: days,
                             totals: SportWeekTotals(gymMinutes: 70 * gymDays.count, sportMinutes: 120 * done,
                                                     movementMinutes: 70 * gymDays.count + 120 * done,
                                                     gymSessions: gymDays.count, sportSessions: done),
                             weekCount: SportWeekCount(done: done, planned: planned), tonight: tonight, hints: hints)
    }

    /// No rhythm and nothing logged: the empty state.
    static func emptyWeek() -> SportOverview {
        let w = week()
        return SportOverview(weekStart: w.weekStart, weekEnd: w.weekEnd, today: w.today,
                             days: w.days.map { SportWeekDay(date: $0.date, gym: $0.gym) })
    }
}

/// The preview's server: the week, a skip and its undo. Remembers a skip for the room's re-read.
final class SportPreviewTransport: ClientTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var skipped: String?

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        let state = SportPreview.state
        if state == "loading" { try await Task.sleep(for: .seconds(3600)) }
        try await Task.sleep(for: .milliseconds(300))
        if state == "offline" { throw URLError(.notConnectedToInternet) }
        if state == "error" { return (HTTPResponse(status: .internalServerError), nil) }
        func json<T: Encodable>(_ value: T, _ status: Int = 200) throws -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(try JSONEncoder().encode(value)))
        }
        switch operationID {
        case "getSportOverview":
            let skip = lock.withLock { skipped }
            return try json(state == "empty" ? SportPreview.emptyWeek() : SportPreview.week(skippedId: skip))
        case "upsertPlannedSkip":
            let id = "preview-skip-\(Int(Date().timeIntervalSince1970))"
            lock.withLock { skipped = id }
            return try json(PreviewSkip(id: id, reasonCategory: "TIRED", freePass: true, serious: false))
        case "undoPlannedSkip":
            lock.withLock { skipped = nil }
            return (HTTPResponse(status: .noContent), nil)
        default:
            return (HTTPResponse(status: .notFound), nil)
        }
    }

    private struct PreviewSkip: Encodable { let id: String; let reasonCategory: String; let freePass: Bool; let serious: Bool }
}
#endif
