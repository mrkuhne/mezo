import Foundation

// The weekly long-horizon review wire (`mezo-r36n9.120`, contract `api/feature/penz/penz-weekly.yml`): "did anything
// this week change the long-term picture?", one section per sleeve. Hand-decoded and lenient like the digest's
// (`PenzPortfolioWire.swift`): every enum is a plain string the screens map, a missing field falls back to something
// visibly "nothing". `Codable` so it sits in `ServerCache` and Pénzem shows it offline.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
}

public struct PenzWeeklySource: Codable, Equatable, Sendable {
    public var name: String
    public var url: String
    public init(name: String, url: String) { self.name = name; self.url = url }
    private enum CodingKeys: String, CodingKey { case name, url }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = c.lenient(.name, ""); url = c.lenient(.url, "")
    }
}

/// One story of the week the reading relies on (`PenzWeeklyStory`).
public struct PenzWeeklyStory: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var holdingName: String?
    /// `holding`, `fx`, `rates`.
    public var kind: String
    public var sources: [PenzWeeklySource]
    public var publishedAt: String?
    public init(id: String, title: String, holdingName: String? = nil, kind: String = "holding",
                sources: [PenzWeeklySource] = [], publishedAt: String? = nil) {
        self.id = id; self.title = title; self.holdingName = holdingName; self.kind = kind; self.sources = sources
        self.publishedAt = publishedAt
    }
    private enum CodingKeys: String, CodingKey { case id, title, holdingName, kind, sources, publishedAt }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, ""); title = c.lenient(.title, ""); holdingName = c.optional(.holdingName)
        kind = c.lenient(.kind, "holding"); sources = c.lenient(.sources, []); publishedAt = c.optional(.publishedAt)
    }
}

/// One horizon's reading (`PenzWeeklySection`). Every figure is the backend's; the prose is validated or fixed copy.
public struct PenzWeeklySection: Codable, Equatable, Sendable, Identifiable {
    /// `short`, `mid`, `long`.
    public var sleeve: String
    public var horizonLabel: String
    public var storyCount: Int
    public var sourceCount: Int
    public var matters: Bool
    public var verdict: String
    public var body: String
    public var uncertainty: String
    public var noAction: String
    /// `model`, `fallback`, `quiet`.
    public var narratedBy: String
    public var coverageMonths: Int?
    public var stories: [PenzWeeklyStory]
    public var id: String { sleeve }

    public init(sleeve: String, horizonLabel: String, storyCount: Int = 0, sourceCount: Int = 0, matters: Bool = false,
                verdict: String, body: String = "", uncertainty: String = "", noAction: String = "",
                narratedBy: String = "model", coverageMonths: Int? = nil, stories: [PenzWeeklyStory] = []) {
        self.sleeve = sleeve; self.horizonLabel = horizonLabel; self.storyCount = storyCount; self.sourceCount = sourceCount
        self.matters = matters; self.verdict = verdict; self.body = body; self.uncertainty = uncertainty
        self.noAction = noAction; self.narratedBy = narratedBy; self.coverageMonths = coverageMonths; self.stories = stories
    }
    private enum CodingKeys: String, CodingKey {
        case sleeve, horizonLabel, storyCount, sourceCount, matters, verdict, body, uncertainty, noAction, narratedBy,
             coverageMonths, stories
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sleeve = c.lenient(.sleeve, "long"); horizonLabel = c.lenient(.horizonLabel, "")
        storyCount = max(0, c.lenient(.storyCount, 0)); sourceCount = max(0, c.lenient(.sourceCount, 0))
        matters = c.lenient(.matters, false); verdict = c.lenient(.verdict, ""); body = c.lenient(.body, "")
        uncertainty = c.lenient(.uncertainty, ""); noAction = c.lenient(.noAction, "")
        narratedBy = c.lenient(.narratedBy, "fallback"); coverageMonths = c.optional(.coverageMonths)
        stories = c.lenient(.stories, [])
    }
}

/// `GET /api/penz/weekly-review`.
public struct PenzWeeklyReview: Codable, Equatable, Sendable {
    /// The Monday and the Sunday of the reviewed week (`YYYY-MM-DD`).
    public var weekStart: String
    public var weekEnd: String
    /// `pending`, `ready`, `quiet`, `failed`.
    public var status: String
    public var generatedAt: String?
    public var sections: [PenzWeeklySection]

    public init(weekStart: String, weekEnd: String, status: String, generatedAt: String? = nil,
                sections: [PenzWeeklySection] = []) {
        self.weekStart = weekStart; self.weekEnd = weekEnd; self.status = status; self.generatedAt = generatedAt
        self.sections = sections
    }
    private enum CodingKeys: String, CodingKey { case weekStart, weekEnd, status, generatedAt, sections }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weekStart = c.lenient(.weekStart, ""); weekEnd = c.lenient(.weekEnd, ""); status = c.lenient(.status, "pending")
        generatedAt = c.optional(.generatedAt); sections = c.lenient(.sections, [])
    }
}
