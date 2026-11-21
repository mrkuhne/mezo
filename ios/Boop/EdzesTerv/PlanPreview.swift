#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import BoopCore
import BoopDesign

// Simulator review of the block builder and the weekly review (mezo-r36n9.83), no sign-in and no server (the Mac's
// firewall blocks the simulator app). Invented content in the owner's block's shape.
//
//   -previewBlokk YES                      the entrance (Edzés · Blokk card)
//   -previewBlokkOpen epito|het            straight into the builder / the review deck
//   -previewBlokkTab napok|blokk           the builder's tab
//   -previewBlokkState empty|loading|error|offline|applied
//   -previewBlokkSuggest fail              the add/swap suggestions read answers 503
//   -previewBlokkEdit default|menu|settings|add|addOpen|addEmpty|swap|undo|empty|locked|confirm   the Napok day editor's states
//                                          (add: two sub-muscles picked, addOpen: the muscle dropdown open, addEmpty: none)
//   -previewBlokkDay N                     the Napok tab's day page (0 = the first day)
//
// The evaluator below is a FIXTURE: it imitates the server's answer so the steppers move the numbers on screen. The
// app itself never computes a band — it asks `POST /api/train/meso-plans/evaluate`.

enum PlanPreview {
    static let client = PlanClient(raw: RawJSONClient(transport: PlanPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                                      token: { "preview" }))
}

struct PlanPreviewRoot: View {
    @State private var page: EdzesPage? = {
        switch UserDefaults.standard.string(forKey: "previewBlokkOpen") {
        case "epito": .builder
        case "het": .review
        default: nil
        }
    }()
    @State private var review = WeekReviewModel(client: PlanPreview.client)
    @State private var builder = BlockBuilderModel(client: PlanPreview.client)
    @Namespace private var zoom

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            NKAreaSubPage(hue: planHue, crumb: "Edzés", eyebrow: "Blokk", title: "V-forma és kar",
                          sentence: "Hathetes blokk, a *hát* és a *bicepsz* a hangsúly.", onBack: nil) {
                WeekReviewEntrance(model: review, hue: planHue, zoom: zoom, openReview: { page = .review }, openBuilder: { page = .builder })
            }
        }
        .task { async let b: Void = builder.load(); await review.load(); await b }
        .fullScreenCover(item: $page) { p in
            switch p {
            case .builder:
                BlockBuilderPage(model: builder,
                                 initialMode: BlockBuilderPage.Mode(rawValue: (UserDefaults.standard.string(forKey: "previewBlokkTab") ?? "").capitalized) ?? .izmok) {
                    page = nil
                    builder = BlockBuilderModel(client: PlanPreview.client)
                    Task { await builder.load() }
                }
                .navigationTransition(.zoom(sourceID: PlanZoom.builder, in: zoom))
            case .review:
                WeekReviewDeck(model: review) { page = nil; Task { await review.load() } }
                    .navigationTransition(.zoom(sourceID: PlanZoom.review, in: zoom))
            case .blockLoad:
                EmptyView()
            }
        }
        .preferredColorScheme(.dark)
    }
}

