import Foundation

// The Levél area's wire (mezo-r36n9.39) — hand-decoded over `RawJSONClient`, never through the generated client:
// the generated code decodes enums strictly, and the mail API grows (new groups, new parcel states, new screen
// verdicts) in parallel with the app. Here every enum decodes an unknown string to `.unknown` and a missing optional
// field to nil, so a value the app does not know yet costs one card, never the whole morning post.
//
// Everything is `Codable` so the digest can sit in `ServerCache`. **No password type lives here that is ever
// decoded or cached**: `LevelConnectRequest` is encode-only (it goes out once, on connect) and nothing the server
// sends back carries a secret.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
    /// An ISO-8601 instant sent as a string (with or without fractional seconds); anything else reads as nil.
    func instant(_ key: Key) -> Date? {
        let s: String? = optional(key)
        return s.flatMap(levelParseISO)
    }
}

private extension KeyedEncodingContainer {
    mutating func encodeInstant(_ date: Date?, forKey key: Key) throws {
        try encodeIfPresent(date.map(levelFormatISO), forKey: key)
    }
}

/// One array element that may fail on its own: a bad element is dropped, the rest of the list stays.
private struct Lossy<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

private extension KeyedDecodingContainer {
    func lossyList<T: Decodable>(_ key: Key) -> [T] {
        let all: [Lossy<T>] = ((try? decodeIfPresent([Lossy<T>].self, forKey: key)) ?? nil) ?? []
        return all.compactMap(\.value)
    }
}

func levelParseISO(_ s: String) -> Date? {
    // Java's Instant / OffsetDateTime print 0, 3, 6 or 9 fractional digits; ISO8601DateFormatter only copes with
    // some of them, so the fraction is lifted out, the rest parsed, and the fraction added back.
    var base = s, fraction = 0.0
    if let dot = s.firstIndex(of: ".") {
        var end = s.index(after: dot)
        while end < s.endIndex, s[end].isASCII, s[end].isNumber { end = s.index(after: end) }
        let digits = s[s.index(after: dot)..<end]
        guard !digits.isEmpty, let f = Double("0." + digits) else { return nil }
        fraction = f
        base = String(s[..<dot]) + String(s[end...])
    }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: base).map { $0.addingTimeInterval(fraction) }
}

func levelFormatISO(_ d: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.string(from: d)
}

// MARK: - Plain-string enums with an `.unknown` landing

/// Which part of the post an item lives in.
public enum LevelGroup: String, Codable, Sendable, Equatable {
    case person, sensitive, deadline, parcel, deal, rest, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelGroup(rawValue: raw) ?? .unknown
    }
}

/// The injection screen's verdict on an item. `.unknown` is treated like flagged by everything that notifies.
public enum LevelScreen: String, Codable, Sendable, Equatable {
    case none, clean, flagged, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelScreen(rawValue: raw) ?? .unknown
    }
}

public enum LevelParcelState: String, Codable, Sendable, Equatable {
    case inTransit = "in_transit", today, pickup, delivered, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelParcelState(rawValue: raw) ?? .unknown
    }
}

public enum LevelMailboxState: String, Codable, Sendable, Equatable {
    case none, connected, silent, authFailed = "auth_failed", disconnected, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelMailboxState(rawValue: raw) ?? .unknown
    }
}

/// How the mailbox is reached (`mail_mailbox.kind`); a kind the app does not know survives as `.unknown`.
public enum LevelMailboxKind: String, Codable, Sendable, Equatable {
    case imap, google, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelMailboxKind(rawValue: raw) ?? .unknown
    }
}

/// Which of his mailboxes forwarded the mail.
public enum LevelVia: String, Codable, Sendable, Equatable {
    case gmail, icloud, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelVia(rawValue: raw) ?? .unknown
    }
}

/// Why the day's post was sorted by rules alone.
public enum LevelRulesOnlyReason: String, Codable, Sendable, Equatable {
    case cap, failure, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelRulesOnlyReason(rawValue: raw) ?? .unknown
    }
}

public enum LevelRuleOrigin: String, Codable, Sendable, Equatable {
    case seed, owner, unknown
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = LevelRuleOrigin(rawValue: raw) ?? .unknown
    }
}

/// His answer on a card. These two strings are the contract's own (`^(interest|nope)$`).
public enum LevelVerdict: String, Codable, Sendable, Equatable {
    case interest, nope
}

// MARK: - The mailbox

public struct LevelMailbox: Codable, Equatable, Sendable {
    public var address: String?
    public var state: LevelMailboxState
    public var lastRunAt: Date?
    public var lastFetched: Int?
    /// nil = no mailbox yet.
    public var kind: LevelMailboxKind?
    /// The server's iOS OAuth client id (public); nil = Google sign-in is not set up on the server. Present even when
    /// there is no mailbox.
    public var googleClientId: String?

