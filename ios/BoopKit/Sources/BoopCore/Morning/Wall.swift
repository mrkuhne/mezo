import Foundation

// The living wall (L0/b, `mezo-r36n9.45`): Ma stops being the day's timeline and becomes what Boop wants to say
// right now — at most three cards, plus the check-in pinned above them while it is due.
//
// Owner decision #34 (2026-11-16): **three fixed roles, not one sort key.** Always in this order — what breaks if
// you don't do it now · what improves today the most · one thing that happened and you should know. Sorting by
// urgency alone turns the wall into a clock; sorting by impact alone is the least predictable and the hardest to
// explain. With fixed slots Boop can always say why it set something aside, and that is the whole argument.
//
// Owner decision #35: only a `.expires` candidate may ring the phone, at most twice a day.
//
// Everything here is pure: no SwiftUI, no network, no clock of its own. The areas hand in candidates; this file
// only chooses.

// MARK: - What an area hands in

/// The three slots of the wall, in the order they are always shown.
public enum WallRole: Int, Sendable, CaseIterable, Comparable {
    /// What breaks if he doesn't do it now: a closing window, the check-in while it is due.
    case expires
    /// What improves today the most.
    case improves
    /// One thing that happened and he should know.
    case happened

    public static func < (a: WallRole, b: WallRole) -> Bool { a.rawValue < b.rawValue }
}

/// What kind of thing a card is, in Boop's own vocabulary (the eyebrow the owner sees).
public enum WallKind: String, Sendable {
    case teendo, tortent, keszulj, reakcio

    public var label: String {
        switch self {
        case .teendo: "TEENDŐ"
        case .tortent: "TÖRTÉNT"
        case .keszulj: "KÉSZÜLJ"
        case .reakcio: "BOOP MONDJA"
        }
    }
}

/// One thing Boop could say now, handed in by an area.
public struct WallCandidate: Sendable, Identifiable, Equatable {
    public let id: String
    public let role: WallRole
    public let kind: WallKind
    /// Which area it came from, as that area's key — the hue, the orb and the registry all key off it.
    public let area: String
    /// When it stops being worth saying. Required for `.expires` (that is what the role means), and the sort key
    /// inside that slot; for the other two it is only a deadline after which the card is dropped.
    public let expiresAt: Date?
    /// For `.improves`: the source's own idea of how much this moves today, 0–1. Ignored in the other roles.
    public let rank: Double
    /// When it happened — the sort key inside `.happened`.
    public let happenedAt: Date?
    public let text: String, sub: String
    /// When the card IS a number, the number carries the weight instead of hiding inside the sentence.
    public let big: String?, bigUnit: String
    /// A photo of the **thing** (Képek variant B). nil where nothing fits — a near-miss photo is worse than none.
    public let photo: String?
    public let primary: String?, secondary: String?
    /// The line it leaves behind in "Ma történt" once he acts on it.
    public let settled: String
    /// Why Boop is saying this one — shown behind "miért?".
    public let why: String

    public init(id: String, role: WallRole, kind: WallKind, area: String, expiresAt: Date? = nil,
                rank: Double = 0, happenedAt: Date? = nil, text: String, sub: String = "",
                big: String? = nil, bigUnit: String = "", photo: String? = nil,
                primary: String? = nil, secondary: String? = nil, settled: String, why: String) {
        self.id = id; self.role = role; self.kind = kind; self.area = area; self.expiresAt = expiresAt
        self.rank = rank; self.happenedAt = happenedAt; self.text = text; self.sub = sub
        self.big = big; self.bigUnit = bigUnit; self.photo = photo
        self.primary = primary; self.secondary = secondary; self.settled = settled; self.why = why
    }

    /// Only the first slot may reach his pocket (decision #35).
    public var notifiable: Bool { role == .expires }
}

/// Where the check-in stands, which decides whether it pins above the wall.
public enum WallCheckIn: Sendable, Equatable {
    case due(prompt: String, sub: String)
    case notDue

    /// Is the question on the wall right now? (It is not one of the three cards, so it is counted on its own.)
    public var isDue: Bool { if case .due = self { true } else { false } }
}

// MARK: - What the wall is

/// A card that has left the wall because he acted on it.
public struct WallSettled: Sendable, Equatable, Identifiable {
    public let id: String
    public let line: String
    public let at: Date
    public init(id: String, line: String, at: Date) { self.id = id; self.line = line; self.at = at }
}

/// What Ma shows right now.
public struct Wall: Sendable, Equatable {
    /// Pinned above everything while it is due; it is a question, not a notice, and it is not one of the three.
    public let checkIn: WallCheckIn
    /// The card that reads big, with its photo band when the thing has one.
    public let hero: WallCandidate?
    /// The rest, as compact rows inside one card. Never more than two.
    public let rows: [WallCandidate]
    /// Everything he has already acted on today, newest first.
    public let settledToday: [WallSettled]
    /// Said when there is nothing on the wall. Empty is good news, not a failure.
    public let emptyLine: String?

    /// The three in display order, hero first.
    public var cards: [WallCandidate] { (hero.map { [$0] } ?? []) + rows }
    /// Nothing to say, and no question pending.
    public var isQuiet: Bool { hero == nil && rows.isEmpty && checkIn == .notDue }
}

