#if DEBUG
import Foundation
import SwiftUI
import BoopCore
import BoopDesign

// Simulator review of the Éves terv (mezo-r36n9.113) on fixtures in the server's shape — no sign-in, no server (the
// Mac's firewall blocks the simulator app). Invented, real-looking plans; never anyone's real data.
//
//   -previewEvesTerv YES
//   -previewEvesTervScreen letrehozas|terkep|blokk|nincs|lezaras|csuszas|kotetlen
//        letrehozas  the create screen (5)            terkep    the map, week 9 of 52 (6)
//        blokk       the map with block 6's sheet (6b) nincs     no plan: the empty state
//        lezaras     the consolidation runs: the year-review card and „Jövő évi terv"
//        csuszas     a late year: buffer eaten, consolidation 1 week, the year 1 week over 52, rule-break cards
//        kotetlen    the plan starts next week while an unlinked block runs: the banner
//   -previewKovetkezik YES|nincs|lezaras             the Következik card's year (Task 10; with `-preview shell
//        -previewHome edzes`): YES the running block's last week, nincs no block runs and the next is due (Mon–Thu:
//        offered from today; later in the week re-dated to next Monday), lezaras the
//        consolidation is next. Dates follow today, so the next block starts next Monday.
//   -previewBlokkState loading|error|offline        the shared preview states (offline: the last plan, 3 hours old)
//   -previewEvesTervScroll Y                         the page opens scrolled down by Y points
//
// The fixture lays the weeks out the way the server does (a delay eats the buffer, then shortens the consolidation to
// one week, then moves the end past 52 weeks), so the sheet's buttons move the strip. The app itself never does this.

enum EvesTervPreview {
    static var screen: String { UserDefaults.standard.string(forKey: "previewEvesTervScreen") ?? "terkep" }
    /// `-previewKovetkezik`: the Következik card's scenario, else nil.
    static var kovetkezik: String? { UserDefaults.standard.string(forKey: "previewKovetkezik") }
}

struct EvesTervPreviewRoot: View {
    @State private var model: YearPlanModel?

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            if let model {
                EvesTervPage(model: model,
                             step: EvesTervPreview.screen == "letrehozas" ? .create(replace: false) : .map,
                             sheetBlock: EvesTervPreview.screen == "blokk" ? EvesTervFixture.blockId(6) : nil) {
                    Task { await model.load() }
                }
            }
        }
        .task {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("eves-terv-preview-\(UUID().uuidString)")
            if UserDefaults.standard.string(forKey: "previewBlokkState") == "offline" {
                // The last good plan, read three hours ago: the map shows it with its age.
                let writer = ServerCache(directory: dir, clock: { Date().addingTimeInterval(-3 * 3600) })
                let plan = try? JSONDecoder().decode(WireYearPlan.self, from: JSONSerialization.data(withJSONObject: EvesTervFixture.scenario("terkep").json(ids: true)))
                try? await writer.put(EvesCachedPlan(plan: plan), endpoint: "train/year-plan", date: "-")
            }
            let m = YearPlanModel(client: PlanPreview.client, cache: ServerCache(directory: dir))
            // The spike's draft: the shoulder and the calf to grow this year.
            if EvesTervPreview.screen == "letrehozas" { m.emphasis = ["shoulder", "calf"] }
            model = m
        }
        .preferredColorScheme(.dark)
    }
}

/// The cache entry's shape (`YearPlanModel.Snapshot`).
private struct EvesCachedPlan: Codable, Sendable { let plan: WireYearPlan? }

/// The year plan the preview transport answers from; edits change what the next read returns.
final class EvesTervFixture {
    struct Block {
        var ordinal: Int
        var kind: String
        var focus: [String]
        var weeks: Int
        /// Weeks this block was moved later (a delay before it).
        var delay = 0
        var skipped = false
        /// A status the week maths would not give (a linked running block).
        var forced: String?
        var serial: Int
    }

    var start: String
    var blockWeeks: Int
    var consolidationWeeks = 2
    var emphasis: [String]
    var blocks: [Block]
    var currentWeek: Int?
    var relaxed: [[String: Any]] = []
    var unlinked: [String: Any]?
    var exists = true
    var archived = false
    /// The server's `next.reason` and, when it differs from the block's own day, `next.startsOn` (no_block: the Monday
    /// on/after today).
    var nextReason = "last_week"
    var nextStartsOn: String?
    /// The next block was started from the card: a planned mesocycle exists, so the server names no next block.
    var nextStarted = false

    init(start: String, blockWeeks: Int, emphasis: [String], focus: [[String]], currentWeek: Int?) {
        self.start = start
        self.blockWeeks = blockWeeks
        self.emphasis = emphasis
        self.currentWeek = currentWeek
        blocks = focus.enumerated().map { i, f in
            Block(ordinal: i + 1, kind: Set(f).isSubset(of: YearPlanModel.upperGroups) ? "upper" : "lower", focus: f,
                  weeks: blockWeeks, serial: i + 1)
        }
    }

