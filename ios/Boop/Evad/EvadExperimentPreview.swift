#if DEBUG
import Foundation
import BoopCore

/// Simulator review of the Hatás tab (Évad S4): experiments answered locally with the approved spike's invented,
/// real-looking content ("például") — a proposal (evening magnesium), a running one in its ninth day with a new training
/// block overlapping, and three finished ones: a clear result already kept, one with no noticeable change (finished
/// yesterday, so the Ma wall shows „Kész a kísérlet"), one with too few days. Stateful for the run: Indulhat, Most nem,
/// the day chips, Leállítom, Megtartom and Új kísérlet all show their effect. `-evadExp empty` = nothing at all (the empty
/// state); `-evadExp noProposal` = no proposal.
final class EvadExperimentPreviewModel: @unchecked Sendable {
    nonisolated(unsafe) static let shared = EvadExperimentPreviewModel()

    let mode = UserDefaults.standard.string(forKey: "evadExp") ?? "full"
    var proposal: [String: Any]?
    var running: [String: Any]?
    var past: [[String: Any]] = []

    static func day(_ offset: Int) -> String {
        EvadPreviewModel.iso(Calendar.current.date(byAdding: .day, value: offset, to: Date())!)
    }

    init() {
        guard mode != "empty" else { return }
        if mode != "noProposal" {
            proposal = Self.experiment(id: "ex000000-0000-4000-8000-000000000001", kind: "supplement", title: "Esti magnézium",
                                       reason: "Hétfő óta szedsz esti magnéziumot.", status: "proposed",
                                       watched: ["sleep_min", "resting_hr", "morning_feel"])
        }
        var r = Self.experiment(id: "ex000000-0000-4000-8000-000000000002", kind: "habit", title: "Este 9 után nincs telefon",
                                status: "running", watched: ["sleep_min", "deep_min", "resting_hr"])
        r["startDate"] = Self.day(-8); r["endDate"] = Self.day(5); r["dayIndex"] = 9
        r["markedDays"] = (-8 ... -1).map(Self.day)
        r["overlaps"] = [["kind": "mesocycle", "date": Self.day(-3), "text": "Közben új edzésblokk indult"]]
        running = r

        var walk = Self.experiment(id: "ex000000-0000-4000-8000-000000000003", kind: "habit", title: "Reggeli séta",
                                   status: "done", watched: ["sleep_min", "deep_min", "hrv_ms", "resting_hr", "morning_feel"])
        walk["startDate"] = Self.day(-40); walk["endDate"] = Self.day(-27); walk["finishedOn"] = Self.day(-26)
        walk["kept"] = true
        walk["result"] = ["verdict": "clear", "baselineFrom": Self.day(-54), "baselineTo": Self.day(-41), "markedCount": 13,
                          "signals": [
                            Self.signal("sleep_min", 410, 432, clear: true, better: true),
                            Self.signal("deep_min", 58, 71, clear: true, better: true),
                            Self.signal("hrv_ms", 41, 43),
                            Self.signal("resting_hr", 54, 53),
                            Self.signal("morning_feel", 6.1, 6.8, clear: true, better: true),
                          ]]
        var carbs = Self.experiment(id: "ex000000-0000-4000-8000-000000000004", kind: "food", title: "Késő esti szénhidrát",
                                    status: "done", watched: ["sleep_min", "energy", "mood"])
        carbs["startDate"] = Self.day(-14); carbs["endDate"] = Self.day(-1); carbs["finishedOn"] = Self.day(-1)
        carbs["overlaps"] = [["kind": "kimelo", "date": Self.day(-9), "text": "Közben két napig kímélő módban voltál"]]
        carbs["result"] = ["verdict": "none", "baselineFrom": Self.day(-28), "baselineTo": Self.day(-15), "markedCount": 12,
                           "signals": [Self.signal("sleep_min", 425, 431), Self.signal("energy", 6.4, 6.2),
                                       Self.signal("mood", 7.0, 7.1)]]
        var water = Self.experiment(id: "ex000000-0000-4000-8000-000000000005", kind: "habit", title: "Napi 3 liter víz",
                                    length: 10, status: "done", watched: ["energy", "morning_feel"])
        water["needDays"] = 7
        water["startDate"] = Self.day(-70); water["endDate"] = Self.day(-61); water["finishedOn"] = Self.day(-60)
        water["result"] = ["verdict": "insufficient", "baselineFrom": Self.day(-80), "baselineTo": Self.day(-71),
                           "markedCount": 4, "signals": [Self.signal("energy", 6.0, 6.3, nAfter: 4)]]
        past = [carbs, walk, water]
    }