    public init(address: String? = nil, state: LevelMailboxState = .none, lastRunAt: Date? = nil, lastFetched: Int? = nil,
                kind: LevelMailboxKind? = nil, googleClientId: String? = nil) {
        self.address = address; self.state = state; self.lastRunAt = lastRunAt; self.lastFetched = lastFetched
        self.kind = kind; self.googleClientId = googleClientId
    }

    private enum CodingKeys: String, CodingKey { case address, state, lastRunAt, lastFetched, kind, googleClientId }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = (try? c.decodeIfPresent(LevelMailboxKind.self, forKey: .kind)) ?? nil
        googleClientId = c.optional(.googleClientId)
        address = c.optional(.address)
        state = c.lenient(.state, .unknown)
        lastRunAt = c.instant(.lastRunAt)
        lastFetched = c.optional(.lastFetched)
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(address, forKey: .address)
        try c.encode(state, forKey: .state)
        try c.encodeInstant(lastRunAt, forKey: .lastRunAt)
        try c.encodeIfPresent(lastFetched, forKey: .lastFetched)
        try c.encodeIfPresent(kind, forKey: .kind)
        try c.encodeIfPresent(googleClientId, forKey: .googleClientId)
    }
}

/// `POST /api/mail/mailbox/google` — encode-only: the one-time code and its PKCE verifier go out once; the server
/// exchanges them and keeps the refresh token.
struct LevelGoogleConnectRequest: Encodable {
    let code: String
    let codeVerifier: String
    let redirectUri: String
}

/// `PUT /api/mail/mailbox` — encode-only on purpose: the app password goes out once and is never read back, kept
/// or cached.
struct LevelConnectRequest: Encodable {
    let address: String
    let appPassword: String
}

// MARK: - The digest

/// One card of the post. A sensitive card carries the sender in `title` and nothing from the subject or body.
public struct LevelItem: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var group: LevelGroup
    public var category: String
    public var title: String
    public var summary: String
    public var why: String
    public var score: Int?
    public var dueAt: Date?
    public var validUntil: Date?
    public var amountMinor: Int64?
    public var currency: String?
    public var carrier: String?
    public var parcelState: LevelParcelState?
    public var stateChangedAt: Date?
    public var screen: LevelScreen
    public var flagged: Bool
    /// The server's own verdict that this one may ring the phone (score, clean screen, window, deadline).
    public var notifiable: Bool
    public var fromName: String?
    public var fromAddress: String?
    public var via: LevelVia?
    public var receivedAt: Date?
    /// X-GM-MSGID as a decimal string; the Gmail link is built from it.
    public var gmailMessageId: String?

    public init(id: String, group: LevelGroup, category: String = "", title: String, summary: String = "", why: String = "",
                score: Int? = nil, dueAt: Date? = nil, validUntil: Date? = nil, amountMinor: Int64? = nil,
                currency: String? = nil, carrier: String? = nil, parcelState: LevelParcelState? = nil,
                stateChangedAt: Date? = nil, screen: LevelScreen = .none, flagged: Bool = false, notifiable: Bool = false,
                fromName: String? = nil, fromAddress: String? = nil, via: LevelVia? = nil, receivedAt: Date? = nil,
                gmailMessageId: String? = nil) {
        self.id = id; self.group = group; self.category = category; self.title = title; self.summary = summary
        self.why = why; self.score = score; self.dueAt = dueAt; self.validUntil = validUntil
        self.amountMinor = amountMinor; self.currency = currency; self.carrier = carrier
        self.parcelState = parcelState; self.stateChangedAt = stateChangedAt; self.screen = screen
        self.flagged = flagged; self.notifiable = notifiable; self.fromName = fromName; self.fromAddress = fromAddress
        self.via = via; self.receivedAt = receivedAt; self.gmailMessageId = gmailMessageId
    }

    private enum CodingKeys: String, CodingKey {
        case id, group, category, title, summary, why, score, dueAt, validUntil, amountMinor, currency, carrier
        case parcelState, stateChangedAt, screen, flagged, notifiable, fromName, fromAddress, via, receivedAt, gmailMessageId
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        group = c.lenient(.group, .unknown)
        category = c.lenient(.category, "")
        title = c.lenient(.title, "")
        summary = c.lenient(.summary, "")
        why = c.lenient(.why, "")
        score = c.optional(.score)
        dueAt = c.instant(.dueAt)
        validUntil = c.instant(.validUntil)
        amountMinor = c.optional(.amountMinor)
        currency = c.optional(.currency)
        carrier = c.optional(.carrier)
        parcelState = c.optional(.parcelState)
        stateChangedAt = c.instant(.stateChangedAt)
        screen = c.lenient(.screen, .unknown)
        flagged = c.lenient(.flagged, false)
        notifiable = c.lenient(.notifiable, false)
        fromName = c.optional(.fromName)
        fromAddress = c.optional(.fromAddress)
        via = c.optional(.via)
        receivedAt = c.instant(.receivedAt)
        gmailMessageId = c.optional(.gmailMessageId)
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(group, forKey: .group); try c.encode(category, forKey: .category)
        try c.encode(title, forKey: .title); try c.encode(summary, forKey: .summary); try c.encode(why, forKey: .why)
        try c.encodeIfPresent(score, forKey: .score)
        try c.encodeInstant(dueAt, forKey: .dueAt); try c.encodeInstant(validUntil, forKey: .validUntil)
        try c.encodeIfPresent(amountMinor, forKey: .amountMinor); try c.encodeIfPresent(currency, forKey: .currency)
        try c.encodeIfPresent(carrier, forKey: .carrier); try c.encodeIfPresent(parcelState, forKey: .parcelState)
        try c.encodeInstant(stateChangedAt, forKey: .stateChangedAt)
        try c.encode(screen, forKey: .screen); try c.encode(flagged, forKey: .flagged)
        try c.encode(notifiable, forKey: .notifiable)
        try c.encodeIfPresent(fromName, forKey: .fromName); try c.encodeIfPresent(fromAddress, forKey: .fromAddress)
        try c.encodeIfPresent(via, forKey: .via); try c.encodeInstant(receivedAt, forKey: .receivedAt)
        try c.encodeIfPresent(gmailMessageId, forKey: .gmailMessageId)
    }
}