    static func blockId(_ serial: Int) -> String { String(format: "9eb10000-0000-4000-8000-%012d", serial) }
    static let consolidationId = "9eb10000-0000-4000-8000-0000000000cc"
    static let planId = "9ea40000-0000-4000-8000-000000000001"

    private static let spikeFocus: [[String]] = [
        ["back", "biceps"], ["quad", "glute"], ["chest", "shoulder"], ["ham", "glute"],
        ["back", "shoulder"], ["quad", "calf"], ["chest", "triceps"], ["ham", "glute"],
    ]

    /// The Monday strictly after today, `yyyy-MM-dd`.
    private static var nextMonday: String { evesTodayMonday(Date().addingTimeInterval(86_400)) }

    /// One review state of the year.
    static func scenario(_ name: String) -> EvesTervFixture {
        switch name {
        case "kovetkezik-lezaras":
            // Week 50: every loading block done, the buffer runs, the consolidation starts next Monday.
            let f = EvesTervFixture(start: evesAdding(days: -50 * 7, to: nextMonday) ?? nextMonday, blockWeeks: 6,
                                    emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: 50)
            f.nextReason = "no_block"
            return f
        case "kovetkezik-nincs":
            // Block 2 ended last Sunday; block 3 was due this Monday and is not started. Like the server: within 3 days
            // of its Monday it keeps that day and is offered from today („mától"); later than that the layout re-dates
            // it to next Monday and it is offered from there.
            let thisMonday = evesAdding(days: -7, to: nextMonday) ?? nextMonday
            let today = kovetkezikToday()
            let late = (evesDays(from: thisMonday, to: today) ?? 0) > 3
            let f = EvesTervFixture(start: evesAdding(days: -12 * 7, to: thisMonday) ?? thisMonday, blockWeeks: 6,
                                    emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: 13)
            f.blocks[2].forced = "planned"
            if late { f.blocks[2].delay = 1 }
            f.nextReason = "no_block"
            f.nextStartsOn = late ? nextMonday : today
            return f
        case "kovetkezik-YES", "kovetkezik-yes":
            // Week 12: block 2 is in its last week, block 3 (chest + shoulder) starts next Monday.
            return EvesTervFixture(start: evesAdding(days: -12 * 7, to: nextMonday) ?? nextMonday, blockWeeks: 6,
                                   emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: 12)
        case "lezaras":
            let f = EvesTervFixture(start: "2025-11-24", blockWeeks: 6, emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: 52)
            f.blocks[3].skipped = true
            return f
        case "csuszas":
            var focus = spikeFocus
            focus[5] = ["quad", "glute"]
            focus[6] = ["chest", "biceps"]
            focus[7] = ["ham", "quad"]
            let f = EvesTervFixture(start: "2026-04-13", blockWeeks: 6, emphasis: ["shoulder", "calf"], focus: focus, currentWeek: 32)
            f.blocks[2].delay = 2
            f.blocks[4].delay = 2
            return f
        case "kotetlen":
            let f = EvesTervFixture(start: "2026-11-30", blockWeeks: 6, emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: nil)
            f.unlinked = ["mesocycleId": "7e000000-0000-4000-8000-0000000000bb", "title": "Erő alapozás", "startDate": "2026-11-02"]
            return f
        case "nincs":
            let f = scenario("terkep")
            f.exists = false
            return f
        default:
            let f = EvesTervFixture(start: "2026-09-21", blockWeeks: 6, emphasis: ["shoulder", "calf"], focus: spikeFocus, currentWeek: 9)
            f.relaxed = [["code": "emphasis_once", "group": "calf"]]
            return f
        }
    }

    /// The server's proposal for a draft (the create screen): a rotation that alternates upper and lower blocks.
    static func proposal(start: String, blockWeeks: Int, emphasis: [String]) -> EvesTervFixture {
        let upper: [[String]] = [["back", "biceps"], ["chest", "shoulder"], ["back", "shoulder"], ["chest", "triceps"], ["biceps", "triceps"], ["shoulder", "triceps"]]
        let lower: [[String]] = [["quad", "glute"], ["ham", "glute"], ["quad", "calf"], ["ham", "calf"], ["glute", "calf"]]
        let n = (52 - 2) / blockWeeks
        let focus = blockWeeks == 6 ? spikeFocus
            : (0..<n).map { i in i % 2 == 0 ? upper[(i / 2) % upper.count] : lower[(i / 2) % lower.count] }
        let f = EvesTervFixture(start: start, blockWeeks: blockWeeks, emphasis: emphasis, focus: focus, currentWeek: nil)
        let counts = f.focusCount
        f.relaxed = emphasis.filter { (counts[$0] ?? 0) < 2 }.map { ["code": "emphasis_once", "group": $0] }
            + YearPlanModel.landmarkGroups.filter { (counts[$0] ?? 0) == 0 }.map { ["code": "no_focus", "group": $0] }
        return f
    }

