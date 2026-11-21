#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (`-preview shell -previewHome level`): the mail API answered locally with invented,
/// real-looking mail (the spike's: a bank, a sister-in-law, a shoe shop at −32 %, a phishing "Maldív-szigetek") —
/// never the owner's. The Mac's firewall blocks the simulator app's network, so this is how the area is looked at.
///
/// `-previewLevel normal|empty|loading|failed|rulesOnly|rulesOnlyFailure|disconnected|connected|stalled|authFailed|offline|cooldown`
/// (default `normal`; `connected` = `normal`, meant for `-levelTab Fiókok`): a full day · a quiet day · the digest
/// never answers · the digest answers 500 · part of the day rules-only (the cap) · rules-only (the model failed) ·
/// no mailbox yet · the same as normal · the mailbox went quiet · the app password was revoked · no net (the cache is
/// primed five hours old) · "Átnézés most" answers 429. `-levelTab Ma|Figyelt|Szabályok|Fiókok`.
/// Writes are kept for the run; the app password `wrong` is refused with 422, so the form's error can be seen.
enum LevelPreview {
    static let raw = RawJSONClient(transport: LevelPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })
    static let client = LevelClient(raw: raw)
    static var state: String { UserDefaults.standard.string(forKey: "previewLevel") ?? "normal" }

    /// `-previewLevel offline`: what the cache would hold from a read five hours ago.
    static func primeCache(_ directory: URL) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        let model = LevelPreviewModel(state: "normal")
        try? await cache.put(model.digest(), endpoint: "level/digest", date: levelDay(Date()))
        try? await cache.put(model.mailbox, endpoint: "level/mailbox", date: "current")
    }
}

/// The preview's mailbox, rules and verdicts, kept for the run so a connect, a detach or a rule edit shows its effect.
final class LevelPreviewModel: @unchecked Sendable {
    let lock = NSLock()
    let state: String
    var mailbox: LevelMailbox
    var rules: LevelRules
    var runs = 0

    init(state: String) {
        self.state = state
        let at = Self.at(0, 8, 0)
        switch state {
        case "disconnected": mailbox = LevelMailbox(address: nil, state: .none)
        case "stalled": mailbox = LevelMailbox(address: "boop.posta@example.com", state: .silent, lastRunAt: at, lastFetched: 0)
        case "authFailed": mailbox = LevelMailbox(address: "boop.posta@example.com", state: .authFailed, lastRunAt: at, lastFetched: 0)
        default: mailbox = LevelMailbox(address: "boop.posta@example.com", state: .connected, lastRunAt: at, lastFetched: 34)
        }
        func seed(_ p: String) -> LevelRule { LevelRule(pattern: p, origin: .seed) }
        func own(_ p: String) -> LevelRule { LevelRule(pattern: p, origin: .owner) }
        rules = LevelRules(sensitive: ["Bank", "Biztosító", "Hivatal", "Egészségügy", "Belépőkódok"].map(seed) + [own("Városi Fogászat")],
                           silent: ["Hétvégi Divat", "Játékhíradó", "Olcsó Telefon Bolt"].map(own),
                           always: ["Kiss Réka", "Futóbolt"].map(own),
                           proposals: [LevelSilentProposal(fromAddress: "Sportbolt hírlevél", nopes: 3)])
    }

    /// A moment `days` from today at hh:mm, Budapest time.
    static func at(_ days: Int, _ hour: Int, _ minute: Int) -> Date {
        let day = levelCalendar.date(byAdding: .day, value: days, to: Date()) ?? Date()
        return levelCalendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }

    func digest() -> LevelDigest {
        let connected = mailbox.state != .none && mailbox.state != .disconnected
        if !connected {
            return LevelDigest(lastRunAt: nil, mailboxState: mailbox.state)
        }
        if state == "empty" {
            return LevelDigest(lastRunAt: Self.at(0, 8, 0), arrived: 12, worthAMinute: 0, handled: 12,
                               heatSlots: [0, 0, 1, 2, 7, 2, 0, 0, 0, 0, 0, 0],
                               rest: [LevelRestGroup(category: "Hírlevelek", count: 7), LevelRestGroup(category: "Értesítők", count: 3),
                                      LevelRestGroup(category: "Közösségi", count: 2)])
        }
        let rulesOnly = state == "rulesOnly" || state == "rulesOnlyFailure"
        func deal(_ id: String, _ from: String, _ title: String, _ why: String, _ score: Int?, until: Date?, notifiable: Bool = false,
                  flagged: Bool = false) -> LevelItem {
            LevelItem(id: id, group: .deal, category: "Akció", title: title, summary: id == "e1" ? "Az ár a legalacsonyabb, amit erre a cipőre láttam. Ma éjfélig érvényes." : "", why: why, score: rulesOnly ? nil : score, validUntil: until,
                      screen: flagged ? .flagged : .clean, flagged: flagged, notifiable: notifiable && !rulesOnly,
                      fromName: from, fromAddress: "info@example.com", via: .gmail, receivedAt: Self.at(0, 7, 20), gmailMessageId: "1845026571234567\(id.count)")
        }
        return LevelDigest(
            lastRunAt: Self.at(0, 8, 0), mailboxState: mailbox.state, rulesOnly: rulesOnly,
            rulesOnlyReason: state == "rulesOnly" ? .cap : (state == "rulesOnlyFailure" ? .failure : nil),
            arrived: 34, worthAMinute: 2, handled: 31, heatSlots: [0, 1, 1, 3, 19, 9, 6, 11, 5, 3, 1, 0],
            people: [LevelItem(id: "p1", group: .person, category: "Személyes", title: "Szombati terv", score: nil, screen: .none,
                               fromName: "Kiss Réka", fromAddress: "reka@example.com", via: .gmail, receivedAt: Self.at(0, 7, 42),
                               gmailMessageId: "1845026571234001")],
            sensitive: [LevelItem(id: "s1", group: .sensitive, category: "Bank", title: "", screen: .none, flagged: false,
                                  fromName: "A bankod", fromAddress: "bank@example.com", via: .gmail, receivedAt: Self.at(0, 7, 15))],
            deadlines: [
                LevelItem(id: "d1", group: .deadline, category: "Jelentkezés", title: "Tanfolyam-jelentkezés", summary: "Lezárul 23:59-kor",
                          dueAt: Self.at(0, 23, 59), screen: .none, fromName: "Esti Iskola", via: .gmail, receivedAt: Self.at(0, 7, 30), gmailMessageId: "1845026571234002"),
                LevelItem(id: "d2", group: .deadline, category: "Számla", title: "Áramszámla", summary: "Esedékes · átutalással",
                          dueAt: Self.at(1, 12, 0), amountMinor: 1_482_000, currency: "HUF", screen: .none, fromName: "Áramszolgáltató", via: .gmail, receivedAt: Self.at(0, 6, 50)),
                LevelItem(id: "d3", group: .deadline, category: "Utazás", title: "Szállásfoglalás · Balaton", summary: "Bejelentkezés 14:00-tól",
                          dueAt: Self.at(4, 14, 0), screen: .none, fromName: "Balatoni Szállás", via: .gmail, receivedAt: Self.at(-1, 18, 0)),
                LevelItem(id: "d4", group: .deadline, category: "Jegy", title: "Koncert", summary: "Kapunyitás 19:00 · jegy a levélben",
                          dueAt: Self.at(5, 20, 0), screen: .none, fromName: "Jegyiroda", via: .gmail, receivedAt: Self.at(-2, 12, 0)),
            ],
            parcels: [
                LevelItem(id: "c1", group: .parcel, category: "Csomag", title: "Futóbolt · futózokni", summary: "GLS · kiszállítás 10–14 óra között",
                          carrier: "GLS", parcelState: .today, screen: .none, fromName: "Futóbolt", receivedAt: Self.at(0, 7, 0)),
                LevelItem(id: "c2", group: .parcel, category: "Csomag", title: "Könyvrendelés", summary: "Csomagpont · még 3 napig vár",
                          parcelState: .pickup, screen: .none, fromName: "Könyvesbolt", receivedAt: Self.at(-1, 9, 0)),
                LevelItem(id: "c3", group: .parcel, category: "Csomag", title: "Okosmérleg", summary: "Postával · tegnap indult",
                          carrier: "Posta", parcelState: .inTransit, screen: .none, fromName: "Webshop", receivedAt: Self.at(-1, 14, 0)),
            ],
            deals: [
                deal("e1", "Futóbolt", "A kinézett futócipő 32%-kal olcsóbb", "Ez a cipő van a figyelőlistádon, és a mostanit 780 km után cserélned kell.", 9,
                     until: Self.at(0, 23, 59), notifiable: true),
                deal("e2", "Fehérjebolt", "Akció a szokásos fehérjeporodra",
                     "Pontosan annyiba kerül, mint márciusban. Három hétre elég még a zacskód.", 5, until: Self.at(3, 18, 0)),
                deal("e3", "Prémium Utazás Klub", "Maldív-szigetek, 70% kedvezmény",
                     "Gyanús levél: a link nem oda vezet, ahová írja. Nem pontoztam, és ne kattints rá.", nil, until: nil, flagged: true),
            ],
            rest: [LevelRestGroup(category: "Hírlevelek", count: 12), LevelRestGroup(category: "Értesítők", count: 9),
                   LevelRestGroup(category: "Közösségi", count: 6)])
    }
}

