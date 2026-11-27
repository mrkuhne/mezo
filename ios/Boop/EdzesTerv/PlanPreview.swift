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
//   -previewBlokkMinutes 60                the builder's session-minutes target (the heti keret line under the head)
//   -previewBlokkWhy back                  the builder opens that muscle's „miért?" sheet
//   -previewBlokkHiany list|why|added|none the Izmok tab's coverage hints (mezo-r36n9.114) on a week whose hamstrings
//                                          only hinge and whose back only rows: Combhajlító + Hát hints, Mell silent
//                                          (Tartás); why: the „miért?" open, added: the leg curl taken, none: no hint
//   -previewUjBlokk YES                    the new-block flow (mezo-r36n9.113) on season days H·K·Cs·P
//   -previewUjBlokkScreen alapok|tele|jeloltek|nemfer|letrehozva   one state of it (letrehozva: the builder on the
//                                          block just created, with „Mégsem, eldobom")
//   -previewUjBlokkSeason none             no season days: the needs-season state
//   -previewUjBlokkScroll Y                the step opens scrolled down by Y points
//   -previewUjBlokkStart fail              „Ezzel kezdem" fails at the start (503): the inline error under the button
//   -previewEvesTerv YES                   the Éves terv (mezo-r36n9.113); its states in EvesTerv/EvesTervPreview.swift
//   -previewMezo tab|list|detail|detailClosed|restart|close|report|pending|save|offline|empty
//                                          the Mezociklus tab (mezo-r36n9.177): the card + tiles (tab), Mezociklusaim,
//                                          a template's / a closed run's detail page, the restart / close sheets, the
//                                          zárójelentés ready or with Boop still writing, the save confirmation, the
//                                          list offline (a 5-hour-old copy) and with nothing at all
//   -previewKovetkezik YES|nincs|lezaras   with `-preview shell -previewHome edzes`: the Ma tab's Következik card and the
//                                          pre-filled intake behind „Indítás" (scenarios in EvesTerv/EvesTervPreview.swift)
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