    // MARK: edits

    func patch(_ serial: Int, _ body: [String: Any]) -> Bool {
        guard let i = blocks.firstIndex(where: { $0.serial == serial }) else { return false }
        if let focus = body["focus"] as? [String] { blocks[i].focus = focus }
        if let ordinal = body["ordinal"] as? Int, let j = blocks.firstIndex(where: { $0.ordinal == ordinal }) {
            blocks.swapAt(i, j)
            for k in blocks.indices { blocks[k].ordinal = k + 1 }
        }
        let k = blocks.firstIndex(where: { $0.serial == serial }) ?? i
        if let shift = body["shiftWeeks"] as? Int { blocks[k].delay = max(0, blocks[k].delay + shift) }
        if let skip = body["skip"] as? Bool { blocks[k].skipped = skip }
        if body["linkRunning"] as? Bool == true { blocks[k].forced = "running"; unlinked = nil }
        return true
    }

    // MARK: the server's shape

    var focusCount: [String: Int] {
        var out = Dictionary(uniqueKeysWithValues: YearPlanModel.landmarkGroups.map { ($0, 0) })
        for b in blocks where !b.skipped { for g in b.focus { out[g, default: 0] += 1 } }
        return out
    }

    private static let pairs: Set<Set<String>> = [
        ["back", "biceps"], ["chest", "triceps"], ["chest", "shoulder"], ["back", "shoulder"], ["shoulder", "triceps"], ["biceps", "triceps"],
        ["quad", "glute"], ["ham", "glute"], ["quad", "calf"], ["ham", "calf"], ["glute", "calf"],
    ]

