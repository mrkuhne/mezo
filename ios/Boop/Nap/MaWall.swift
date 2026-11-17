import SwiftUI
import BoopCore
import BoopDesign

/// **Ma's living wall** (L0/b, `mezo-r36n9.45`): what Boop wants to say right now — at most three cards in the
/// three fixed roles, the check-in pinned above them while it is due, and "Ma történt" under them.
///
/// The choosing is the engine's (`BoopCore/Morning/Wall.swift`), the drawing is the kit's
/// (`BoopDesign/Napkelte/Wall.swift`); this is the wiring: it asks the registered areas what they have, hands
/// the answer to the engine, and turns a tap into something happening.
struct MaWall: View {
    let brief: Brief
    let ctx: MaiContext
    /// The food area's light read (the plan and the supplement groups) — already on the page.
    let etel: EtelStore
    /// The day's ledger: whether the check-in is due.
    let ledgerDay: DayLedger?
    /// The day page puts the wall under a "Most" heading with the number of cards on it; a surface that already
    /// says what the block is passes false.
    var heading = false
    let onDrill: (Hue) -> Void
    let onCheckIn: () -> Void
    let onMeal: () -> Void
    let onEtelRoom: () -> Void

    /// What he has acted on or dismissed today, and the lines they left behind. Kept per day, so tomorrow starts
    /// clean on its own without anything having to clear it.
    @AppStorage("wallActedDate") private var actedDate = ""
    @AppStorage("wallActed") private var actedRaw = ""
    @AppStorage("wallSettled") private var settledRaw = ""
    @State private var why: WallCandidate?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var today: String { brief.date }

    // MARK: what the areas have to say

    /// The registry is built here so a new area joins by adding one line — the engine and the kit never learn
    /// its name (B5 Edzés, then Pénz and Levél).
    private var registry: WallRegistry {
        var r = WallRegistry()
        r.register(WallSource(id: WallSources.etel) { [plan = etel.plan, groups = etel.groups, taken = etel.taken] input in
            etelWallCandidates(plan: plan, now: input.now,
                               supplementsDue: dueSupplements(groups, taken: taken, now: input.now))
        })
        r.register(WallSource(id: WallSources.edzes) { [brief] input in
            edzesWallCandidates(brief, now: input.now)
        })
        r.register(WallSource(id: "brief") { [brief] input in
            briefWallCandidates(brief, now: input.now)
        })
        return r
    }

    private var wall: Wall {
        buildWall(Self.forceEmpty ? [] : registry.candidates(WallInput(now: ctx.now, day: ctx.now)),
                  now: ctx.now, acted: acted,
                  checkIn: Self.forceEmpty ? .notDue : checkIn,
                  settled: settled, nextVoice: nextVoice)
    }