/// `-previewMezo …` (mezo-r36n9.177): the Mezociklus tab's card and tiles on fixtures, with the same flow the room
/// uses, opened on the requested state.
struct MezoPreviewRoot: View {
    @State private var model = MezociklusokModel(client: PlanPreview.client, cache: nil)
    @State private var flow = MezoFlowState()
    @State private var toast: String?
    @Namespace private var zoom
    private let state = UserDefaults.standard.string(forKey: "previewMezo") ?? "tab"

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            NKAreaSubPage(hue: planHue, crumb: "Edzés", eyebrow: "Mezociklus", title: model.groups.running?.title ?? "Edzés",
                          sentence: "", onBack: nil) {
                if let r = model.groups.running {
                    MezoCurrentCard(title: r.title, week: r.currentWeek, weeks: r.weeks, split: r.split ?? "", hue: planHue,
                                    zoom: zoom, offlineReason: nil,
                                    onEdit: { toast = "Szerkesztés" },
                                    onRestart: { flow.sheet = .restart(r) },
                                    onClose: { flow.sheet = .close(r) },
                                    onSaveTemplate: { flow.saveRunning = r })
                } else if let p = model.groups.upcoming.first {
                    MezoPlannedCard(card: p, hue: planHue) { flow.cover = .detail(p) }
                }
                MezoTiles(hue: planHue, groups: model.groups, year: nil, onAll: { flow.cover = .list }, onYear: { toast = "Éves terv" })
            }
        }
        .nkToast($toast)
        .mezoFlow($flow, model: model, plan: PlanPreview.client, hue: planHue, toast: $toast) {}
        .task {
            if state == "offline" {
                // A copy read five hours ago, then the net goes.
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("mezo-preview-\(UUID().uuidString)")
                let earlier = Date().addingTimeInterval(-5 * 3600)
                await MezociklusokModel(client: PlanPreview.client, cache: ServerCache(directory: dir, clock: { earlier })).load()
                PlanPreviewTransport.mezoOffline = true
                model = MezociklusokModel(client: PlanPreview.client, cache: ServerCache(directory: dir))
            }
            await model.load()
            let g = model.groups
            switch state {
            case "list", "offline", "empty": flow.cover = .list
            case "detail": if let t = g.templates.first { flow.cover = .detail(t) }
            case "detailClosed": if let c = g.closed.first { flow.cover = .detail(c) }
            case "restart": if let r = g.running { flow.sheet = .restart(r) }
            case "close": if let r = g.running { flow.sheet = .close(r) }
            case "report", "pending": if let id = g.closed.first?.blockId { flow.cover = .report(id) }
            case "save": flow.saveRunning = g.running
            default: break
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct PlanPreviewRoot: View {
    @State private var page: EdzesPage? = {
        if UserDefaults.standard.bool(forKey: "previewUjBlokk") {
            return UserDefaults.standard.string(forKey: "previewUjBlokkScreen") == "letrehozva"
                ? .builder : .newBlock(NewBlockCover(model: PlanPreview.newBlockModel()))
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
    @Namespace private var zoom

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            NKAreaSubPage(hue: planHue, crumb: "Edzés", eyebrow: "Mezociklus", title: "V-forma és kar",
                          sentence: "Hathetes mezociklus, a *hát* és a *bicepsz* a hangsúly.", onBack: nil) {
                WeekReviewEntrance(model: review, hue: planHue, zoom: zoom, openReview: { page = .review })
            }
        }
        .task { async let b: Void = builder.load(); await review.load(); await b }
        .fullScreenCover(item: $page) { p in
            switch p {
            case .builder:
                BlockBuilderPage(model: builder,
                                 initialMode: BlockBuilderPage.Mode(rawValue: (UserDefaults.standard.string(forKey: "previewBlokkTab") ?? "").capitalized) ?? .izmok,
                                 onNewBlock: { page = .newBlock(NewBlockCover(model: PlanPreview.newBlockModel(screen: nil))) }) {
                    page = nil
                    builder = BlockBuilderModel(client: PlanPreview.client)
                    Task { await builder.load() }
                }
                .navigationTransition(.zoom(sourceID: PlanZoom.builder, in: zoom))
            case .review:
                WeekReviewDeck(model: review) { page = nil; Task { await review.load() } }
                    .navigationTransition(.zoom(sourceID: PlanZoom.review, in: zoom))
            case .newBlock(let cover):
                UjBlokkFlow(model: cover.model, step: PlanPreview.initialStep, blocked: PlanPreview.initialBlocked,
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
        if operationID == "startMesoTemplate", UserDefaults.standard.string(forKey: "previewUjBlokkStart") == "fail" {
            return (HTTPResponse(status: .serviceUnavailable), nil)
        }
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
        let mezoState = UserDefaults.standard.string(forKey: "previewMezo")
        if mezoState != nil, Self.mezoOffline { throw URLError(.notConnectedToInternet) }
        let reply: Any? = lock.withLock {
            if let mezoState, let answer = mezoAnswer(operationID, path: request.path, sent: sent, state: mezoState) { return answer }
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
                EvesTervPreviewServer.started(yearBlockId: sent?["yearBlockId"] as? String)
                var b = block; b["status"] = (sent?["status"] as? String) ?? "planned"; b["currentWeek"] = 1
                return b
            case "closeMesocycle": return block
            case "discardMesocycle": return [String: Any]()
            case "getBlockExerciseSuggestions": return Self.suggestions(sent ?? [:])
            case "getBlockCoverage": return Self.coverage(sent ?? [:])
            case "previewYearPlan", "createYearPlan", "getActiveYearPlan", "patchYearBlock", "archiveYearPlan":
                return EvesTervPreviewServer.answer(operationID, path: request.path, sent: sent)
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

    // MARK: mezociklusok (mezo-r36n9.177)

    /// `-previewMezo offline`: set after the first read filled the cache, so the second read fails.
    nonisolated(unsafe) static var mezoOffline = false
    private var mezoRuns: [[String: Any]]?
    private var reportReads: [String: Int] = [:]

    private static let mezoTemplateIds = ["7e000000-0000-4000-8000-0000000000a1", "7e000000-0000-4000-8000-0000000000a2",
                                          "7e000000-0000-4000-8000-0000000000a3"]

    private func runs(_ state: String) -> [[String: Any]] {
        if let mezoRuns { return mezoRuns }
        guard state != "empty" else { mezoRuns = []; return [] }
        var running = block
        running["startDate"] = "2026-11-16"; running["templateId"] = Self.mezoTemplateIds[0]; running["split"] = "5 napos"
        func run(_ id: String, _ title: String, _ status: String, _ start: String, _ end: String?, report: Bool,
                 split: String, curve: [String], days: [[String: Any]]) -> [String: Any] {
            var r: [String: Any] = ["id": id, "title": title, "shortTitle": title, "status": status, "weeks": curve.count,
                                    "currentWeek": status == "archived" ? curve.count : 0, "phaseCurve": curve,
                                    "musclePriorities": [String: String](), "sportGroups": [String](),
                                    "techniquesEnabled": false, "weeklyReviewMode": "auto", "days": days,
                                    "startDate": start, "hasReport": report, "split": split,
                                    "templateId": Self.mezoTemplateIds[1]]
            if let end { r["endDate"] = end; r["closedAt"] = end + "T18:00:00Z" }
            return r
        }
        let base = block["days"] as? [[String: Any]] ?? []
        let curve6 = ["MEV", "MAV", "MAV", "MRV", "MRV", "Deload"]
        let all: [[String: Any]] = [
            running,
            run("b0000000-0000-4000-8000-0000000000b1", "Erő · Tél", "planned", "2027-01-05", nil, report: false,
                split: "felső-alsó", curve: curve6, days: Array(base.prefix(4))),
            run("b0000000-0000-4000-8000-0000000000c1", "Hipertrófia · Nyár", "archived", "2026-07-07", "2026-08-17", report: true,
                split: "push-pull-láb", curve: curve6, days: base),
            run("b0000000-0000-4000-8000-0000000000c2", "Hipertrófia · Nyár", "archived", "2026-06-23", "2026-07-04", report: true,
                split: "push-pull-láb", curve: curve6, days: base),
            run("b0000000-0000-4000-8000-0000000000c3", "Váll és hát", "archived", "2026-05-05", "2026-06-15", report: false,
                split: "felső-alsó", curve: curve6, days: Array(base.prefix(3))),
        ]
        mezoRuns = all
        return all
    }

    private func templates(_ state: String) -> [[String: Any]] {
        guard state != "empty" else { return [] }
        let base = block["days"] as? [[String: Any]] ?? []
        func t(_ i: Int, _ title: String, runs: Int, split: String, curve: [String], days: [[String: Any]]) -> [String: Any] {
            ["id": Self.mezoTemplateIds[i], "title": title, "shortTitle": title, "runCount": runs, "weeks": curve.count,
             "phaseCurve": curve, "split": split, "trainingStyle": "balanced", "techniquesEnabled": true,
             "musclePriorities": block["musclePriorities"] ?? [:], "sportGroups": [String](),
             "days": days.map { d in var x = d; x.removeValue(forKey: "id"); return x }]
        }
        return [t(0, "V-forma és kar", runs: 3, split: "5 napos", curve: ["MEV", "MAV", "MAV", "MAV", "MRV", "Deload"], days: base),
                t(1, "Erő · Tél", runs: 0, split: "felső-alsó", curve: ["MEV", "MAV", "MRV", "MRV", "MRV", "Deload"], days: Array(base.prefix(4))),
                t(2, "Váll és hát", runs: 1, split: "felső-alsó", curve: ["MEV", "MEV", "MAV", "MAV", "MRV", "MRV", "MRV", "Deload"],
                  days: Array(base.prefix(3)))]
    }

    /// The mezociklus operations; nil hands the call to the builder's own answers.
    private func mezoAnswer(_ op: String, path: String?, sent: [String: Any]?, state: String) -> Any? {
        let id = path?.split(separator: "/").dropLast().last.map(String.init)
        switch op {
        case "listMesocycles":
            return runs(state)
        case "listMesoTemplates":
            return templates(state)
        case "closeMesocycle":
            var all = runs(state)
            guard let i = all.firstIndex(where: { $0["id"] as? String == id }) else { return nil }
            all[i]["status"] = "archived"; all[i]["endDate"] = "2026-11-26"; all[i]["closedAt"] = "2026-11-26T18:00:00Z"
            all[i]["hasReport"] = true
            mezoRuns = all
            return all[i]
        case "restartMesocycle":
            var all = runs(state)
            guard let i = all.firstIndex(where: { $0["id"] as? String == id && $0["status"] as? String == "active" }) else { return nil }
            var fresh = all[i]
            all[i]["status"] = "archived"; all[i]["endDate"] = "2026-11-26"; all[i]["hasReport"] = true
            fresh["id"] = "b0000000-0000-4000-8000-0000000000d1"; fresh["currentWeek"] = 1; fresh["startDate"] = "2026-11-26"
            all.insert(fresh, at: 0)
            mezoRuns = all
            return fresh
        case "activateMesocycle":
            var all = runs(state)
            guard let i = all.firstIndex(where: { $0["id"] as? String == id }) else { return nil }
            all[i]["status"] = "active"; all[i]["currentWeek"] = 1
            mezoRuns = all
            return all[i]
        case "rerunMesocycle", "saveMesocycleToTemplate":
            return ["templateId": Self.mezoTemplateIds[1]]
        case "startMesoTemplate":
            var all = runs(state)
            let tid = path?.split(separator: "/").dropLast().last.map(String.init)
            let t = templates(state).first { $0["id"] as? String == tid } ?? [:]
            var fresh = block
            fresh["id"] = "b0000000-0000-4000-8000-0000000000e1"; fresh["title"] = t["title"] ?? "Új mezociklus"
            fresh["status"] = sent?["status"] ?? "active"; fresh["currentWeek"] = 1; fresh["startDate"] = sent?["startDate"] ?? "2026-11-26"
            all.insert(fresh, at: 0)
            mezoRuns = all
            return fresh
        case "updateMesoTemplate":
            return sent
        case "getMesocycleReport":
            guard let id = path?.split(separator: "/").dropLast().last.map(String.init) else { return nil }
            reportReads[id, default: 0] += 1
            let pending = state == "pending" && reportReads[id, default: 0] < 2
            let title = runs(state).first { $0["id"] as? String == id }?["title"] as? String ?? "Hipertrófia · Nyár"
            return Self.report(id: id, title: title, pending: pending)
        default:
            return nil
        }
    }

    private static func report(id: String, title: String, pending: Bool) -> [String: Any] {
        let planned = [36, 42, 42, 48, 48, 24], actual = [36, 40, 42, 41, 46, 18]
        func arc(_ muscle: String, _ share: Double) -> [String: Any] {
            ["muscle": muscle, "weeks": planned.indices.map { i in
                ["week": i + 1, "planned": Int(Double(planned[i]) * share), "actual": Int(Double(actual[i]) * share)] }]
        }
        return ["mesocycleId": id, "title": title, "startDate": "2026-07-07", "endDate": "2026-08-17", "weeks": 6,
                "selfEval": "Jól ment, a harmadik héten fáradt voltam.",
                "aiEval": pending ? NSNull() : "A felsőtest szépen nőtt, a láb lemaradt a terv mögött: a következő mezociklusban érdemes ott eggyel több sorozat.",
                "aiEvalStatus": pending ? "pending" : "ready", "aiEvalEnabled": true,
                "adherence": ["plannedSessions": 17, "completedSessions": 15, "plannedWeeks": 6, "completedWeeks": 6, "completionPct": 88],
                "volume": ["muscles": [arc("back", 0.4), arc("chest", 0.3), arc("quad", 0.3)]],
                "strength": [
                    ["exerciseName": "Chest Supported Row", "muscle": "back", "firstTopKg": 60, "lastTopKg": 67.5, "firstTopReps": 8, "lastTopReps": 8, "deltaKg": 7.5],
                    ["exerciseName": "Leg Press", "muscle": "quad", "firstTopKg": 140, "lastTopKg": 150, "firstTopReps": 10, "lastTopReps": 10, "deltaKg": 10],
                    ["exerciseName": "Preacher Curl", "muscle": "biceps", "firstTopKg": 30, "lastTopKg": 27.5, "firstTopReps": 10, "lastTopReps": 12, "deltaKg": -2.5]],
                "records": ["medalCount": 2, "top": [["exerciseName": "Leg Press", "kind": "weight", "date": "2026-08-12", "value": 150]]]]
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
        UserDefaults.standard.string(forKey: "previewBlokkHiany") == nil ? baseBlock() : hianyBlock()
    }

    /// `-previewBlokkHiany`: the hamstrings at Építés trained only with hip hinges (Kedd 4, Csütörtök 2), the back only
    /// with rows (no pulldown on Monday) — the two gaps the coverage fixture reports.
    private static func hianyBlock() -> [String: Any] {
        var b = baseBlock()
        var tiers = b["musclePriorities"] as? [String: String] ?? [:]
        tiers["ham"] = "grow"
        b["musclePriorities"] = tiers
        var days = b["days"] as? [[String: Any]] ?? []
        func edit(_ id: String, _ change: (inout [[String: Any]]) -> Void) {
            guard let i = days.firstIndex(where: { $0["id"] as? String == id }) else { return }
            var list = days[i]["exercises"] as? [[String: Any]] ?? []
            change(&list)
            days[i]["exercises"] = list
        }
        edit("d-h") { $0.removeAll { $0["id"] as? String == "h2" } }
        edit("d-k") { list in
            if let i = list.firstIndex(where: { $0["id"] as? String == "k2" }) {
                list[i] = ex("k2", "Romanian Deadlift", "ham", 4, cat: "c-free-compound")
            }
        }
        edit("d-c") { $0.insert(ex("c5", "45° Back Extension", "ham", 2, type: "isolation", cat: "c-stable"), at: 3) }
        b["days"] = days
        return b
    }

    /// FIXTURE for the coverage read (mezo-r36n9.114): the server's fixed phrases (`CoverageRules`), one proposal each
    /// from the fixture catalogue. A gap closes once its proposed exercise is in the sent week.
    static func coverage(_ req: [String: Any]) -> [String: Any] {
        guard UserDefaults.standard.string(forKey: "previewBlokkHiany") != "none" else { return ["findings": []] }
        let days = req["days"] as? [[String: Any]] ?? []
        let ids = Set(days.flatMap { ($0["catalogIds"] as? [String]) ?? [] }.map { $0.lowercased() })
        func item(_ name: String) -> [String: Any] { catalog.first { $0["name"] as? String == name } ?? [:] }
        func on(_ weekday: Int) -> Int {
            days.contains { $0["dayIndex"] as? Int == weekday } ? weekday : (days.first?["dayIndex"] as? Int ?? 0)
        }
        func finding(group: String, code: String, pattern: String, muscles: [String], verdict: String, why: String,
                     exercise: String, reason: String, day: Int, reps: (Int, Int)) -> [String: Any]? {
            let e = item(exercise)
            guard let id = e["id"] as? String, !ids.contains(id.lowercased()) else { return nil }
            return ["group": group, "code": code, "missingPattern": pattern, "muscles": muscles, "verdictText": verdict, "whyText": why,
                    "proposal": ["exercise": e, "reasonText": reason, "signals": ["same-role"], "lastTopSet": NSNull(),
                                 "prescription": ["workingSets": 3, "repMin": reps.0, "repMax": reps.1, "targetRIR": 2, "restSec": 90],
                                 "dayIndex": on(day)]]
        }
        let findings = [
            finding(group: "ham", code: "HAM_NO_KNEE_FLEXION", pattern: "knee-flexion", muscles: ["ham"],
                    verdict: "Hiányzik a lábhajlítás — a combhajlítót most csak csípőből hajlítással edzed.",
                    why: "A combhajlító két ízületen dolgozik: a csípőből hajlítás a csípő felől, a lábhajlítás a térd felől terheli. A kettő együtt adja a teljes munkát.",
                    exercise: "Leg Curl", reason: "Stabil, könnyű benne terhelni — izomépítéshez jó.", day: 3, reps: (10, 15)),
            finding(group: "back", code: "BACK_NO_VERTICAL_PULL", pattern: "vertical-pull", muscles: ["back-wide"],
                    verdict: "Hiányzik a felülről húzás — a hátadat most csak evezéssel edzed.",
                    why: "Az evezés inkább a hát közepét, a felülről húzás inkább a hát szélességét építi. A kettő együtt adja a teljes hátat.",
                    exercise: "Lat Pulldown · Pronated", reason: "Ezen a héten kevés jut erre az izomra.", day: 0, reps: (8, 12)),
        ].compactMap { $0 }
        return ["findings": findings]
    }

    private static func baseBlock() -> [String: Any] {
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
        [["id": "c-stable", "name": "stable", "stability": "stable", "lengthenedFriendly": false, "gear": ["machine"], "challengeAllowed": true,
          "allowedTechniques": ["rest_drop", "drop", "myo", "rest_pause"]],
         ["id": "c-long", "name": "lengthened", "stability": "stable", "lengthenedFriendly": true, "gear": ["cable"], "challengeAllowed": true,
          "allowedTechniques": ["rest_drop", "drop", "myo", "rest_pause", "partials"]],
         ["id": "c-free-iso", "name": "free isolation", "type": "isolation", "stability": "free", "lengthenedFriendly": false,
          "gear": ["dumbbell"], "challengeAllowed": true, "allowedTechniques": ["myo", "rest_drop", "drop"]],
         ["id": "c-free-compound", "name": "free compound", "type": "compound", "stability": "free", "lengthenedFriendly": false,
          "gear": ["barbell"], "challengeAllowed": false, "allowedTechniques": ["top_pause"]]]
        + listed.enumerated().map { n, e in
            ["id": String(format: "c0000000-0000-4000-8000-%012d", 100 + n), "name": e.0, "muscle": e.1, "type": e.2,
             "stability": e.3 ? "stable" : "free", "lengthenedFriendly": false,
             "gear": e.3 ? ["machine"] : [e.2 == "compound" ? "barbell" : "dumbbell"],
             "challengeAllowed": e.2 != "plyo" && !(e.2 == "compound" && !e.3),
             "allowedTechniques": e.0 == "Hammer Curl" ? ["myo", "rest_drop", "drop"]
                : e.0 == "Hip Thrust" ? ["top_pause"]
                : e.3 ? ["rest_drop", "drop", "myo", "rest_pause"] : [],
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
        // The intake's week-1 keret: a raise is allowed while its cost still fits (the server re-ranks instead).
        let room = capacity(target, days: days.count) - week1
        let costs = budget["raiseCost"] as? [String: Int] ?? [:]
        let intake: [String: Any] = [
            "capacitySets": capacity(target, days: days.count), "usedSets": week1, "emphasizeCount": emphasized, "emphasizeMax": 2,
            "raiseAllowed": costs.reduce(into: [String: Bool]()) { r, kv in
                r[kv.key] = (tier(kv.key) == "grow" && emphasized >= 2) ? false : kv.value <= room
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
            return ["candidates": [c], "nothingFits": true, "fixes": fixes, "intakeBudget": intake]
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
        return ["candidates": offered, "nothingFits": false, "fixes": [], "intakeBudget": intake]
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