    func json(ids: Bool) -> [String: Any] {
        var cursor = 0 // days from the start
        var laid: [(Block, Int, Int)] = [] // block, first day, days
        for b in blocks {
            cursor += b.delay * 7
            laid.append((b, cursor, b.weeks * 7))
            if !b.skipped { cursor += b.weeks * 7 }
        }
        let used = cursor / 7
        let capacity = 52 - consolidationWeeks
        let buffer = max(0, capacity - used)
        let overflow = max(0, used - capacity)
        let consWeeks = max(1, consolidationWeeks - overflow)
        let overrun = max(0, used + consWeeks - 52)
        let bufferStart = cursor
        let consStart = cursor + buffer * 7
        func day(_ d: Int) -> String { evesAdding(days: d, to: start) ?? start }
        func status(_ first: Int, _ days: Int, forced: String?, skipped: Bool) -> (String, Int?) {
            if skipped { return ("skipped", nil) }
            if forced == "planned" { return ("planned", nil) }
            if let forced { return (forced, 3) }
            guard let c = currentWeek else { return ("planned", nil) }
            let a = first / 7 + 1, e = a + days / 7 - 1
            if c > e { return ("done", nil) }
            if c >= a { return ("running", c - a + 1) }
            return ("planned", nil)
        }
        let counts = focusCount
        var out: [[String: Any]] = []
        var nextId: String?
        var nextStart: String?
        var review = (done: 0, skipped: 0, focused: Set<String>())
        var statuses: [Int: String] = [:]
        for (b, first, days) in laid {
            let (s, w) = status(first, days, forced: b.forced, skipped: b.skipped)
            statuses[b.serial] = s
            if s == "planned", nextId == nil { nextId = Self.blockId(b.serial); nextStart = day(first) }
            if s == "done" { review.done += 1; review.focused.formUnion(b.focus) }
            if s == "running" { review.focused.formUnion(b.focus) }
            if s == "skipped" { review.skipped += 1 }
            var row: [String: Any] = [
                "ordinal": b.ordinal, "kind": b.kind, "focus": b.focus, "weeks": b.weeks,
                "plannedStart": day(first), "lastDay": day(first + days - 1), "status": s,
                "adopted": b.ordinal == 1, "canMoveEarlier": s == "planned" && b.delay > 0,
                "skipConsequence": s == "planned" ? b.focus.filter { counts[$0] == 1 } : [],
            ]
            if ids { row["id"] = Self.blockId(b.serial) }
            if let w { row["currentWeek"] = w }
            if s == "running" || s == "done" { row["mesocycleId"] = String(format: "7e000000-0000-4000-8000-%012d", b.serial) }
            out.append(row)
        }
        let (cs, cw) = status(consStart, consWeeks * 7, forced: nil, skipped: false)
        if cs == "planned", nextId == nil { nextId = Self.consolidationId; nextStart = day(consStart) }
        var cons: [String: Any] = [
            "ordinal": blocks.count + 1, "kind": "consolidation", "focus": [String](), "weeks": consWeeks,
            "plannedStart": day(consStart), "lastDay": day(consStart + consWeeks * 7 - 1), "status": cs,
            "adopted": false, "canMoveEarlier": false, "skipConsequence": [String](),
        ]
        if ids { cons["id"] = Self.consolidationId }
        if let cw { cons["currentWeek"] = cw }
        out.append(cons)

        // The rule breaks an edit left behind.
        var warnings: [[String: Any]] = []
        let active = blocks.filter { !$0.skipped }
        for (a, b) in zip(active, active.dropFirst()) {
            for g in Set(a.focus).intersection(b.focus) { warnings.append(["code": "focus_consecutive", "group": g, "ordinal": b.ordinal]) }
        }
        for b in active where !b.focus.isEmpty {
            let upper = b.focus.contains { YearPlanModel.upperGroups.contains($0) }
            let lower = b.focus.contains { YearPlanModel.lowerGroups.contains($0) }
            if upper && lower { warnings.append(["code": "mixed_focus", "ordinal": b.ordinal]) }
            else if b.focus.count == 2, !Self.pairs.contains(Set(b.focus)) { warnings.append(["code": "pair_unusual", "ordinal": b.ordinal]) }
        }
        if ids {
            for g in YearPlanModel.landmarkGroups where counts[g] == 0 {
                let kind = YearPlanModel.upperGroups.contains(g) ? "upper" : "lower"
                var note: [String: Any] = ["code": "no_focus_this_year", "group": g]
                if let target = blocks.last(where: { $0.kind == kind && statuses[$0.serial] == "planned" }) {
                    note["blockId"] = Self.blockId(target.serial)
                    if target.focus.count >= 2 { note["replaces"] = target.focus[0] }
                }
                warnings.append(note)
            }
        }
        let loadingOrder = YearPlanModel.landmarkGroups
        var plan: [String: Any] = [
            "status": archived ? "archived" : "active", "startDate": start, "endDate": day(consStart + consWeeks * 7 - 1),
            "blockWeeks": blockWeeks, "consolidationWeeks": consolidationWeeks, "emphasis": emphasis,
            "loadingBlocks": blocks.count, "bufferWeeks": buffer, "overrunWeeks": overrun,
            "blocks": out, "relaxed": relaxed, "warnings": warnings, "focusCount": counts,
            "review": ["blocksDone": review.done, "blocksSkipped": review.skipped,
                       "focused": loadingOrder.filter(review.focused.contains),
                       "unfocused": loadingOrder.filter { !review.focused.contains($0) }],
        ]
        if ids { plan["id"] = Self.planId }
        if let c = currentWeek { plan["currentWeek"] = c }
        if buffer > 0 { plan["bufferStart"] = day(bufferStart) }
        if let nextId, let nextStart, !nextStarted {
            plan["next"] = ["blockId": nextId, "startsOn": nextStartsOn ?? nextStart, "reason": nextReason]
        }
        if let unlinked { plan["unlinkedRunning"] = unlinked }
        return plan
    }
}

/// The year-plan operations of `PlanPreviewTransport`: nil = 404.
enum EvesTervPreviewServer {
    nonisolated(unsafe) private static var plan = EvesTervFixture.scenario(
        EvesTervPreview.kovetkezik.map { "kovetkezik-\($0)" } ?? EvesTervPreview.screen)

    /// A block was started with a year block id (the card's „Indítás"): the year now has a planned mesocycle.
    static func started(yearBlockId: String?) {
        guard yearBlockId != nil else { return }
        plan.nextStarted = true
    }

    static func answer(_ operationID: String, path: String?, sent: [String: Any]?) -> Any? {
        switch operationID {
        case "previewYearPlan":
            return EvesTervFixture.proposal(start: sent?["startDate"] as? String ?? plan.start,
                                            blockWeeks: sent?["blockWeeks"] as? Int ?? 6,
                                            emphasis: sent?["emphasis"] as? [String] ?? []).json(ids: false)
        case "createYearPlan":
            let p = EvesTervFixture.proposal(start: sent?["startDate"] as? String ?? plan.start,
                                             blockWeeks: sent?["blockWeeks"] as? Int ?? 6,
                                             emphasis: sent?["emphasis"] as? [String] ?? [])
            plan = p
            return p.json(ids: true)
        case "getActiveYearPlan":
            return plan.exists && !plan.archived ? plan.json(ids: true) : nil
        case "patchYearBlock":
            let id = path?.split(separator: "/").last.map(String.init) ?? ""
            guard let serial = Int(id.suffix(12)), plan.patch(serial, sent ?? [:]) else { return nil }
            return plan.json(ids: true)
        case "archiveYearPlan":
            plan.archived = true
            return plan.json(ids: true)
        default:
            return nil
        }
    }
}
#endif
