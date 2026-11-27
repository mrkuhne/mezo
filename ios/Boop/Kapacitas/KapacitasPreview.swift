#if DEBUG
import SwiftUI
import HTTPTypes
import OpenAPIRuntime
import BoopCore
import BoopDesign

/// Simulator review of the Átrendezés page (B7 K3, `mezo-r36n9.17`): `-previewKapacitas YES` opens it on fixtures,
/// no sign-in needed; `-kapOpen atrendezes|hatas` (default `atrendezes`; `hatas` = the first open proposal's
/// *Minden hatása*). `-kapState full|settled|empty|offline` (default `full`): four open proposals · two accepted (one
/// a calendar to-do), one declined, one open, plus the week's earlier changes · a calm week with nothing to move · no
/// net (the cache is primed five hours old; an accept queues). `-kapStale YES` answers the first accept with
/// 409 CAPACITY_PROPOSAL_STALE. Every figure is invented („például"), never his data. The same transport answers the
/// week calls of the `-preview shell` run (the day page's *Mit tennél át?*, Évad's *A jövő heted*); everything else
/// goes on to `PreviewTransport`.
enum KapacitasPreview {
    static let raw = RawJSONClient(transport: KapacitasPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })
    static var state: String { UserDefaults.standard.string(forKey: "kapState") ?? "full" }
    static let model = KapacitasPreviewModel(state: state == "offline" ? "full" : state)

    /// `offline`: what the cache would hold from a read five hours ago.
    static func primeCache(_ directory: URL, monday: String) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        guard let data = try? JSONSerialization.data(withJSONObject: model.week(monday)),
              let w = try? JSONDecoder().decode(KapacitasWeek.self, from: data) else { return }
        try? await cache.put(w, endpoint: "kapacitas/week", date: monday)
    }
}

/// The preview's week, kept for the run so an accept, a decline or an undo shows its effect.
final class KapacitasPreviewModel: @unchecked Sendable {
    private let lock = NSLock()
    private let state: String
    private var proposals: [[String: Any]] = []
    private var adjustments: [[String: Any]] = []
    private var built: String?
    private var staleOnce = UserDefaults.standard.bool(forKey: "kapStale")

    init(state: String) { self.state = state }

    private static func day(_ monday: String, _ n: Int) -> String {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!
        let p = monday.split(separator: "-").compactMap { Int($0) }
        let d = c.date(from: DateComponents(year: p[0], month: p[1], day: p[2])).flatMap { c.date(byAdding: .day, value: n, to: $0) }!
        let x = c.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", x.year!, x.month!, x.day!)
    }

    private static func line(_ label: String, _ before: String, _ after: String, _ favours: Int = 0) -> [String: Any] {
        ["label": label, "before": before, "after": after, "favours": favours]
    }

