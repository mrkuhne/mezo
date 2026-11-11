import Foundation

/// The experts' fields (the council's voices); each one speaks only when the brief carries a line for it.
public enum ExpertField: Int, CaseIterable, Sendable {
    case alvas, mozgas, etkezes, kozerzet, szkeptikus
    public var label: String {
        switch self {
        case .alvas: "Alvás"
        case .mozgas: "Mozgás"
        case .etkezes: "Étkezés"
        case .kozerzet: "Közérzet"
        case .szkeptikus: "Szkeptikus"
        }
    }
}

public struct ExpertLine: Sendable, Equatable {
    public let field: ExpertField
    public let text: String
    public init(field: ExpertField, text: String) { self.field = field; self.text = text }
}

public struct ProposalFact: Sendable, Equatable {
    public let value: String, unit: String, label: String
    public init(value: String, unit: String, label: String) { self.value = value; self.unit = unit; self.label = label }
}

public struct Proposal: Sendable, Equatable, Identifiable {
    public enum Kind: Sendable, Equatable { case moveSession(to: String) }
    public let id: String
    public let kind: Kind
    public let text: String, sub: String, acceptedLine: String
    public let facts: [ProposalFact]
    public let experts: [ExpertLine]
}

public enum Proposals {
    public static let dailyCap = 3

    /// Today's proposals from the brief (B2: only the session-move source), minus the dismissed ones, capped.
    /// `conflictKept` is the morning store's "Marad így": the conflict is settled for the day, so no move is proposed.
    public static func from(_ brief: Brief, now: Date, dismissed: Set<String>, conflictKept: Bool,
                            calendar: Calendar = .current) -> [Proposal] {
        var out: [Proposal] = []
        if !conflictKept, let p = moveSession(brief, now: now, calendar: calendar),
           !dismissed.contains(dismissKey(date: brief.date, id: p.id)) {
            out.append(p)
        }
        return Array(out.prefix(dailyCap))
    }

    /// A dismissal belongs to one day: yesterday's key never hides today's proposal.
    public static func dismissKey(date: String, id: String) -> String { "\(date)|\(id)" }

    private static func moveSession(_ brief: Brief, now: Date, calendar: Calendar) -> Proposal? {
        guard let s = brief.day.session, let conflict = brief.conflict,
              !sessionMoved(planned: s.plannedTime, time: s.time),
              let planned = s.plannedTime ?? s.time, let plannedMin = minutes(planned) else { return nil }
        let c = calendar.dateComponents([.hour, .minute], from: now)
        guard (c.hour ?? 0) * 60 + (c.minute ?? 0) < plannedMin else { return nil }

        let t = conflict.suggestedTime
        let suffix = timeSuffix(t)

        var facts = [ProposalFact(value: "\(brief.day.calendar.count)", unit: "esemény", label: "a naptáradban ma")]
        if let forma = brief.metric(.forma).score {
            facts.append(ProposalFact(value: "\(forma)", unit: "", label: "a mai Formád"))
        }
        let sleep = brief.metric(.alvas)
        if sleep.score != nil, sleep.display != "–" {
            facts.append(ProposalFact(value: sleep.display, unit: "", label: "alvás az éjjel"))
        }

        var experts: [ExpertLine] = []
        if brief.day.bedtimeTarget != nil, !brief.tonightTip.isEmpty { experts.append(ExpertLine(field: .alvas, text: brief.tonightTip)) }
        experts.append(ExpertLine(field: .mozgas, text: conflict.text))
        if let tip = brief.nextMealTip { experts.append(ExpertLine(field: .etkezes, text: tip)) }

        return Proposal(id: "move-session", kind: .moveSession(to: t), text: "Told \(t)-\(suffix) az edzést",
                        sub: conflict.text, acceptedLine: "Az edzés \(t)-\(suffix) került", facts: facts, experts: experts)
    }

    private static func minutes(_ hhmm: String) -> Int? {
        let p = hhmm.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
        return h * 60 + m
    }
}