    /// Simulator review: `-previewWallEmpty YES` shows the quiet wall deliberately. An empty wall is good news
    /// and it is the state hardest to see by accident, so it has its own switch.
    private static var forceEmpty: Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: "previewWallEmpty")
        #else
        false
        #endif
    }

    private var checkIn: WallCheckIn {
        guard let slot = dueCheckIn(brief, day: ledgerDay, now: ctx.now) else { return .notDue }
        return .due(prompt: "Hogy vagy most?", sub: "Három kérdés, fél perc — a \(slot) óta.")
    }

    var body: some View {
        VStack(spacing: 16) {
            if heading {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("Most").nkFont(28, design: .serif).foregroundStyle(.white)
                    let n = wall.cards.count + (wall.checkIn.isDue ? 1 : 0)
                    if n > 0 {
                        Text("\(n)").nkFont(13, .semibold).foregroundStyle(NK.ground)
                            .frame(minWidth: 22, minHeight: 22)
                            .background(Capsule().fill(.white))
                    }
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }
            if case .due(let prompt, let sub) = wall.checkIn {
                NKWallQuestion(hue: .pulzus, prompt: prompt, sub: sub, onAnswer: onCheckIn,
                               onLater: { settle(id: "checkin", line: "Check-in későbbre téve") })
            }
            if let hero = wall.hero {
                NKWallHero(item: item(hero), onAct: { _ in act(hero) }, onWhy: { why = hero })
            }
            NKWallRows(items: wall.rows.map(item),
                       onAct: { id, _ in if let c = wall.rows.first(where: { $0.id == id }) { act(c) } },
                       onWhy: { id in why = wall.rows.first { $0.id == id } })
            if wall.hero == nil, wall.rows.isEmpty, let line = wall.emptyLine {
                NKWallQuiet(hue: ctx.hue, line: line)
            }
            if !wall.settledToday.isEmpty { settledSection }
        }
        .animation(reduceMotion ? nil : .smooth(duration: 0.35), value: wall.cards.map(\.id))
        .sheet(item: $why) { c in whySheet(c) }
    }

    @State private var settledOpen = false

    private var settledSection: some View {
        NKFoldRow("Ma történt", sub: "\(wall.settledToday.count) dolog", hue: ctx.hue, open: $settledOpen) {
            VStack(spacing: 0) {
                ForEach(wall.settledToday) { s in
                    NKSettledRow(line: s.line, at: wallTime(s.at, calendar: .current), hue: ctx.hue)
                }
            }
        }
    }

    private func whySheet(_ c: WallCandidate) -> some View {
        NKSheetFrame(hue: hue(c.area), eyebrow: c.kind.label, title: "Miért ezt mondom?") {
            Text(c.why).nkFont(16).lineSpacing(4).foregroundStyle(.white.opacity(0.88))
                .frame(maxWidth: .infinity, alignment: .leading).padding(20).nkGlass()
            NKBoopCard(pre: "A falon ", em: "három hely", post: " van: ami lejár, ami a legtöbbet javít, és ami történt. Ez a kártya a \(roleName(c.role)) helyén áll.")
        }
        .presentationDetents([.medium])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
    }

    // MARK: acting

    private func act(_ c: WallCandidate) {
        if c.id.hasPrefix("etel-window") || c.id == "etel-tip" { onMeal() }
        else if c.id == "etel-supplements" { onEtelRoom() }
        else if c.id == "edzes-keszulj" { onDrill(.mozgas) }
        settle(id: c.id, line: c.settled)
    }

    private func settle(id: String, line: String) {
        rollDay()
        var ids = acted; ids.insert(id)
        actedRaw = ids.sorted().joined(separator: "\n")
        settledRaw = ([settledLine(id: id, line: line, at: ctx.now)] + settledRaw.split(separator: "\n").map(String.init))
            .joined(separator: "\n")
    }

    // MARK: stored state

    private func rollDay() {
        guard actedDate != today else { return }
        actedDate = today; actedRaw = ""; settledRaw = ""
    }

    private var acted: Set<String> {
        guard actedDate == today else { return [] }
        return Set(actedRaw.split(separator: "\n").map(String.init))
    }

    private var settled: [WallSettled] {
        guard actedDate == today else { return [] }
        return settledRaw.split(separator: "\n").compactMap { parseSettled(String($0)) }
    }

    // MARK: mapping to the kit

    private func item(_ c: WallCandidate) -> NKWallItem {
        NKWallItem(id: c.id, hue: hue(c.area), eyebrow: c.kind.label,
                   when: c.expiresAt.map { "\(wallTime($0, calendar: .current))-ig" } ?? "",
                   text: c.text, sub: c.sub, big: c.big, bigUnit: c.bigUnit,
                   photo: nil,     // the meal's own photo needs the room's heavy day read; see boop-ios.md §9
                   primary: c.primary, secondary: c.secondary)
    }

    private var nextVoice: String? {
        brief.day.checkins.first { !$0.done }?.time
    }
}

// MARK: - Pure helpers (tested in BoopTests/MaWallTests)

/// The area key an area hands in, as a colour world.
func hue(_ area: String) -> Hue {
    switch area {
    case WallSources.etel: .fuel
    case WallSources.edzes: .mozgas
    case WallSources.alvas: .alvas
    case WallSources.energia: .pulzus
    default: .forma
    }
}

/// What the wall calls a slot when it explains itself.
func roleName(_ role: WallRole) -> String {
    switch role {
    case .expires: "ami lejár"
    case .improves: "ami a legtöbbet javít"
    case .happened: "ami történt"
    }
}

/// "Reggel · 4" while a daypart's group is still unticked; nil when nothing is owed. The first group whose part
/// of the day has started and that he has not ticked — never a group from later in the day.
func dueSupplements(_ groups: [SupplementGroup], taken: Set<String>, now: Date,
                    calendar: Calendar = .current) -> (label: String, count: Int)? {
    let minutes = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
    guard let g = groups.first(where: { !taken.contains($0.key) && groupStarted($0.key, byMinutes: minutes) })
    else { return nil }
    return (g.label, g.count)
}

/// Has this daypart started? Its indicative clock time is the room's own table, so the wall and the room never
/// disagree about when "Reggel" is.
func groupStarted(_ key: String, byMinutes: Int) -> Bool {
    guard let clock = supplementDayparts.first(where: { $0.key == key })?.clock,
          let parts = Optional(clock.split(separator: ":")), parts.count == 2,
          let h = Int(parts[0]), let m = Int(parts[1]) else { return true }
    return byMinutes >= h * 60 + m
}

/// Which check-in is due now, by its own clock time, and not answered — the slot's label for the question's sub.
func dueCheckIn(_ brief: Brief, day: DayLedger?, now: Date, calendar: Calendar = .current) -> String? {
    let answered = Set((day?.checkIns ?? []).map(\.slot))
    for c in brief.day.checkins where !c.done && !answered.contains(c.slot.rawValue) {
        if let t = wallClock(c.time, on: now, calendar: calendar), t <= now { return "\(c.time)-s" }
    }
    return nil
}

/// "id\tline\tepoch" — one settled card, as stored.
func settledLine(id: String, line: String, at: Date) -> String {
    "\(id)\t\(line)\t\(Int(at.timeIntervalSince1970))"
}

func parseSettled(_ raw: String) -> WallSettled? {
    let parts = raw.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    guard parts.count == 3, let epoch = TimeInterval(parts[2]) else { return nil }
    return WallSettled(id: parts[0], line: parts[1], at: Date(timeIntervalSince1970: epoch))
}