    private func build(_ monday: String) {
        guard built != monday else { return }
        built = monday
        proposals = []; adjustments = []
        guard state != "empty" else { return }
        let thu = Self.day(monday, 3), wed = Self.day(monday, 2), fri = Self.day(monday, 4), sat = Self.day(monday, 5)
        // the server's own wording (ProposalWordingWriter / ProposalCompareLines), a no-break space in the numbers
        let nb = "\u{00A0}"
        func p(_ id: String, _ kind: String, _ day: String, _ title: String, _ move: String, _ lines: [String],
               _ why: [String], _ effects: [[String: Any]], steps: [(String, [String: Any])], touched: [String]) -> [String: Any] {
            ["id": id, "kind": kind, "day": day, "status": "open", "title": title, "move": move, "effectLines": lines,
             "why": why, "effects": effects, "steps": steps.map { ["kind": $0.0, "payload": $0.1] },
             "touchedDays": touched, "decidedAt": NSNull()]
        }
        proposals = [
            p("7a000000-0000-4000-8000-000000000001", "MOVE_SESSION_DAY", thu, "A lábnapot tedd át szombatra",
              "csütörtök 18:00  →  szombat 18:00 (üres nap)",
              ["A csütörtök túl sok helyett szoros lesz, a szombat laza helyett rendben",
               "Az edzésnapi 290\(nb)kcal többlet szombaton jár, amikor megcsinálod",
               "A vasárnapi röplabda előtt egy pihenőnap marad",
               "A heti 4 edzés megmarad, az Évad terve nem változik"],
              ["Csütörtök: 6 óra megbeszélés, ebből 4 szünet nélkül, este lábnap, előtte várhatóan 6 óra alvás.",
               "Az utóbbi 3 hasonló csütörtökből 2-n elmaradt az esti edzés.",
               "Szombaton üres a naptárad, és péntek este nincs semmi késői."],
              [Self.line("Csütörtök terhe", "túl sok", "szoros", 1), Self.line("Szombat terhe", "laza", "rendben"),
               Self.line("Csütörtöki edzésnapi többlet", "290\(nb)kcal", "0\(nb)kcal"),
               Self.line("Szombati edzésnapi többlet", "0\(nb)kcal", "290\(nb)kcal"),
               Self.line("Pihenő a röpi előtt", "2 nap", "1 nap", -1), Self.line("Heti edzés", "4", "4"),
               Self.line("Heti kalória", "17\(nb)920", "17\(nb)920"), Self.line("Súlycél", "dec. 19.", "dec. 19.")],
              steps: [("MOVE_SESSION_DAY", ["fromDate": thu, "toDate": sat])], touched: [thu, sat]),
            p("7a000000-0000-4000-8000-000000000002", "SHIFT_BEDTIME", wed,
              "Szerdán feküdj később, a csütörtök reggeli edzés csússzon egy órát",
              "lefekvés 22:30 → 23:15  ·  csütörtök edzés 6:45 → 7:45",
              ["A 21:30-ig tartó hívás után is meglesz a 7 óra 30 perc alvás",
               "Csütörtökön 8:30-kor kezdődik az első megbeszélés, így még belefér",
               "A heti 4 edzés megmarad, az Évad terve nem változik"],
              ["Szerdán 21:30-ig hívásod van."],
              [Self.line("Lefekvés szerdán", "22:30", "23:15"), Self.line("Alvás aznap éjjel", "7 óra 30 perc", "7 óra 30 perc"),
               Self.line("Heti edzés", "4", "4")],
              steps: [("SHIFT_BEDTIME", ["night": wed, "bedtime": "23:15"]), ("SHIFT_SESSION_TIME", ["date": thu, "time": "07:45"])],
              touched: [wed, thu]),
            p("7a000000-0000-4000-8000-000000000003", "CALENDAR_TODO", fri, "A pénteki „Sprint review” eseményt tedd egy órával korábbra",
              "péntek 16:00–17:30  →  15:00–16:30",
              ["A 17:30-as hátedzés előtt egy óra szünet marad, nem rohansz",
               "A péntek túl sok helyett szoros lesz",
               "A naptáradhoz nem nyúlok: te teszed át, én észreveszem"],
              ["Pénteken a review után fél órával kezdődik az edzés."],
              [Self.line("Péntek terhe", "túl sok", "szoros", 1)],
              steps: [("CALENDAR_TODO", ["date": fri])], touched: [fri]),
            p("7a000000-0000-4000-8000-000000000004", "MOVE_MEAL_ENERGY", thu, "Csütörtökön egy nagyobb ebéd, kisebb vacsora",
              "ebéd +200\(nb)kcal  ·  vacsora −200\(nb)kcal",
              ["A 13:00 és 15:30 közötti megbeszélések előtt több energiád lesz",
               "A könnyebb vacsora után könnyebben pihensz",
               "A napi keret ugyanannyi marad"],
              ["Csütörtökön délután jön a legtöbb megbeszélés."],
              [Self.line("Heti kalória", "17\(nb)920", "17\(nb)920")],
              steps: [("MOVE_MEAL_ENERGY", ["date": thu])], touched: [thu]),
        ]
        guard state == "settled" else { return }
        accept(at: 0); accept(at: 2)
        proposals[3]["status"] = "declined"
        // the week's earlier changes, no longer on the cards: one taken back, one lapsed
        proposals.append(p("7a000000-0000-4000-8000-000000000005", "MOVE_SESSION_DAY", Self.day(monday, 1),
                           "Hátedzés: kedd → szerda", "kedd 18:00 → szerda 18:00", [], [], [],
                           steps: [("MOVE_SESSION_DAY", [:])], touched: []))
        proposals[4]["status"] = "undone"
        adjustments.append(["id": "7b000000-0000-4000-8000-000000000005", "date": Self.day(monday, 1), "kind": "MOVE_SESSION_DAY",
                            "payload": [:] as [String: Any], "bundleId": "7c000000-0000-4000-8000-000000000005",
                            "proposalId": "7a000000-0000-4000-8000-000000000005", "state": "undone"])
        adjustments.append(["id": "7b000000-0000-4000-8000-000000000006", "date": monday, "kind": "SHIFT_BEDTIME",
                            "payload": [:] as [String: Any], "bundleId": "7c000000-0000-4000-8000-000000000006",
                            "proposalId": NSNull(), "state": "expired"])
    }