/// "category · count" of the mail Boop handled and folded away.
/// One line under a folded category of "A többi": the mail's own title and summary, and who sent it.
public struct LevelRestItem: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var summary: String
    public var fromName: String?
    public init(id: String, title: String, summary: String = "", fromName: String? = nil) {
        self.id = id; self.title = title; self.summary = summary; self.fromName = fromName
    }
    private enum CodingKeys: String, CodingKey { case id, title, summary, fromName }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let id: String = try c.decode(String.self, forKey: .id)   // a line without an id is dropped (Lossy)
        self.id = id
        title = c.lenient(.title, ""); summary = c.lenient(.summary, ""); fromName = c.optional(.fromName)
    }
}

public struct LevelRestGroup: Codable, Equatable, Sendable {
    public var category: String
    public var count: Int
    /// Up to 20 of the newest mails of the category; empty from a server that does not send them yet.
    public var items: [LevelRestItem]
    public init(category: String, count: Int, items: [LevelRestItem] = []) {
        self.category = category; self.count = count; self.items = items
    }
    private enum CodingKeys: String, CodingKey { case category, count, items }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = c.lenient(.category, ""); count = c.lenient(.count, 0); items = c.lossyList(.items)
    }
}

/// One day's post. Every number is the server's count; nothing here is derived into a figure the server did not send.
public struct LevelDigest: Codable, Equatable, Sendable {
    public var lastRunAt: Date?
    public var mailboxState: LevelMailboxState
    /// The day's post was sorted by rules alone (the cap was hit or the model failed); `rulesOnlyReason` says which.
    public var rulesOnly: Bool
    public var rulesOnlyReason: LevelRulesOnlyReason?
    public var arrived: Int
    public var worthAMinute: Int
    public var handled: Int
    public var heatSlots: [Int]
    public var people: [LevelItem]
    public var sensitive: [LevelItem]
    public var deadlines: [LevelItem]
    public var parcels: [LevelItem]
    public var deals: [LevelItem]
    public var rest: [LevelRestGroup]

    public init(lastRunAt: Date? = nil, mailboxState: LevelMailboxState = .connected, rulesOnly: Bool = false,
                rulesOnlyReason: LevelRulesOnlyReason? = nil, arrived: Int = 0, worthAMinute: Int = 0, handled: Int = 0,
                heatSlots: [Int] = [], people: [LevelItem] = [], sensitive: [LevelItem] = [], deadlines: [LevelItem] = [],
                parcels: [LevelItem] = [], deals: [LevelItem] = [], rest: [LevelRestGroup] = []) {
        self.lastRunAt = lastRunAt; self.mailboxState = mailboxState; self.rulesOnly = rulesOnly
        self.rulesOnlyReason = rulesOnlyReason; self.arrived = arrived; self.worthAMinute = worthAMinute
        self.handled = handled; self.heatSlots = heatSlots; self.people = people; self.sensitive = sensitive
        self.deadlines = deadlines; self.parcels = parcels; self.deals = deals; self.rest = rest
    }