/// Answers the builder's and the review's operations from memory; saves change what the next read returns.
final class PlanPreviewTransport: ClientTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var block: [String: Any] = PlanPreviewTransport.initialBlock()
    private var proposalStatus = UserDefaults.standard.string(forKey: "previewBlokkState") == "applied" ? "auto_applied" : "pending"
    private var decisions: [String: String] = [:]

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        let state = UserDefaults.standard.string(forKey: "previewBlokkState")
        try await Task.sleep(for: .milliseconds(state == "loading" ? 600_000 : 350))
        if state == "offline" { throw URLError(.notConnectedToInternet) }
        if state == "error" { return (HTTPResponse(status: .internalServerError), nil) }
        if operationID == "getBlockExerciseSuggestions", UserDefaults.standard.string(forKey: "previewBlokkSuggest") == "fail" {
            return (HTTPResponse(status: .serviceUnavailable), nil)
        }
        var sent: [String: Any]? = nil
        var sentArray: [[String: Any]]? = nil
        if let body {
            let data = try await Data(collecting: body, upTo: 1 << 20)
            let obj = try? JSONSerialization.jsonObject(with: data)
            sent = obj as? [String: Any]
            sentArray = obj as? [[String: Any]]
        }
        let reply: Any? = lock.withLock {
            switch operationID {
            case "listMesocycles": return state == "empty" ? [] : [block]
            case "getExerciseCatalog": return Self.catalog
            case "evaluateMesoPlan": return sent.map(Self.evaluate)
            case "getBlockExerciseSuggestions": return Self.suggestions(sent ?? [:])
            case "listWeekProposals": return state == "empty" ? [] : [proposal()]
            case "decideWeekProposal":
                if let s = sent {
                    for d in (s["decisions"] as? [[String: Any]]) ?? [] {
                        if let id = d["lineId"] as? String, let v = d["decision"] as? String { decisions[id] = v }
                    }
                    for l in Self.lines where decisions[l.id] == nil {
                        if s["acceptRest"] as? Bool == true { decisions[l.id] = "accepted" }
                        if s["keepRest"] as? Bool == true { decisions[l.id] = "kept" }
                    }
                }
                proposalStatus = "applied"
                return proposal()
            case "updateMesocycleSettings":
                for k in ["trainingStyle", "techniquesEnabled", "weeklyReviewMode"] { if let v = sent?[k] { block[k] = v } }
                return block
            case "updateMesocycleMusclePriorities":
                if let p = sent?["musclePriorities"] { block["musclePriorities"] = p }
                return block
            case "replaceDayExercises":
                let dayId = request.path?.split(separator: "/").dropLast().last.map(String.init)
                var days = block["days"] as? [[String: Any]] ?? []
                if let i = days.firstIndex(where: { $0["id"] as? String == dayId }), let list = sentArray {
                    days[i]["exercises"] = list.enumerated().map { n, e in
                        var row = e; row["id"] = "\(dayId ?? "d")-\(n)-\(UUID().uuidString.prefix(4))"; return row
                    }
                    block["days"] = days
                    return days[i]
                }
                return nil
            default: return nil
            }
        }
        guard let reply, let data = try? JSONSerialization.data(withJSONObject: reply) else {
            return (HTTPResponse(status: .notFound), nil)
        }
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(data))
    }

    // MARK: fixtures

    private static func ex(_ id: String, _ name: String, _ muscle: String, _ sets: Int, type: String = "compound",
                           cat: String? = nil, counts: Bool = true, technique: String? = nil,
                           source: String = "owner") -> [String: Any] {
        var e: [String: Any] = ["id": id, "name": name, "muscle": muscle, "warmupSets": 1, "workingSets": sets,
                                "repMin": type == "isolation" ? 10 : 6, "repMax": type == "isolation" ? 15 : 10,
                                "targetRIR": 2, "type": type, "countsTowardVolume": counts, "challenge": false]
        if let cat { e["catalogId"] = cat }
        if let technique { e["technique"] = technique; e["techniqueSource"] = source }
        return e
    }

    static func initialBlock() -> [String: Any] {
        ["id": "b0000000-0000-4000-8000-0000000000aa", "title": "V-forma és kar", "shortTitle": "V-forma és kar", "status": "active",
         "weeks": 6, "currentWeek": 2, "phaseCurve": ["MEV", "MAV", "MAV", "MAV", "MRV", "Deload"],
         "musclePriorities": ["back": "emphasize", "biceps": "emphasize", "shoulder": "maintain", "chest": "maintain",
                              "triceps": "maintain", "quad": "maintain", "ham": "maintain", "glute": "maintain"],
         "sportGroups": [], "techniquesEnabled": true, "weeklyReviewMode": "manual",
         "days": [
            ["id": "d-h", "day": "Hét", "type": "Hát és bicepsz", "muscle": "back", "exercises": [
                ex("h1", "Chest Supported Row", "back-mid", 4, cat: "c-stable").merging(
                    ["repMin": 6, "repMax": 8, "overrides": ["repRange"], "anchorWeightKg": 62.5]) { $1 },
                ex("h2", "Lat Pulldown · Neutral", "back-wide", 2, cat: "c-long", technique: "rest_drop", source: "planner"),
                ex("h3", "Preacher Curl", "biceps-short", 3, type: "isolation", cat: "c-long"),
                ex("h4", "Hammer Curl", "biceps-brachialis", 3, type: "isolation", cat: "c-free-iso"),
                ex("h5", "Cable Lateral Raise", "shoulder-side", 2, type: "isolation", cat: "c-stable"),
                ex("h6", "Pallof Press", "core", 2, type: "isolation")]],
            ["id": "d-k", "day": "Ked", "type": "Láb és kar", "muscle": "quad", "exercises": [
                ex("k1", "Leg Press", "quad", 3, cat: "c-stable"),
                ex("k2", "Seated Leg Curl", "ham", 2, type: "isolation", cat: "c-long"),
                ex("k3", "Hip Thrust", "glute", 2, cat: "c-free-compound"),
                ex("k4", "Tricep Pushdown", "triceps-lateral", 2, type: "isolation", cat: "c-stable")]],
            ["id": "d-s", "day": "Sze", "type": "Ugrás és stabilitás", "muscle": "core", "exercises": [
                ex("s1", "Side Plank", "core", 2, type: "isolation"),
                ex("s2", "Pogo Hops", "quad", 2, type: "plyo", counts: false)]],
            ["id": "d-c", "day": "Csü", "type": "Bicepsz és hát", "muscle": "biceps", "exercises": [
                ex("c1", "One-Arm Cable Row", "back-mid", 3, cat: "c-stable"),
                ex("c2", "Chest Supported Row", "back-mid", 2, cat: "c-stable", technique: "rest_drop"),
                ex("c3", "Incline DB Curl", "biceps-long", 3, type: "isolation", cat: "c-long"),
                ex("c4", "Machine Chest Press", "chest-mid", 2, cat: "c-stable")]],
            ["id": "d-p", "day": "Pén", "type": "Könnyű kar", "muscle": "triceps", "exercises": [
                ex("p1", "Cable Overhead Extension", "triceps-long", 2, type: "isolation", cat: "c-long"),
                ex("p2", "Bird Dog", "core", 2, type: "isolation")]],
            // Rest days: the editor can put exercises on them.
            ["id": "d-sz", "day": "Szo", "type": "Pihenőnap", "muscle": "core", "exercises": []],
            ["id": "d-v", "day": "Vas", "type": "Pihenőnap", "muscle": "core", "exercises": []]]]
    }

    static var catalog: [[String: Any]] {
        // `gear` + `challengeAllowed` follow the server's rule (decision #72): every non-plyo exercise but a free-weight
        // compound may take the day's challenge.
        [["id": "c-stable", "name": "stable", "stability": "stable", "lengthenedFriendly": false, "gear": ["machine"], "challengeAllowed": true],
         ["id": "c-long", "name": "lengthened", "stability": "stable", "lengthenedFriendly": true, "gear": ["cable"], "challengeAllowed": true],
         ["id": "c-free-iso", "name": "free isolation", "type": "isolation", "stability": "free", "lengthenedFriendly": false,
          "gear": ["dumbbell"], "challengeAllowed": true],
         ["id": "c-free-compound", "name": "free compound", "type": "compound", "stability": "free", "lengthenedFriendly": false,
          "gear": ["barbell"], "challengeAllowed": false]]
        + listed.enumerated().map { n, e in
            ["id": String(format: "c0000000-0000-4000-8000-%012d", 100 + n), "name": e.0, "muscle": e.1, "type": e.2,
             "stability": e.3 ? "stable" : "free", "lengthenedFriendly": false,
             "gear": e.3 ? ["machine"] : [e.2 == "compound" ? "barbell" : "dumbbell"],
             "challengeAllowed": e.2 != "plyo" && !(e.2 == "compound" && !e.3),
             "imageStartUrl": pictures[e.0].map { "/exercises/\($0)-a.jpg" } as Any? ?? NSNull()]
        }
    }

    /// The real catalogue's demo stills for the rows that have one (the others draw the quiet tile).
    private static let pictures: [String: String] = [
        "Seated Cable Row · Neutral": "seated-cable-row-neutral", "Machine High Row": "machine-high-row",
        "Chest-Supported T-Bar Row": "chest-supported-t-bar-row", "Single-Arm DB Row": "single-arm-db-row",
        "T-Bar Row": "t-bar-row", "Barbell Row": "barbell-row", "Lat Pulldown · Pronated": "lat-pulldown-pronated",
        "Single-Arm Lat Pulldown": "single-arm-lat-pulldown", "Straight-Arm Pulldown": "straight-arm-pulldown",
        "Pull-Up": "pull-up", "Pec Deck": "pec-deck", "Cable Fly": "cable-fly", "DB Bench Press": "db-bench-press",
        "Incline DB Press": "incline-db-press", "Low-to-High Cable Fly": "low-to-high-cable-fly",
        "Cable Curl": "cable-curl", "Spider Curl": "spider-curl", "Hack Squat": "hack-squat",
        "Leg Extension": "leg-extension"]

    /// The day editor's full list (FIXTURE: real catalogue names).
    private static let listed: [(String, String, String, Bool)] = [
        ("Seated Cable Row · Neutral", "back-mid", "compound", true), ("Machine High Row", "back-mid", "compound", true),
        ("Chest-Supported T-Bar Row", "back-mid", "compound", true), ("Single-Arm DB Row", "back-mid", "compound", false),
        ("T-Bar Row", "back-mid", "compound", false), ("Barbell Row", "back-mid", "compound", false),
        ("Lat Pulldown · Pronated", "back-wide", "compound", true), ("Single-Arm Lat Pulldown", "back-wide", "compound", true),
        ("Straight-Arm Pulldown", "back-wide", "isolation", true), ("Pull-Up", "back-wide", "compound", false),
        ("Pec Deck", "chest-mid", "isolation", true), ("Incline Machine Press", "chest-upper", "compound", true),
        ("Incline DB Press", "chest-upper", "compound", false), ("Low-to-High Cable Fly", "chest-upper", "isolation", true),
        ("Cable Fly", "chest-mid", "isolation", true), ("DB Bench Press", "chest-mid", "compound", false),
        ("Machine Lateral Raise", "shoulder-side", "isolation", true), ("Reverse Pec Deck", "shoulder-rear", "isolation", true),
        ("Cable Curl", "biceps-long", "isolation", true), ("Spider Curl", "biceps-short", "isolation", false),
        ("Single-Arm Pushdown", "triceps-medial", "isolation", true), ("Hack Squat", "quad", "compound", true),
        ("Leg Extension", "quad", "isolation", true), ("Leg Curl", "ham", "isolation", true),
        ("Machine Hip Abduction", "glute", "isolation", true), ("Cable Kickback", "glute", "isolation", true),
        ("Seated Calf Raise", "calf", "isolation", true), ("Cable Crunch", "core", "isolation", true)]

    /// FIXTURE for the add/swap read: real catalogue names, reasons only from the server's fixed phrase table
    /// (`SubstituteReason`). Swap: five for the back (the approved spike's picks), else three of the muscle. Add: the
    /// picked fine tokens (`muscles`, mezo-r36n9.127) dealt round-robin like the server's `rankForTokens`; a legacy
    /// coarse `muscle` takes its group's tokens; nothing picked = the fixture week's under-band groups (back, chest, shoulder — what its evaluator marks below).
    static func suggestions(_ req: [String: Any]) -> [String: Any] {
        func pick(_ name: String, _ reason: String, top: [String: Any]? = nil, rx: Bool = true) -> [String: Any]? {
            guard let item = catalog.first(where: { $0["name"] as? String == name }) else { return nil }
            let prescription: [String: Any] = ["workingSets": 3, "repMin": 8, "repMax": 12, "targetRIR": 2, "restSec": 90]
            return ["exercise": item, "reasonText": reason, "signals": ["same-role"],
                    "lastTopSet": top as Any? ?? NSNull(), "prescription": rx ? prescription : NSNull()]
        }
        let picks: [[String: Any]?]
        if req["mode"] as? String == "add" {
            let underBand: Set<String> = ["back", "chest", "shoulder"]
            let tokens: [String] = {
                if let m = req["muscles"] as? [String], !m.isEmpty { return SubMuscles.ordered(Set(m)) }
                if let g = req["muscle"] as? String { return SubMuscles.order.filter { coarseMuscle($0) == g } }
                return SubMuscles.order.filter { underBand.contains(coarseMuscle($0)) }
            }()
            let taken = Set((req["dayCatalogIds"] as? [String]) ?? [])
            var buckets = tokens.map { t in listed.filter { $0.1 == t && $0.2 != "plyo" } }
            var dealt: [(String, String, String, Bool)] = []
            while dealt.count < 5, buckets.contains(where: { !$0.isEmpty }) {
                for i in buckets.indices where !buckets[i].isEmpty && dealt.count < 5 { dealt.append(buckets[i].removeFirst()) }
            }
            let tops: [String: [String: Any]] = ["Seated Cable Row · Neutral": ["weightKg": 55, "reps": 10],
                                                 "Incline DB Press": ["weightKg": 30, "reps": 8],
                                                 "Single-Arm Lat Pulldown": ["weightKg": 32.5, "reps": 12]]
            let plain = ["Stabil, könnyű benne terhelni — izomépítéshez jó.", "Megnyújtott helyzetben is jól terhel.",
                         "Illik ehhez a naphoz.", "Ehhez van eszközöd."]
            picks = dealt.enumerated().compactMap { i, e in
                let id = catalog.first { $0["name"] as? String == e.0 }?["id"] as? String ?? ""
                if taken.contains(id.lowercased()) { return nil }
                let reason = underBand.contains(coarseMuscle(e.1)) ? "Ezen a héten kevés jut erre az izomra."
                    : tops[e.0] != nil ? "Ezt már csináltad, így látod, hol tartasz." : plain[i % plain.count]
                return pick(e.0, reason, top: tops[e.0])
            }
        } else {
            let muscle = coarseMuscle((req["outgoing"] as? [String: Any])?["muscle"] as? String ?? "")
            if muscle == "back" {
                picks = [
                    pick("Seated Cable Row · Neutral", "Ugyanazt a munkát végzi a tervben, ezt már csináltad, így látod, hol tartasz.",
                         top: ["weightKg": 55, "reps": 10]),
                    pick("Chest-Supported T-Bar Row", "Ugyanazt a munkát végzi a tervben, stabil, könnyű benne terhelni — izomépítéshez jó."),
                    pick("Machine High Row", "Ugyanazt a munkát végzi a tervben, vezetett mozgás, kíméletesebb az ízületnek."),
                    pick("Single-Arm DB Row", "Ugyanazt a munkát végzi a tervben, és ehhez van eszközöd.", top: ["weightKg": 30, "reps": 10]),
                    pick("Straight-Arm Pulldown", "Ugyanazt az izmot éri, de izolált mozgásként, megnyújtott helyzetben is jól terhel.",
                         top: ["weightKg": 25, "reps": 15], rx: false)]
            } else {
                picks = listed.filter { coarseMuscle($0.1) == muscle }.prefix(3).map {
                    pick($0.0, "Ugyanazt a munkát végzi a tervben, és ehhez van eszközöd.")
                }
            }
        }
        let noKit = catalog.first { $0["name"] as? String == "T-Bar Row" }?["id"] as? String ?? ""
        let hurt = catalog.first { $0["name"] as? String == "Barbell Row" }?["id"] as? String ?? ""
        return ["suggestions": picks.compactMap { $0 },
                "labels": [["catalogId": noKit, "label": "NO_EQUIPMENT"], ["catalogId": hurt, "label": "HURT_BEFORE"]]]
    }

    private static let landmarks: [String: (Int, Int, Int)] = [
        "back": (10, 16, 22), "biceps": (6, 10, 14), "shoulder": (8, 12, 18), "chest": (8, 14, 20),
        "triceps": (6, 10, 14), "quad": (8, 12, 18), "ham": (6, 10, 14), "glute": (8, 12, 18)]
    private static let order = ["back", "biceps", "shoulder", "chest", "triceps", "quad", "ham", "glute"]

    /// FIXTURE evaluator — imitates the server so the review can be walked offline.
    static func evaluate(_ req: [String: Any]) -> [String: Any] {
        let days = req["days"] as? [[String: Any]] ?? []
        let tiers = req["musclePriorities"] as? [String: String] ?? [:]
        var perDay: [String: [Int: Int]] = [:]
        var rows: [String: [(Int, Int, Int)]] = [:] // muscle → (day, exercise, sets)
        for (d, day) in days.enumerated() {
            for (e, ex) in ((day["exercises"] as? [[String: Any]]) ?? []).enumerated() {
                guard ex["countsTowardVolume"] as? Bool != false, ex["type"] as? String != "plyo" else { continue }
                let m = coarseMuscle(ex["muscle"] as? String ?? "")
                let sets = ex["workingSets"] as? Int ?? 0
                perDay[m, default: [:]][d, default: 0] += sets
                rows[m, default: []].append((d, e, sets))
            }
        }
        var muscles: [[String: Any]] = []
        for m in order {
            guard let (mev, mav, mrv) = landmarks[m], let list = rows[m] else { continue }
            let tier = tiers[m] ?? "grow"
            let low = tier == "maintain" ? Int((Double(mev) / 3).rounded(.up)) : (tier == "emphasize" ? mav - 2 : mev)
            let high = tier == "maintain" ? mev - 1 : (tier == "emphasize" ? mrv : mav)
            let weekly = list.map(\.2).reduce(0, +)
            let fit = weekly < low ? "below" : (weekly > high ? "above" : "inside")
            var proposal: [[String: Any]] = []
            if fit == "below", let first = list.min(by: { $0.2 < $1.2 }) {
                proposal = [["dayIndex": first.0, "exerciseIndex": first.1, "delta": min(5 - first.2, low - weekly)]]
                    .filter { ($0["delta"] as? Int ?? 0) > 0 }
            } else if fit == "above", let top = list.max(by: { $0.2 < $1.2 }) {
                proposal = [["dayIndex": top.0, "exerciseIndex": top.1, "delta": -min(top.2 - 1, weekly - high)]]
            }
            muscles.append(["muscle": m, "tier": tier, "band": ["low": low, "high": high, "limit": mrv, "sportAdjusted": false],
                            "weeklySets": weekly, "fit": fit, "diff": fit == "below" ? low - weekly : (fit == "above" ? high - weekly : 0),
                            "spread": (perDay[m] ?? [:]).sorted { $0.key < $1.key }.map { ["dayIndex": $0.key, "sets": $0.value] },
                            "proposal": proposal, "proposalBlocked": proposal.isEmpty && fit != "inside"])
        }
        let dayEvals: [[String: Any]] = days.enumerated().map { d, day in
            let ex = (day["exercises"] as? [[String: Any]]) ?? []
            let sets = ex.map { $0["workingSets"] as? Int ?? 0 }.reduce(0, +)
            let caps = perDay.compactMap { m, byDay -> [String: Any]? in
                guard let s = byDay[d], s > 8 else { return nil }
                return ["muscle": m, "sets": s, "cap": 8]
            }
            return ["dayIndex": d, "day": day["day"] as? String ?? "", "minutesEstimate": Int((Double(sets) * 2.4 + 6).rounded()),
                    "sessionCapWarnings": caps, "exerciseCapWarnings": [], "sportSameDay": d == 0 || d == 2 || d == 4]
        }
        let weekly = muscles.reduce(into: [String: Int]()) { $0[$1["muscle"] as! String] = $1["weeklySets"] as? Int }
        let phases = req["phaseCurve"] as? [String] ?? []
        let path: [[String: Any]] = phases.enumerated().map { w, phase in
            let ms = weekly.reduce(into: [String: Int]()) { out, kv in
                let tier = tiers[kv.key] ?? "grow"
                let climb = tier == "emphasize" ? w : (tier == "grow" ? w / 2 : 0)
                out[kv.key] = phase == "Deload" ? (kv.value + 1) / 2 : kv.value + climb
            }
            return ["week": w + 1, "phase": phase, "total": ms.values.reduce(0, +), "muscles": ms]
        }
        // FIXTURE recommendations: stable + lengthened → half reps, stable → rest-drop.
        // Like the server's TechniqueRules: a technique only on a stable (machine / cable) row.
        let catalog = Dictionary(uniqueKeysWithValues: Self.catalog.filter { $0["stability"] as? String == "stable" }
            .map { ($0["id"] as! String, $0["lengthenedFriendly"] as? Bool ?? false) })
        var recs: [[String: Any]] = []
        for (d, day) in days.enumerated() {
            for (e, ex) in ((day["exercises"] as? [[String: Any]]) ?? []).enumerated() {
                guard let cat = ex["catalogId"] as? String, let long = catalog[cat] else { continue }
                recs.append(["dayIndex": d, "exerciseIndex": e, "technique": long ? "partials" : "rest_drop",
                             "reason": long ? "lengthened_safe" : "stable_machine", "challengeFit": long])
            }
        }
        return ["deficit": true, "sportDays": [0, 2, 4], "suggestedSportGroups": [], "muscles": muscles, "days": dayEvals, "path": path,
                "recommendations": recs]
    }

    struct Line { let id, exercise, exerciseName, day, muscle, kind: String; let from, to: Double; let reasons: [String]; let dayIndex: Int }

    static let lines: [Line] = [
        Line(id: "a", exercise: "h2", exerciseName: "Lat Pulldown · Neutral", day: "Hét", muscle: "back", kind: "sets", from: 2, to: 3,
             reasons: ["all_sets_done", "felt_easy", "deficit_pace"], dayIndex: 0),
        Line(id: "b", exercise: "h1", exerciseName: "Chest Supported Row", day: "Hét", muscle: "back", kind: "weight", from: 62.5, to: 65,
             reasons: ["top_of_rep_range", "reserve_left"], dayIndex: 0),
        Line(id: "f", exercise: "c1", exerciseName: "One-Arm Cable Row", day: "Csü", muscle: "back", kind: "weight", from: 27.5, to: 30,
             reasons: ["top_of_rep_range", "next_plate"], dayIndex: 3),
        Line(id: "e", exercise: "c3", exerciseName: "Incline DB Curl", day: "Csü", muscle: "biceps", kind: "sets", from: 3, to: 4,
             reasons: ["room_in_band", "soreness_cleared"], dayIndex: 3),
        Line(id: "c", exercise: "k1", exerciseName: "Leg Press", day: "Ked", muscle: "quad", kind: "reps", from: 10, to: 11,
             reasons: ["tier_maintain"], dayIndex: 1),
        Line(id: "d", exercise: "k4", exerciseName: "Tricep Pushdown", day: "Ked", muscle: "triceps", kind: "reps", from: 13, to: 12,
             reasons: ["grind"], dayIndex: 1)]

    private func proposal() -> [String: Any] {
        let changing = Set(Self.lines.map(\.muscle))
        let before: [String: Int] = ["back": 11, "biceps": 9, "shoulder": 2, "chest": 2, "triceps": 4, "quad": 3, "ham": 2, "glute": 2]
        return ["id": "p0000000-0000-4000-8000-0000000000aa", "mesocycleId": "b0000000-0000-4000-8000-0000000000aa", "week": 3,
                "kind": "weekly", "status": proposalStatus, "mode": "manual", "createdAt": "2026-11-30T06:00:00Z",
                "lines": Self.lines.map { l -> [String: Any] in
                    var row: [String: Any] = ["id": l.id, "exerciseId": l.exercise, "exerciseName": l.exerciseName, "dayIndex": l.dayIndex,
                                              "dayName": l.day, "muscleGroup": l.muscle, "kind": l.kind, "from": l.from, "to": l.to,
                                              "reasons": l.reasons]
                    if l.id == "a" { row["note"] = "A lehúzásnál a hát a sorozat végén még friss — itt fér el a legjobban egy pihenős drop." }
                    if proposalStatus == "auto_applied" { row["decision"] = "accepted" } else if let d = decisions[l.id] { row["decision"] = d }
                    return row
                },
                "muscles": Self.order.map { m -> [String: Any] in
                    let n = Self.lines.filter { $0.muscle == m }.count
                    let tier = ["back": "emphasize", "biceps": "emphasize"][m] ?? "maintain"
                    return ["muscle": m, "tier": tier, "sportAdjusted": false, "setsBefore": before[m] ?? 0,
                            "setsAfter": before[m] ?? 0, "lineCount": n, "reasons": changing.contains(m) ? [] : ["tier_maintain"]]
                }]
    }
}
#endif