    static func experiment(id: String, kind: String, title: String, reason: String? = nil, length: Int = 14,
                           status: String, watched: [String]) -> [String: Any] {
        ["id": id, "subjectKind": kind, "subjectRef": NSNull(), "title": title, "reason": reason.map { $0 as Any } ?? NSNull(),
         "startDate": NSNull(), "endDate": NSNull(), "lengthDays": length, "status": status, "dayIndex": NSNull(),
         "markedDays": [String](), "needDays": Int((0.7 * Double(length)).rounded(.up)), "watched": watched,
         "overlaps": [[String: Any]](), "result": NSNull(), "finishedOn": NSNull(), "kept": false]
    }

    static func signal(_ key: String, _ before: Double, _ after: Double, clear: Bool = false, better: Bool? = nil,
                       nAfter: Int = 13) -> [String: Any] {
        ["key": key, "before": before, "after": after, "nBefore": 14, "nAfter": nAfter,
         "cliffsDelta": clear ? 0.41 : 0.08, "clear": clear, "better": better.map { $0 as Any } ?? NSNull()]
    }

    func list() -> [String: Any] {
        ["proposal": proposal ?? NSNull(), "running": running ?? NSNull(), "past": past, "proposeOn": true]
    }

    private func refuse(_ status: Int, _ code: String) -> (Int, Any) { (status, ["messages": [["code": code, "text": code]]]) }

    private func id(_ path: String) -> String {
        let parts = path.split(separator: "/")
        guard let i = parts.firstIndex(of: "experiments"), i + 1 < parts.count else { return "" }
        return String(parts[i + 1])
    }

    func start(_ e: inout [String: Any], length: Int) {
        e["status"] = "running"; e["startDate"] = Self.day(0); e["endDate"] = Self.day(length - 1); e["dayIndex"] = 1
        e["markedDays"] = [String]()
    }

    func answer(_ op: String, path: String, sent: [String: Any]) -> (Int, Any)? {
        switch op {
        case "listExperiments":
            return (200, list())
        case "startExperiment":
            guard var p = proposal, p["id"] as? String == id(path) else { return refuse(409, "EXPERIMENT_NOT_PROPOSED") }
            if running != nil { return refuse(409, "EXPERIMENT_ALREADY_RUNNING") }
            start(&p, length: p["lengthDays"] as? Int ?? 14)
            proposal = nil; running = p
            return (200, p)
        case "createExperiment":
            if running != nil { return refuse(409, "EXPERIMENT_ALREADY_RUNNING") }
            let length = sent["lengthDays"] as? Int ?? 14
            var e = Self.experiment(id: "ex000000-0000-4000-8000-\(String(format: "%012d", Int.random(in: 100...999_999)))",
                                    kind: sent["subjectKind"] as? String ?? "habit", title: sent["title"] as? String ?? "",
                                    length: length, status: "running", watched: ["sleep_min", "resting_hr", "energy"])
            start(&e, length: length)
            running = e
            return (200, e)
        case "markExperimentDay":
            guard var r = running, r["id"] as? String == id(path) else { return refuse(409, "EXPERIMENT_NOT_RUNNING") }
            var days = r["markedDays"] as? [String] ?? []
            let date = sent["date"] as? String ?? Self.day(0)
            days.removeAll { $0 == date }
            if sent["done"] as? Bool == true { days.append(date) }
            r["markedDays"] = days; running = r
            return (200, r)
        case "dismissExperiment":
            let target = id(path)
            if var p = proposal, p["id"] as? String == target { p["status"] = "dismissed"; proposal = nil; return (200, p) }
            if var r = running, r["id"] as? String == target { r["status"] = "dismissed"; running = nil; return (200, r) }
            return refuse(404, "NOT_FOUND")
        case "keepExperiment":
            guard let i = past.firstIndex(where: { $0["id"] as? String == id(path) }) else { return refuse(404, "NOT_FOUND") }
            past[i]["kept"] = true
            return (200, past[i])
        default:
            return nil
        }
    }
}
#endif