    private enum CodingKeys: String, CodingKey {
        case lastRunAt, mailboxState, rulesOnly, rulesOnlyReason, arrived, worthAMinute, handled, heatSlots
        case people, sensitive, deadlines, parcels, deals, rest
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lastRunAt = c.instant(.lastRunAt)
        mailboxState = c.lenient(.mailboxState, .unknown)
        rulesOnly = c.lenient(.rulesOnly, false)
        rulesOnlyReason = c.optional(.rulesOnlyReason)
        arrived = c.lenient(.arrived, 0)
        worthAMinute = c.lenient(.worthAMinute, 0)
        handled = c.lenient(.handled, 0)
        heatSlots = c.lenient(.heatSlots, [])
        // An item without an id cannot take feedback or be told apart, so it is dropped with the broken ones.
        func items(_ key: CodingKeys) -> [LevelItem] { c.lossyList(key).filter { !$0.id.isEmpty } }
        people = items(.people); sensitive = items(.sensitive); deadlines = items(.deadlines)
        parcels = items(.parcels); deals = items(.deals); rest = c.lossyList(.rest)
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeInstant(lastRunAt, forKey: .lastRunAt)
        try c.encode(mailboxState, forKey: .mailboxState); try c.encode(rulesOnly, forKey: .rulesOnly)
        try c.encodeIfPresent(rulesOnlyReason, forKey: .rulesOnlyReason)
        try c.encode(arrived, forKey: .arrived); try c.encode(worthAMinute, forKey: .worthAMinute)
        try c.encode(handled, forKey: .handled); try c.encode(heatSlots, forKey: .heatSlots)
        try c.encode(people, forKey: .people); try c.encode(sensitive, forKey: .sensitive)
        try c.encode(deadlines, forKey: .deadlines); try c.encode(parcels, forKey: .parcels)
        try c.encode(deals, forKey: .deals); try c.encode(rest, forKey: .rest)
    }
}

// MARK: - The rules

public struct LevelRule: Codable, Equatable, Sendable {
    public var pattern: String
    public var origin: LevelRuleOrigin
    public init(pattern: String, origin: LevelRuleOrigin = .owner) { self.pattern = pattern; self.origin = origin }
    private enum CodingKeys: String, CodingKey { case pattern, origin }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pattern = c.lenient(.pattern, ""); origin = c.lenient(.origin, .unknown)
    }
}

/// A sender Boop proposes to silence after repeated "nem érdekel".
public struct LevelSilentProposal: Codable, Equatable, Sendable {
    public var fromAddress: String
    public var nopes: Int
    public init(fromAddress: String, nopes: Int) { self.fromAddress = fromAddress; self.nopes = nopes }
    private enum CodingKeys: String, CodingKey { case fromAddress, nopes }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fromAddress = c.lenient(.fromAddress, ""); nopes = c.lenient(.nopes, 0)
    }
}

public struct LevelRules: Codable, Equatable, Sendable {
    public var sensitive: [LevelRule]
    public var silent: [LevelRule]
    public var always: [LevelRule]
    public var proposals: [LevelSilentProposal]
    public init(sensitive: [LevelRule] = [], silent: [LevelRule] = [], always: [LevelRule] = [],
                proposals: [LevelSilentProposal] = []) {
        self.sensitive = sensitive; self.silent = silent; self.always = always; self.proposals = proposals
    }
    private enum CodingKeys: String, CodingKey { case sensitive, silent, always, proposals }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sensitive = c.lenient(.sensitive, []); silent = c.lenient(.silent, [])
        always = c.lenient(.always, []); proposals = c.lenient(.proposals, [])
    }

    /// What `saveRules` sends back: only the owner's own patterns (the seed rows are read-only on the server).
    public var ownerRequest: LevelRulesRequest {
        LevelRulesRequest(sensitive: sensitive.filter { $0.origin != .seed }.map(\.pattern),
                          silent: silent.filter { $0.origin != .seed }.map(\.pattern),
                          always: always.filter { $0.origin != .seed }.map(\.pattern))
    }
}

/// `PUT /api/mail/rules` — all three lists are required by the contract.
public struct LevelRulesRequest: Codable, Equatable, Sendable {
    public var sensitive: [String]
    public var silent: [String]
    public var always: [String]
    public init(sensitive: [String] = [], silent: [String] = [], always: [String] = []) {
        self.sensitive = sensitive; self.silent = silent; self.always = always
    }
}

struct LevelFeedbackRequest: Encodable { let verdict: String }