    private func accept(at i: Int) {
        proposals[i]["status"] = "accepted"
        let id = proposals[i]["id"] as! String
        let todo = (proposals[i]["kind"] as? String) == "CALENDAR_TODO"
        adjustments.append(["id": UUID().uuidString.lowercased(), "date": proposals[i]["day"] as! String,
                            "kind": proposals[i]["kind"] as! String, "payload": [:] as [String: Any],
                            "bundleId": UUID().uuidString.lowercased(), "proposalId": id,
                            "state": todo ? "waiting" : "active"])
    }

    func week(_ monday: String) -> [String: Any] {
        lock.withLock {
            build(monday)
            let ratios = state == "empty" ? [0.55, 0.62, 0.7, 0.66, 0.58, 0.35, 0.4] : [0.76, 0.71, 0.96, 1.18, 1.05, 0.35, 0.57]
            let days = ratios.enumerated().map { i, r -> [String: Any] in
                let v = r < 0.6 ? ("laza", "laza") : r < 0.9 ? ("rendben", "rendben") : r <= 1.0 ? ("szoros", "szoros") : ("tulSok", "túl sok")
                return ["date": Self.day(monday, i), "verdict": v.0, "label": v.1, "ratio": r, "calendarKnown": true]
            }
            var week: [String: Any] = ["monday": monday, "days": days, "proposals": proposals, "adjustments": adjustments,
                                       "patterns": [] as [Any]]
            if state != "empty" {
                // K4: what the moves taught, and how the earlier weeks' moves went (invented, „például")
                week["patterns"] = [["key": "weekday-overload:THURSDAY", "line": "A sűrű csütörtökök",
                                     "body": "Ha csütörtökön 4 óránál több a megbeszélés, az esti edzés 3 esetből 2-szer elmaradt.",
                                     "evidence": 3, "consistent": 2, "weekday": "THURSDAY"]]
                week["history"] = [
                    ["proposalId": "7d000000-0000-4000-8000-000000000001", "kind": "MOVE_SESSION_DAY", "day": Self.day(monday, -6),
                     "status": "accepted", "title": "Hátedzés: kedd → szerda", "word": "jól", "sub": "megvolt", "good": true],
                    ["proposalId": "7d000000-0000-4000-8000-000000000002", "kind": "SHIFT_BEDTIME", "day": Self.day(monday, -11),
                     "status": "accepted", "title": "Lefekvés 23:30, reggeli edzés 8:00", "word": "félig", "sub": "rövid edzés",
                     "good": false],
                    ["proposalId": "7d000000-0000-4000-8000-000000000003", "kind": "MOVE_SESSION_DAY", "day": Self.day(monday, -18),
                     "status": "declined", "title": "Lábnap csütörtök → péntek", "word": "maradt így", "sub": NSNull(),
                     "good": NSNull()],
                ]
            }
            let open = proposals.filter { $0["status"] as? String == "open" }.count
            if open >= 2 {
                week["allEffects"] = [Self.line("Túl sok nap a héten", "2", "0", 1), Self.line("Szoros nap", "1", "2"),
                                      Self.line("Heti edzés", "4", "4"), Self.line("Heti kalória", "17\u{00A0}920", "17\u{00A0}920"),
                                      Self.line("Alvás a héten", "52 óra 30 perc", "52 óra 30 perc"),
                                      Self.line("Súlycél", "dec. 19.", "dec. 19.")]
            }
            return week
        }
    }

    /// nil = accepted; a code = the 409 to answer.
    func accept(_ id: String) -> String? {
        lock.withLock {
            guard let i = proposals.firstIndex(where: { $0["id"] as? String == id }) else { return "CAPACITY_PROPOSAL_STALE" }
            if proposals[i]["status"] as? String == "accepted" { return nil }   // the replay
            if staleOnce { staleOnce = false; proposals[i]["status"] = "expired"; return "CAPACITY_PROPOSAL_STALE" }
            guard proposals[i]["status"] as? String == "open" else { return "CAPACITY_PROPOSAL_STALE" }
            accept(at: i)
            return nil
        }
    }