/// The mail operations, answered from `LevelPreviewModel`.
struct LevelPreviewTransport: ClientTransport {
    nonisolated(unsafe) static let model = LevelPreviewModel(state: LevelPreview.state)

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(350))
        let state = LevelPreview.state
        if state == "offline" { throw URLError(.notConnectedToInternet) }
        // The digest never answers: the loading states can be looked at for as long as needed.
        if state == "loading", operationID == "getMailDigest" { try await Task.sleep(for: .seconds(3600)) }
        if state == "failed", operationID == "getMailDigest" { return (HTTPResponse(status: .internalServerError), nil) }
        var sent = Data()
        if let body { sent = try await Data(collecting: body, upTo: 1 << 16) }
        let m = Self.model
        let enc = JSONEncoder()
        func refuse(_ status: Int, _ code: String) -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(#"[{"code":"\#(code)"}]"#))
        }
        func json<T: Encodable>(_ value: T) throws -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(try enc.encode(value)))
        }
        return try m.lock.withLock {
            switch operationID {
            case "getMailMailbox": return try json(m.mailbox)
            case "getMailDigest": return try json(m.digest())
            case "putMailMailbox":
                struct C: Decodable { let address: String; let appPassword: String }
                let c = try JSONDecoder().decode(C.self, from: sent)
                if c.appPassword == "wrong" { return refuse(422, "MAIL_AUTH_FAILED") }
                m.mailbox = LevelMailbox(address: c.address, state: .connected, lastRunAt: nil, lastFetched: nil)
                return try json(m.mailbox)
            case "deleteMailMailbox":
                m.mailbox = LevelMailbox(address: nil, state: .none)
                return try json(m.mailbox)
            case "runMailMailbox":
                m.runs += 1
                if state == "cooldown" || m.runs > 1 { return refuse(429, "MAIL_RUN_COOLDOWN") }
                return (HTTPResponse(status: .accepted), nil)
            case "postMailFeedback": return (HTTPResponse(status: .noContent), nil)
            case "getMailRules": return try json(m.rules)
            case "putMailRules":
                let r = try JSONDecoder().decode(LevelRulesRequest.self, from: sent)
                let seeds = m.rules.sensitive.filter { $0.origin == .seed }
                m.rules.sensitive = seeds + r.sensitive.map { LevelRule(pattern: $0, origin: .owner) }
                m.rules.silent = r.silent.map { LevelRule(pattern: $0, origin: .owner) }
                m.rules.always = r.always.map { LevelRule(pattern: $0, origin: .owner) }
                m.rules.proposals.removeAll { p in r.silent.contains { $0.caseInsensitiveCompare(p.fromAddress) == .orderedSame } }
                return try json(m.rules)
            default: return (HTTPResponse(status: .notFound), nil)
            }
        }
    }
}
#endif
