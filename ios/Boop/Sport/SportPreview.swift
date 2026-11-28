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
/// - `-sportSheet log|skip|slot|slotNew|event|eventNew|edit|why`: the room opens with that sheet up (slot / event = the first one; edit = the first Napló session, why = the first Test hint).
/// - `-sportSaveFail YES`: every Hét write fails (the sheet keeps what was entered and offers a retry).
/// - `-sportJournalEmpty YES`: the Napló has nothing logged yet (S5). `-sportMap Együtt|Kondi|Röpi` picks the Test map.
/// A skip and its undo change the transport's week, so the room's re-read shows the server's own picture.
enum SportPreview {
    static var moment: String { UserDefaults.standard.string(forKey: "sportMoment") ?? "before" }
    static var state: String { UserDefaults.standard.string(forKey: "sportState") ?? "ready" }

    static let raw = RawJSONClient(transport: SportPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })

    @MainActor static func store(cache: ServerCache?) -> SportStore {
        let store = SportStore(client: SportClient(raw: raw), cache: nil)
        if state == "offline" {
            store.debugShow(week(), offline: true, age: 5 * 3600)
            store.schedule.debugShow(slots: slots, events: events(), load: load(), offline: true)
            store.journal.debugShow(journal(), offline: true)
            store.bodyWeek.debugShow(body: body(), shoulder: shoulder(), gaps: gaps(), offline: true)
        }
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
        var hints: [SportHint] = [SportHint(key: "SPORT_LOAD_DECLINE", date: today, severity: "INFO", sport: "VOLLEYBALL", pairs: 2)]
        if let d = [0, 1, 4].first(where: { $0 > ti && gymDays.contains($0) && sportDays.contains($0) }) {
            hints.append(SportHint(key: "GAP_SHORT", date: dates[d], severity: "WATCH", sport: "VOLLEYBALL", gapHours: 4.5))
        }
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

    /// The rhythm behind the fixture week: volleyball Monday, Tuesday and Friday evening, plus today's when it has one.
    static let slots: [SportSlot] = [
        SportSlot(id: "slot-1", dayOfWeek: 0, time: "18:00", durationMin: 120, kind: "training", location: "Sportcsarnok"),
        SportSlot(id: "slot-2", dayOfWeek: 1, time: "18:00", durationMin: 120, kind: "training", location: "Sportcsarnok"),
        SportSlot(id: "slot-3", dayOfWeek: 2, time: "18:00", durationMin: 120, kind: "training", location: "Sportcsarnok"),
        SportSlot(id: "slot-4", dayOfWeek: 4, time: "19:30", durationMin: 90, kind: "match", location: "Budaörs"),
    ]

    static func events() -> [SportEvent] {
        let today = week().today
        return [SportEvent(id: "event-1", date: sportAddDays(today, 15), time: "09:00", durationMin: 360, kind: "match",
                           sport: "volleyball", location: "Budaörs")]
    }

    static func load() -> SportLoad {
        let monday = week().weekStart
        let rows: [(Int, Int, Int)] = [(1900, 2100, 0), (2050, 900, 0), (2200, 0, 0), (2300, 1500, 1), (2350, 2400, 0), (1400, 1640, 0)]
        return SportLoad(weeks: rows.enumerated().map { i, r in
            SportLoadWeek(weekStart: sportAddDays(monday, (i - 5) * 7), sportLoad: r.1, gymLoad: r.0,
                          sportSessions: r.1 / 600, gymSessions: 5, sportUnknown: r.2)
        })
    }

    /// Napló (S5): about five weeks of volleyball (Monday, Tuesday, Friday) and one run, newest first.
    static func journal() -> [SportSessionRecord] {
        if UserDefaults.standard.bool(forKey: "sportJournalEmpty") || state == "empty" { return [] }
        let w = week()
        var out: [SportSessionRecord] = []
        let rpes: [Double] = [6, 7, 5, 7, 8, 6, 7, 6, 8, 7, 6, 7, 7, 6, 7]
        let shoulders = [5, 6, 4, 7, 8, 6, 6, 5, 7, 6, 5, 6, 6, 5, 6]
        var n = 0
        for back in 0..<5 {
            let monday = sportAddDays(w.weekStart, -7 * back)
            for (off, time) in [(0, "18:00"), (1, "18:00"), (4, "19:30")] {
                let date = sportAddDays(monday, off)
                guard date < w.today else { continue }
                let i = n % rpes.count
                out.append(SportSessionRecord(id: "j\(n)", sport: "volleyball", date: date, time: time, duration: off == 4 ? 90 : 117,
                                              setsPlayed: off == 4 ? 4 : 5, rpe: rpes[i], shoulderStrain: shoulders[i],
                                              notes: n == 1 ? "sok ütés a hálónál" : nil, kcal: off == 4 ? 520 : 812,
                                              kcalIsEstimate: off == 4))
                n += 1
            }
        }
        out.append(SportSessionRecord(id: "run1", sport: "running", date: sportAddDays(w.weekStart, -9), time: "07:10", duration: 35,
                                      rpe: 5, kcal: 330, kcalIsEstimate: true))
        return sportJournalSorted(out)
    }
    static func body() -> SportBodyWeek {
        let m: [(String, Double, Double)] = [("chest-mid", 0.7, 0), ("back-wide", 0.8, 0), ("shoulder-front", 0.5, 0.7),
                                             ("shoulder-side", 0.6, 0.8), ("shoulder-rear", 0, 0.6), ("biceps-long", 0.5, 0),
                                             ("triceps-long", 0.45, 0), ("quad", 0.75, 0.7), ("ham", 0.55, 0), ("glute", 0.6, 0.35),
                                             ("calf", 0, 0.95), ("core", 0, 0.5)]
        return SportBodyWeek(weekStart: week().weekStart,
                             muscles: m.map { SportMuscleHeat(muscle: $0.0, gymLoad: Int($0.1 * 1000), sportLoad: Int($0.2 * 1000),
                                                              gym: $0.1, sport: $0.2, together: min(1, $0.1 + $0.2 * 0.6)) },
                             sharedMuscles: 4, shoulderAverage: 5.8, sportUnknown: 1)
    }
    static func shoulder() -> SportShoulder {
        let monday = week().weekStart
        let v: [Double?] = [5.2, 5.5, nil, 6.1, 7.2, 6.0]
        return SportShoulder(weeks: v.enumerated().map { i, x in
            SportShoulderWeek(weekStart: sportAddDays(monday, (i - 5) * 7), average: x, sessions: x == nil ? 0 : 3)
        })
    }
    static func gaps() -> SportGaps {
        let w = week()
        let days = w.days.map { d -> SportGapDay in
            var blocks: [SportBlock] = d.gym.map { SportBlock(layer: "GYM", start: "07:00", end: "08:10", done: $0.state == "DONE") }
            blocks += d.sport.map { s in
                SportBlock(layer: "SPORT", sport: "VOLLEYBALL", start: s.time ?? "18:00", end: s.time == "19:30" ? "21:00" : "20:00",
                           done: s.state == "DONE")
            }
            let both = !d.gym.isEmpty && !d.sport.isEmpty
            return SportGapDay(date: d.date, blocks: blocks, gapHours: both ? 9.8 : nil)
        }
        return SportGaps(weekStart: w.weekStart, days: days)
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
    private var slots: [SportSlot]?
    private var events: [SportEvent]?
    private var journal: [SportSessionRecord]?

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
        case "getSportSchedule":
            return try json(lock.withLock { slots } ?? (state == "empty" ? [] : SportPreview.slots))
        case "replaceSportSchedule":
            if UserDefaults.standard.bool(forKey: "sportSaveFail") { throw URLError(.notConnectedToInternet) }
            let sent = try JSONDecoder().decode([SportSlotInput].self, from: try await Data(collecting: body ?? HTTPBody(), upTo: 1 << 20))
            let saved = sent.enumerated().map { i, x in
                SportSlot(id: "slot-\(i)-\(Int(Date().timeIntervalSince1970))", dayOfWeek: x.dayOfWeek, time: x.time, durationMin: x.durationMin,
                          kind: x.kind, location: x.location, intensityLabel: x.intensityLabel, sport: x.sport)
            }
            lock.withLock { slots = saved }
            return try json(saved)
        case "listSportEvents":
            return try json(lock.withLock { events } ?? (state == "empty" ? [] : SportPreview.events()))
        case "createSportEvent":
            if UserDefaults.standard.bool(forKey: "sportSaveFail") { throw URLError(.notConnectedToInternet) }
            let d = try JSONDecoder().decode(SportEventDraft.self, from: try await Data(collecting: body ?? HTTPBody(), upTo: 1 << 20))
            let e = SportEvent(id: "event-\(Int(Date().timeIntervalSince1970))", date: d.date, time: d.time, durationMin: d.durationMin,
                               kind: d.kind, sport: d.sport, location: d.location)
            lock.withLock { events = ((events ?? SportPreview.events()) + [e]).sorted { $0.date < $1.date } }
            return try json(e, 201)
        case "deleteSportEvent":
            if UserDefaults.standard.bool(forKey: "sportSaveFail") { throw URLError(.notConnectedToInternet) }
            let id = String(request.path?.split(separator: "/").last ?? "")
            lock.withLock { events = (events ?? SportPreview.events()).filter { $0.id != id } }
            return (HTTPResponse(status: .noContent), nil)
        case "getSportLoad":
            return try json(state == "empty" ? SportLoad(weeks: []) : SportPreview.load())
        case "listSportSessions":
            return try json(lock.withLock { journal } ?? SportPreview.journal())
        case "updateSportSession":
            if UserDefaults.standard.bool(forKey: "sportSaveFail") { throw URLError(.notConnectedToInternet) }
            let id = String(request.path?.split(separator: "/").last ?? "")
            let e = try JSONDecoder().decode(PreviewEdit.self, from: try await Data(collecting: body ?? HTTPBody(), upTo: 1 << 20))
            let list = lock.withLock { journal } ?? SportPreview.journal()
            guard let old = list.first(where: { $0.id == id }) else { return (HTTPResponse(status: .notFound), nil) }
            let saved = SportSessionRecord(id: id, sport: e.sport, date: old.date, time: old.time, duration: e.duration,
                                           setsPlayed: e.setsPlayed, rounds: e.rounds, rpe: e.rpe, shoulderStrain: e.shoulderStrain,
                                           notes: e.notes, kcal: e.kcalOverride ?? Int(Double(e.duration) * 6.5),
                                           kcalIsEstimate: e.kcalOverride == nil)
            lock.withLock { journal = list.map { $0.id == id ? saved : $0 } }
            return try json(saved)
        case "deleteSportSession":
            if UserDefaults.standard.bool(forKey: "sportSaveFail") { throw URLError(.notConnectedToInternet) }
            let id = String(request.path?.split(separator: "/").last ?? "")
            lock.withLock { journal = (journal ?? SportPreview.journal()).filter { $0.id != id } }
            return (HTTPResponse(status: .noContent), nil)
        case "getSportBody":
            return try json(state == "empty" ? SportBodyWeek(weekStart: SportPreview.week().weekStart) : SportPreview.body())
        case "getSportShoulder":
            return try json(state == "empty" ? SportShoulder(weeks: []) : SportPreview.shoulder())
        case "getSportGaps":
            return try json(state == "empty" ? SportGaps(weekStart: SportPreview.week().weekStart) : SportPreview.gaps())
        default:
            return (HTTPResponse(status: .notFound), nil)
        }
    }

    private struct PreviewEdit: Decodable {
        let sport: String; let duration: Int; let setsPlayed: Int?; let rounds: Int?; let rpe: Double
        let shoulderStrain: Int?; let notes: String?; let kcalOverride: Int?
    }
    private struct PreviewSkip: Encodable { let id: String; let reasonCategory: String; let freePass: Bool; let serious: Bool }
}
#endif
