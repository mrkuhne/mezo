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
//   -previewBlokkEdit default|menu|settings|add|swap|undo|empty|locked|confirm   the Napok day editor's states
//   -previewBlokkDay N                     the Napok tab's day page (0 = the first day)
//   -previewBlokkMinutes 60                the builder's session-minutes target (the heti keret line under the head)
//   -previewBlokkWhy back                  the builder opens that muscle's „miért?" sheet
//   -previewUjBlokk YES                    the new-block flow (mezo-r36n9.113) on season days H·K·Cs·P
//   -previewUjBlokkScreen alapok|tele|jeloltek|nemfer|letrehozva   one state of it (letrehozva: the builder on the
//                                          block just created, with „Mégsem, eldobom")
//   -previewUjBlokkSeason none             no season days: the needs-season state
//   -previewUjBlokkScroll Y                the step opens scrolled down by Y points
//
// The evaluator below is a FIXTURE: it imitates the server's answer so the steppers move the numbers on screen. The
// app itself never computes a band — it asks `POST /api/train/meso-plans/evaluate`.

enum PlanPreview {
    static let client = PlanClient(raw: RawJSONClient(transport: PlanPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                                      token: { "preview" }))

    private static var screen: String? { UserDefaults.standard.string(forKey: "previewUjBlokkScreen") }

    /// The intake as the spike's states open it (fresh: the back at Hangsúly, calf and core at Tartás).
    @MainActor static func newBlockModel(screen: String? = PlanPreview.screen) -> NewBlockModel {
        let days: [Int]? = UserDefaults.standard.string(forKey: "previewUjBlokkSeason") == "none" ? nil : [0, 1, 3, 4]
        let m = NewBlockModel(client: client, seasonGymDays: days)
        var tiers = ["back": "emphasize", "calf": "maintain", "core": "maintain"]
        switch screen {
        case "tele": tiers["chest"] = "emphasize"
        case "nemfer": tiers["chest"] = "emphasize"; m.minutes = 45
        default: break
        }
        m.tiers = tiers
        return m
    }

    static var initialStep: UjBlokkFlow.Step { ["jeloltek", "nemfer"].contains(screen ?? "") ? .jeloltek : .alapok }

    /// 2b: the calf's raise the full keret refused.
    static var initialBlocked: UjBlokkBlocked? {
        screen == "tele" ? UjBlokkBlocked(muscle: "calf", text: planRaiseText(.noRoom(minutes: 60, days: 4), emphasizeMax: 2) ?? "") : nil
    }
}