    func decline(_ id: String) -> [String: Any]? {
        lock.withLock {
            guard let i = proposals.firstIndex(where: { $0["id"] as? String == id }) else { return nil }
            proposals[i]["status"] = "declined"
            return proposals[i]
        }
    }

    func undo(_ adjustmentId: String) {
        lock.withLock {
            guard let a = adjustments.firstIndex(where: { $0["id"] as? String == adjustmentId }) else { return }
            adjustments[a]["state"] = "undone"
            if let pid = adjustments[a]["proposalId"] as? String, let i = proposals.firstIndex(where: { $0["id"] as? String == pid }) {
                proposals[i]["status"] = "undone"
            }
        }
    }

    /// Open cards go, fresh ones (the same words, new ids) come; accepted and declined stay.
    func regenerate() {
        lock.withLock {
            var fresh: [[String: Any]] = []
            for i in proposals.indices where proposals[i]["status"] as? String == "open" {
                proposals[i]["status"] = "ignored"
                var copy = proposals[i]
                copy["id"] = UUID().uuidString.lowercased(); copy["status"] = "open"
                fresh.append(copy)
            }
            proposals += fresh
        }
    }
}

struct KapacitasPreviewTransport: ClientTransport {
    private static let ops: Set<String> = ["getCapacityWeek", "regenerateCapacityProposals", "acceptCapacityProposal",
                                           "declineCapacityProposal", "undoCapacityAdjustment"]

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        guard Self.ops.contains(operationID) else {
            return try await PreviewTransport().send(request, body: body, baseURL: baseURL, operationID: operationID)
        }
        try await Task.sleep(for: .milliseconds(350))
        if KapacitasPreview.state == "offline" || UserDefaults.standard.bool(forKey: "previewOffline") {
            throw URLError(.notConnectedToInternet)
        }
        let path = request.path ?? ""
        let model = KapacitasPreview.model
        func json(_ object: Any, status: HTTPResponse.Status = .ok) -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
            return (HTTPResponse(status: status, headerFields: h), HTTPBody(data))
        }
        let segments = path.split(separator: "?").first.map { $0.split(separator: "/").map(String.init) } ?? []
        let monday = path.components(separatedBy: "monday=").dropFirst().first ?? kapacitasMonday(for: Date())
        switch operationID {
        case "getCapacityWeek": return json(model.week(monday))
        case "regenerateCapacityProposals": model.regenerate(); return json(model.week(monday))
        case "acceptCapacityProposal":
            let id = segments.count >= 4 ? segments[3] : ""
            if let code = model.accept(id) { return json(["messages": [["code": code]]], status: .conflict) }
            return json([] as [Any])
        case "declineCapacityProposal":
            let id = segments.count >= 4 ? segments[3] : ""
            return model.decline(id).map { json($0) } ?? (HTTPResponse(status: .notFound), nil)
        default:
            model.undo(segments.last ?? "")
            return (HTTPResponse(status: .noContent), nil)
        }
    }
}

/// `-previewKapacitas YES`: the Átrendezés page on its own, over the fixture transport, with a scratch cache and outbox.
struct KapacitasPreviewRoot: View {
    @State private var store: KapacitasStore?
    private let monday = kapacitasMonday(for: Date())

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            if let store {
                AtrendezesPage(monday: monday, crumb: "Ma", close: {}, ask: {})
                    .environment(store)
            }
        }
        .preferredColorScheme(.dark)
        .task {
            let root = FileManager.default.temporaryDirectory.appendingPathComponent("kapacitas-preview", isDirectory: true)
            try? FileManager.default.removeItem(at: root)
            let cacheDir = root.appendingPathComponent("cache")
            await KapacitasPreview.primeCache(cacheDir, monday: monday)
            let outbox = Outbox(directory: root.appendingPathComponent("outbox"),
                                sender: KapacitasOutboxSender(raw: KapacitasPreview.raw))
            store = KapacitasStore(client: KapacitasClient(raw: KapacitasPreview.raw), cache: ServerCache(directory: cacheDir),
                                   outbox: outbox)
        }
    }
}
#endif