// MARK: - Choosing

public enum WallText {
    public static let quiet = "Most nincs teendőd."
    /// "Most nincs teendőd. Legközelebb 17:00-kor szólok."
    public static func quiet(nextVoice: String?) -> String {
        guard let nextVoice else { return quiet }
        return "\(quiet) Legközelebb \(nextVoice)-kor szólok."
    }
}

/// Builds the wall: at most one card per role, at most three in all, in role order.
///
/// - `acted` are the ids he has already acted on or dismissed today — they never come back, and a slot they
///   vacate is **not** refilled from a lower role. The wall shrinks; it does not pad.
/// - `nextVoice` is when Boop next expects to have something ("17:00"), used only by the quiet line.
public func buildWall(_ candidates: [WallCandidate], now: Date, acted: Set<String> = [],
                      checkIn: WallCheckIn = .notDue, settled: [WallSettled] = [],
                      nextVoice: String? = nil) -> Wall {
    let live = candidates.filter { c in
        guard !acted.contains(c.id) else { return false }
        if let e = c.expiresAt, e <= now { return false }   // an expired card is not worth saying
        return true
    }
    let chosen = WallRole.allCases.compactMap { role in best(live.filter { $0.role == role }, in: role) }

    // The hero is the highest role present; the photo only decides how it looks, never which card wins — a
    // picture is not a reason to put something first.
    let hero = chosen.first
    let rows = Array(chosen.dropFirst())
    let quiet = hero == nil && checkIn == .notDue ? WallText.quiet(nextVoice: nextVoice) : nil
    return Wall(checkIn: checkIn, hero: hero, rows: rows,
                settledToday: settled.sorted { $0.at > $1.at }, emptyLine: quiet)
}

/// The one card that wins a slot. Each role has its own idea of "best", and ties fall back to the id so the wall
/// never reshuffles under him between two renders of the same day.
private func best(_ group: [WallCandidate], in role: WallRole) -> WallCandidate? {
    switch role {
    case .expires:
        // the soonest to go; a candidate in this role without a deadline sorts last
        return group.min {
            ($0.expiresAt ?? .distantFuture, $0.id) < ($1.expiresAt ?? .distantFuture, $1.id)
        }
    case .improves:
        return group.max { ($0.rank, $1.id) < ($1.rank, $0.id) }
    case .happened:
        return group.max {
            ($0.happenedAt ?? .distantPast, $1.id) < ($1.happenedAt ?? .distantPast, $0.id)
        }
    }
}

// MARK: - Reaching his pocket

/// Which of today's candidates may ring, given what has already rung. Only the first slot, and at most `cap` a
/// day (decision #35: the cap is part of the rule, not a setting).
///
/// `alreadyRang` are the ids that have rung today; `seen` are the ones he has already had on screen — Boop does
/// not ring for something he has looked at.
public func wallNotifications(_ candidates: [WallCandidate], now: Date, acted: Set<String> = [],
                              alreadyRang: Set<String> = [], seen: Set<String> = [],
                              cap: Int = 2) -> [WallCandidate] {
    let room = max(0, cap - alreadyRang.count)
    guard room > 0 else { return [] }
    return candidates
        .filter { $0.notifiable && !acted.contains($0.id) && !alreadyRang.contains($0.id) && !seen.contains($0.id) }
        .filter { ($0.expiresAt ?? .distantFuture) > now }
        .sorted { ($0.expiresAt ?? .distantFuture, $0.id) < ($1.expiresAt ?? .distantFuture, $1.id) }
        .prefix(room)
        .map { $0 }
}

// MARK: - The registry

/// What an area is given when the wall asks it what it has to say. It carries no area's own types: an area reads
/// its own state from its own store and hands back candidates.
public struct WallInput: Sendable {
    public let now: Date
    /// The day the wall is for, in the phone's own calendar.
    public let day: Date
    public init(now: Date, day: Date) { self.now = now; self.day = day }
}

/// One area's contribution to the wall. **A new area joins by registering one of these** — the engine and the
/// view never learn its name. That is the difference between a wall that grows and one that is rewritten every
/// slice (B5 Edzés, then Pénz and Levél).
public struct WallSource: Sendable, Identifiable {
    public let id: String
    public let candidates: @Sendable (WallInput) -> [WallCandidate]
    public init(id: String, candidates: @escaping @Sendable (WallInput) -> [WallCandidate]) {
        self.id = id; self.candidates = candidates
    }
}

/// The registered areas, in the order they were added. Registering the same id twice replaces it, so a source can
/// be swapped in a preview or a test without the list growing.
public struct WallRegistry: Sendable {
    public private(set) var sources: [WallSource] = []
    public init(_ sources: [WallSource] = []) { self.sources = sources }

    public mutating func register(_ source: WallSource) {
        if let i = sources.firstIndex(where: { $0.id == source.id }) { sources[i] = source }
        else { sources.append(source) }
    }

    /// Everything every area has to say, in registration order. Choosing happens in `buildWall`.
    public func candidates(_ input: WallInput) -> [WallCandidate] {
        sources.flatMap { $0.candidates(input) }
    }
}