struct PlanPreviewRoot: View {
    @State private var page: EdzesPage? = {
        if UserDefaults.standard.bool(forKey: "previewUjBlokk") {
            return UserDefaults.standard.string(forKey: "previewUjBlokkScreen") == "letrehozva" ? .builder : .newBlock
        }
        switch UserDefaults.standard.string(forKey: "previewBlokkOpen") {
        case "epito": return .builder
        case "het": return .review
        default: return nil
        }
    }()
    @State private var review = WeekReviewModel(client: PlanPreview.client)
    @State private var builder: BlockBuilderModel = {
        let m = BlockBuilderModel(client: PlanPreview.client)
        let d = UserDefaults.standard
        if d.object(forKey: "previewBlokkMinutes") != nil { m.minutesTarget = d.integer(forKey: "previewBlokkMinutes") }
        if d.string(forKey: "previewUjBlokkScreen") == "letrehozva" { m.justCreated = true; m.minutesTarget = 60 }
        return m
    }()
    @State private var newBlock = PlanPreview.newBlockModel()
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
                                 initialMode: BlockBuilderPage.Mode(rawValue: (UserDefaults.standard.string(forKey: "previewBlokkTab") ?? "").capitalized) ?? .izmok,
                                 onNewBlock: { newBlock = PlanPreview.newBlockModel(screen: nil); page = .newBlock }) {
                    page = nil
                    builder = BlockBuilderModel(client: PlanPreview.client)
                    Task { await builder.load() }
                }
                .navigationTransition(.zoom(sourceID: PlanZoom.builder, in: zoom))
            case .review:
                WeekReviewDeck(model: review) { page = nil; Task { await review.load() } }
                    .navigationTransition(.zoom(sourceID: PlanZoom.review, in: zoom))
            case .newBlock:
                UjBlokkFlow(model: newBlock, step: PlanPreview.initialStep, blocked: PlanPreview.initialBlocked,
                            onClose: { page = nil },
                            onCreated: { minutes in
                                // The cover's content keeps the model it was built with: re-arm that one.
                                builder.justCreated = true
                                builder.minutesTarget = minutes
                                page = .builder
                                Task { await builder.load() }
                            },
                            onOpenSeason: { _ in page = nil })
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
            case "getMesoPlanCandidates": return Self.candidates(sent ?? [:])
            case "generateMesoPlan":
                let split = sent?["split"] as? String ?? "ul"
                let c = Self.candidates(sent ?? [:])["candidates"] as? [[String: Any]] ?? []
                return ["template": c.first { $0["splitKey"] as? String == split }?["template"] ?? [:], "llmUsed": false]
            case "createMesoTemplate": return ["id": "7e000000-0000-4000-8000-0000000000aa"]
            case "startMesoTemplate":
                var b = block; b["status"] = (sent?["status"] as? String) ?? "planned"; b["currentWeek"] = 1
                return b
            case "closeMesocycle": return block
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
                ex("h1", "Chest Supported Row", "back", 4, cat: "c-stable").merging(
                    ["repMin": 6, "repMax": 8, "overrides": ["repRange"], "anchorWeightKg": 62.5]) { $1 },
                ex("h2", "Lat Pulldown · Neutral", "back-wide", 2, cat: "c-long", technique: "rest_drop", source: "planner"),
                ex("h3", "Preacher Curl", "biceps", 3, type: "isolation", cat: "c-long"),
                ex("h4", "Hammer Curl", "biceps", 3, type: "isolation"),
                ex("h5", "Cable Lateral Raise", "shoulder", 2, type: "isolation", cat: "c-stable"),
                ex("h6", "Pallof Press", "core", 2, type: "isolation")]],
            ["id": "d-k", "day": "Ked", "type": "Láb és kar", "muscle": "quad", "exercises": [
                ex("k1", "Leg Press", "quad", 3, cat: "c-stable"),
                ex("k2", "Seated Leg Curl", "ham", 2, type: "isolation", cat: "c-long"),
                ex("k3", "Hip Thrust", "glute", 2),
                ex("k4", "Tricep Pushdown", "triceps", 2, type: "isolation", cat: "c-stable")]],
            ["id": "d-s", "day": "Sze", "type": "Ugrás és stabilitás", "muscle": "core", "exercises": [
                ex("s1", "Side Plank", "core", 2, type: "isolation"),
                ex("s2", "Pogo Hops", "quad", 2, type: "plyo", counts: false)]],
            ["id": "d-c", "day": "Csü", "type": "Bicepsz és hát", "muscle": "biceps", "exercises": [
                ex("c1", "One-Arm Cable Row", "back", 3, cat: "c-stable"),
                ex("c2", "Chest Supported Row", "back", 2, cat: "c-stable", technique: "rest_drop"),
                ex("c3", "Incline DB Curl", "biceps", 3, type: "isolation", cat: "c-long"),
                ex("c4", "Machine Chest Press", "chest", 2, cat: "c-stable")]],
            ["id": "d-p", "day": "Pén", "type": "Könnyű kar", "muscle": "triceps", "exercises": [
                ex("p1", "Cable Overhead Extension", "triceps", 2, type: "isolation", cat: "c-long"),
                ex("p2", "Bird Dog", "core", 2, type: "isolation")]],
            // Rest days: the editor can put exercises on them.
            ["id": "d-sz", "day": "Szo", "type": "Pihenőnap", "muscle": "core", "exercises": []],
            ["id": "d-v", "day": "Vas", "type": "Pihenőnap", "muscle": "core", "exercises": []]]]
    }

    static var catalog: [[String: Any]] {
        [["id": "c-stable", "name": "stable", "stability": "stable", "lengthenedFriendly": false],
         ["id": "c-long", "name": "lengthened", "stability": "stable", "lengthenedFriendly": true]]
        + listed.enumerated().map { n, e in
            ["id": String(format: "c0000000-0000-4000-8000-%012d", 100 + n), "name": e.0, "muscle": e.1, "type": e.2,
             "stability": e.3 ? "stable" : "free", "lengthenedFriendly": false]
        }
    }

    /// The day editor's full list (FIXTURE: real catalogue names).
    private static let listed: [(String, String, String, Bool)] = [
        ("Seated Cable Row · Neutral", "back-mid", "compound", true), ("Machine High Row", "back-mid", "compound", true),
        ("Chest-Supported T-Bar Row", "back-mid", "compound", true), ("Single-Arm DB Row", "back-mid", "compound", false),
        ("T-Bar Row", "back-mid", "compound", false), ("Barbell Row", "back-mid", "compound", false),
        ("Lat Pulldown · Pronated", "back-wide", "compound", true), ("Single-Arm Lat Pulldown", "back-wide", "compound", true),
        ("Straight-Arm Pulldown", "back-wide", "isolation", true), ("Pull-Up", "back-wide", "compound", false),
        ("Pec Deck", "chest-mid", "isolation", true), ("Incline Machine Press", "chest-upper", "compound", true),
        ("Cable Fly", "chest-mid", "isolation", true), ("DB Bench Press", "chest-mid", "compound", false),
        ("Machine Lateral Raise", "shoulder-side", "isolation", true), ("Reverse Pec Deck", "shoulder-rear", "isolation", true),
        ("Cable Curl", "biceps-long", "isolation", true), ("Spider Curl", "biceps-short", "isolation", false),
        ("Single-Arm Pushdown", "triceps-medial", "isolation", true), ("Hack Squat", "quad", "compound", true),
        ("Leg Extension", "quad", "isolation", true), ("Leg Curl", "ham", "isolation", true),
        ("Machine Hip Abduction", "glute", "isolation", true), ("Cable Kickback", "glute", "isolation", true),
        ("Seated Calf Raise", "calf", "isolation", true), ("Cable Crunch", "core", "isolation", true)]

    /// FIXTURE for the add/swap read: invented picks with real catalogue names, reasons from the server's fixed phrase
    /// table. Five for the back (the approved spike's picks), else up to three from the full list of that muscle.
    static func suggestions(_ req: [String: Any]) -> [String: Any] {
        func pick(_ name: String, _ reason: String, top: [String: Any]? = nil, rx: Bool = true) -> [String: Any]? {
            guard let item = catalog.first(where: { $0["name"] as? String == name }) else { return nil }
            let prescription: [String: Any] = ["workingSets": 3, "repMin": 8, "repMax": 12, "targetRIR": 2, "restSec": 90]
            return ["exercise": item, "reasonText": reason, "signals": ["same-role"],
                    "lastTopSet": top as Any? ?? NSNull(), "prescription": rx ? prescription : NSNull()]
        }
        let adding = req["mode"] as? String == "add"
        let muscle = adding ? (req["muscle"] as? String ?? "") : coarseMuscle((req["outgoing"] as? [String: Any])?["muscle"] as? String ?? "")
        let picks: [[String: Any]?]
        if muscle == "back" {
            picks = [
                pick("Seated Cable Row · Neutral", "Ugyanazt a munkát végzi a tervben, ezt már csináltad, így látod, hol tartasz.",
                     top: ["weightKg": 55, "reps": 10]),
                adding ? pick("Machine High Row", "Ezen a héten kevés jut erre az izomra, vezetett mozgás, kíméletesebb az ízületnek.")
                       : pick("Chest-Supported T-Bar Row", "Ugyanúgy meg van támasztva a mellkasod, a hát dolgozik, nem a derék."),
                adding ? pick("Single-Arm Lat Pulldown", "Egy karral dolgozol, így a gyengébb oldal is utoléri a másikat.",
                              top: ["weightKg": 32.5, "reps": 12])
                       : pick("Machine High Row", "Vezetett mozgás, a gép tartja a pályát, kíméletesebb az ízületnek."),
                adding ? pick("Chest-Supported T-Bar Row", "A mellkasod meg van támasztva, a hát dolgozik, nem a lendület.")
                       : pick("Single-Arm DB Row", "Egy karral dolgozol, így a gyengébb oldal is utoléri a másikat.", top: ["weightKg": 30, "reps": 10]),
                pick("Straight-Arm Pulldown", "Izolált mozgás, a széles hátizmot külön is eléri, a kar közben pihen.",
                     top: ["weightKg": 25, "reps": 15], rx: false)]
        } else {
            picks = listed.filter { coarseMuscle($0.1) == muscle }.prefix(3).map {
                pick($0.0, "Ugyanerre az izomra dolgozik, és nincs még ezen a napon.")
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
                            "proposal": proposal, "proposalBlocked": proposal.isEmpty && fit != "inside",
                            "basis": ["source": tier == "maintain" ? "maintain_third" : "landmarks_rp"]])
        }
        let dayEvals: [[String: Any]] = days.enumerated().map { d, day in
            let ex = (day["exercises"] as? [[String: Any]]) ?? []
            let sets = ex.map { $0["workingSets"] as? Int ?? 0 }.reduce(0, +)
            let caps = perDay.compactMap { m, byDay -> [String: Any]? in
                guard let s = byDay[d], s > 8 else { return nil }
                return ["muscle": m, "sets": s, "cap": 8]
            }
            return ["dayIndex": d, "day": day["day"] as? String ?? "", "minutesEstimate": ex.isEmpty ? 0 : Self.minutes(ex, styled: req["trainingStyle"] != nil),
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
        let catalog = Dictionary(uniqueKeysWithValues: Self.catalog.map { ($0["id"] as! String, $0["lengthenedFriendly"] as? Bool ?? false) })
        var recs: [[String: Any]] = []
        for (d, day) in days.enumerated() {
            for (e, ex) in ((day["exercises"] as? [[String: Any]]) ?? []).enumerated() {
                guard let cat = ex["catalogId"] as? String, let long = catalog[cat] else { continue }
                recs.append(["dayIndex": d, "exerciseIndex": e, "technique": long ? "partials" : "rest_drop",
                             "reason": long ? "lengthened_safe" : "stable_machine", "challengeFit": long])
            }
        }
        var out: [String: Any] = ["deficit": true, "sportDays": [0, 2, 4], "suggestedSportGroups": [], "muscles": muscles, "days": dayEvals,
                                  "path": path, "recommendations": recs]
        if let target = req["sessionMinutesTarget"] as? Int {
            let peak = path.filter { $0["phase"] as? String != "Deload" }.compactMap { $0["total"] as? Int }.max() ?? 0
            let trainingDays = days.filter { !((($0["exercises"] as? [[String: Any]]) ?? []).isEmpty) }.count
            out["budget"] = ["capacitySets": Self.capacity(target, days: trainingDays), "usedSets": peak,
                             "emphasizeCount": tiers.values.filter { $0 == "emphasize" }.count, "emphasizeMax": 2,
                             "raiseCost": muscles.reduce(into: [String: Int]()) { r, m in
                                 let t = m["tier"] as? String
                                 if t == "maintain" { r[m["muscle"] as! String] = 4 } else if t == "grow" { r[m["muscle"] as! String] = 6 }
                             }]
        }
        return out
    }

    /// The server's session-minutes model (`mezo.train.evaluator`): unstyled = 2.4 per working set + 1 per warm-up set
    /// + 6; styled = per set 40 s + its rest (else the flat figure) + 1 per exercise + 1 per warm-up set + 6.
    static func minutes(_ exercises: [[String: Any]], styled: Bool) -> Int {
        let working = exercises.map { $0["workingSets"] as? Int ?? 0 }.reduce(0, +)
        let warmups = exercises.map { $0["warmupSets"] as? Int ?? 0 }.reduce(0, +)
        var work = 2.4 * Double(working), transitions = 0.0
        if styled {
            work = exercises.map { e in
                Double(e["workingSets"] as? Int ?? 0) * (40 + Double(e["restSec"] as? Int ?? Int(2.4 * 60 - 40))) / 60
            }.reduce(0, +)
            transitions = Double(exercises.count)
        }
        return Int((work + Double(warmups) + transitions + 6).rounded(.toNearestOrAwayFromZero))
    }

    /// The server's capacity (`TierBudget`, unstyled): per day floor((target − 6 − 2) / (2.4 + 1/3)).
    static func capacity(_ target: Int, days: Int) -> Int {
        days * max(0, Int((Double(target - 8) / (2.4 + 1.0 / 3.0) + 1e-9).rounded(.down)))
    }

    // MARK: the candidates FIXTURE (mezo-r36n9.113)

    /// Weekly working sets per muscle at Tartás · Építés · Hangsúly (the spike's numbers).
    private static let tierSets: [String: (Int, Int, Int)] = [
        "back": (4, 9, 14), "chest": (4, 8, 13), "shoulder": (3, 8, 13), "biceps": (2, 6, 10), "triceps": (2, 6, 10),
        "quad": (4, 8, 13), "ham": (3, 6, 10), "glute": (2, 5, 9), "calf": (3, 6, 10), "core": (2, 4, 6)]
    private static let upper: Set<String> = ["back", "chest", "shoulder", "biceps", "triceps"]
    private static let names: [String: String] = [
        "back": "Seated Cable Row · Neutral", "chest": "Incline Machine Press", "shoulder": "Machine Lateral Raise",
        "biceps": "Cable Curl", "triceps": "Single-Arm Pushdown", "quad": "Hack Squat", "ham": "Leg Curl",
        "glute": "Machine Hip Abduction", "calf": "Seated Calf Raise", "core": "Cable Crunch"]

    private static func sets(_ muscle: String, _ tier: String) -> Int {
        let t = tierSets[muscle] ?? (2, 5, 8)
        return tier == "maintain" ? t.0 : (tier == "emphasize" ? t.2 : t.1)
    }

    /// FIXTURE for POST /meso-plans/candidates: Felső / Alsó and Teljes test built from the tiers, evaluated with the
    /// fixture evaluator (server minutes formula); a split whose longest day passes the target is offered, else the
    /// closest one comes back with the fixes. Peak week = week 1 + 2 sets per Hangsúly muscle.
    static func candidates(_ req: [String: Any]) -> [String: Any] {
        let days = req["daysOfWeek"] as? [String] ?? []
        let weeks = req["weeks"] as? Int ?? 6
        let tiers = req["priorities"] as? [String: String] ?? [:]
        let target = req["sessionMinutesTarget"] as? Int ?? 60
        let muscles = Array(tierSets.keys).sorted()
        func tier(_ m: String) -> String { tiers[m] ?? "grow" }
        func build(_ key: String) -> (label: String, days: [[String: Any]]) {
            let full = key == "full"
            let dayMuscles: [[String]] = days.indices.map { i in
                full ? muscles : muscles.filter { upper.contains($0) == (i % 2 == 0) }
            }
            let built: [[String: Any]] = days.enumerated().map { i, token in
                let ms = dayMuscles[i]
                let exercises: [[String: Any]] = ms.compactMap { m in
                    let hits = dayMuscles.filter { $0.contains(m) }.count
                    let before = dayMuscles[..<i].filter { $0.contains(m) }.count
                    let total = sets(m, tier(m))
                    let share = total / hits + (before < total % hits ? 1 : 0)
                    guard share > 0 else { return nil }
                    return ["name": names[m] ?? m, "muscle": m, "warmupSets": ["back", "chest", "quad"].contains(m) ? 1 : 0,
                            "workingSets": share, "repMin": 8, "repMax": 12, "targetRIR": 2, "type": "compound",
                            "countsTowardVolume": true]
                }
                return ["day": token, "type": full ? "Teljes test" : (i % 2 == 0 ? "Felső" : "Alsó"), "muscle": ms.first ?? "back",
                        "muscleAccent": false, "exercises": exercises]
            }
            return (full ? "Teljes test ×\(days.count)" : "Felső / Alsó", built)
        }
        let phases = (0..<weeks).map { $0 == weeks - 1 ? "Deload" : ($0 == 0 ? "MEV" : ($0 == weeks - 2 ? "MRV" : "MAV")) }
        let emphasized = tiers.values.filter { $0 == "emphasize" }.count
        let week1 = muscles.map { sets($0, tier($0)) }.reduce(0, +)
        let used = week1 + 2 * emphasized
        let budget: [String: Any] = [
            "capacitySets": capacity(target, days: days.count), "usedSets": used, "emphasizeCount": emphasized, "emphasizeMax": 2,
            "raiseCost": muscles.reduce(into: [String: Int]()) { r, m in
                switch tier(m) {
                case "maintain": r[m] = sets(m, "grow") - sets(m, "maintain")
                case "grow": r[m] = sets(m, "emphasize") - sets(m, "grow") + 2
                default: break
                }
            }]
        let scored: [(key: String, c: [String: Any], longest: Int, warmups: Int)] = ["ul", "full"].map { key in
            let b = build(key)
            var evaluation = evaluate(["days": b.days, "musclePriorities": tiers, "phaseCurve": phases, "sessionMinutesTarget": target])
            evaluation["budget"] = budget
            let longest = (evaluation["days"] as? [[String: Any]] ?? []).compactMap { $0["minutesEstimate"] as? Int }.max() ?? 0
            let warmups = b.days.flatMap { ($0["exercises"] as? [[String: Any]]) ?? [] }.map { $0["warmupSets"] as? Int ?? 0 }.reduce(0, +)
            let template: [String: Any] = ["title": b.label, "weeks": weeks, "days": b.days]
            return (key, ["splitKey": key, "splitLabel": b.label, "template": template, "evaluation": evaluation], longest, warmups)
        }
        let fitting = scored.filter { $0.longest <= target }
        if fitting.isEmpty {
            let closest = scored.min { $0.longest < $1.longest }!
            var c = closest.c; c["recommended"] = false; c["reasons"] = []
            var fixes: [[String: Any]] = [["code": "more_minutes", "value": Int((Double(closest.longest) / 15).rounded(.up)) * 15]]
            if emphasized > 0 { fixes.append(["code": "fewer_emphasis"]) }
            if days.count < 6 { fixes.append(["code": "more_days"]) }
            return ["candidates": [c], "nothingFits": true, "fixes": fixes]
        }
        let base = fitting.first!.warmups
        let offered: [[String: Any]] = fitting.enumerated().map { i, s in
            var c = s.c
            c["recommended"] = i == 0
            var reasons: [[String: Any]] = [["code": "fits_time", "value": s.longest]]
            if s.key == "full" { reasons.append(["code": "freq_high", "value": days.count]) } else { reasons.append(["code": "freq_2x"]) }
            if s.warmups > base { reasons.append(["code": "more_warmups", "value": (s.warmups - base) * 2]) }
            c["reasons"] = reasons
            return c
        }
        return ["candidates": offered, "nothingFits": false, "fixes": []]
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
