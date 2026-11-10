import Foundation
import Observation
import OpenAPIRuntime
import BoopAPI

public enum MorningProblem: Equatable, Sendable {
    case offline, server
    /// The daily regeneration limit is used up (409 BOOP_REGENERATE_LIMIT_REACHED).
    case limit
    /// Nothing is planned to move (404 BOOP_NO_PLANNED_SESSION).
    case noSession
}

/// The Mai page's morning brief (Boop S3, mezo-r36n9.7): load, regenerate, move today's session, judge a pattern.
/// A 401 hands over to `onUnauthorized` (the app signs out); the previous brief stays on screen while a problem shows.
@MainActor @Observable
public final class MorningStore {
    public private(set) var brief: Brief?
    public private(set) var problem: MorningProblem?
    public private(set) var loading = false

    @ObservationIgnored private let client: Client
    @ObservationIgnored private let cal: Calendar
    @ObservationIgnored private let onUnauthorized: @MainActor () -> Void
    /// The time before the last move, for `undoMove` to restore locally.
    @ObservationIgnored private var movedFrom: String?

    public init(client: Client, calendar: Calendar = .current, onUnauthorized: @escaping @MainActor () -> Void) {
        self.client = client; self.cal = calendar; self.onUnauthorized = onUnauthorized
    }

    private enum Failure: Error { case unauthorized, offline, server, limit, noSession, badDate }

    private func ymd(_ date: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Loads the brief of the device-local day. A day the server still calls "the future"
    /// (device zone ahead of Europe/Budapest around midnight) is retried once as yesterday.
    public func load(date: Date) async {
        loading = true; defer { loading = false }
        do {
            do { brief = try await fetch(.get, ymd(date)) }
            catch Failure.badDate {
                guard let y = cal.date(byAdding: .day, value: -1, to: date) else { throw Failure.server }
                brief = try await fetch(.get, ymd(y))
            }
            problem = nil; movedFrom = nil
        } catch { fail(error) }
    }

    public func regenerate() async {
        guard let day = brief?.date else { return }
        do { brief = try await fetch(.regenerate, day); problem = nil; movedFrom = nil } catch { fail(error) }
    }

    public func moveSession(to time: String) async {
        guard let day = brief?.date else { return }
        do {
            switch try await client.setSessionTime(body: .json(.init(date: day, time: time))) {
            case .ok(let ok):
                let stored = try ok.body.json
                let before = brief?.day.session?.time
                if movedFrom == nil { movedFrom = before }
                brief?.day.session?.time = stored.time
                problem = nil
            case .badRequest: throw Failure.server
            case .unauthorized: throw Failure.unauthorized
            case .undocumented(let status, _): throw status == 404 ? Failure.noSession : Failure.server
            }
        } catch { fail(error) }
    }

    /// Back to the planned time.
    public func undoMove() async {
        guard let day = brief?.date else { return }
        do {
            switch try await client.clearSessionTime(query: .init(date: day)) {
            case .noContent:
                let planned = brief?.day.session?.plannedTime ?? movedFrom
                brief?.day.session?.time = planned
                movedFrom = nil; problem = nil
            case .unauthorized: throw Failure.unauthorized
            default: throw Failure.server
            }
        } catch { fail(error) }
    }

    /// Judges a pattern shown in the brief: `true` confirms, `false` rejects. The observation leaves the list.
    public func decide(observation id: String, true confirmed: Bool) async {
        guard let uuid = UUID(uuidString: id) else { problem = .server; return }
        do {
            switch try await client.decidePattern(path: .init(patternId: uuid.uuidString.lowercased()),
                                                  body: .json(.init(decision: confirmed ? "confirm" : "reject"))) {
            case .ok:
                brief?.day.observations.removeAll { $0.id == id }
                problem = nil
            case .unauthorized: throw Failure.unauthorized
            default: throw Failure.server
            }
        } catch { fail(error) }
    }

    private enum Op { case get, regenerate }

    private func fetch(_ op: Op, _ day: String) async throws -> Brief {
        do {
            switch op {
            case .get:
                switch try await client.getBoopBrief(query: .init(date: day)) {
                case .ok(let ok): return Brief(try ok.body.json)
                case .badRequest(let r): throw isDateError((try? r.body.json) ?? []) ? Failure.badDate : Failure.server
                case .unauthorized: throw Failure.unauthorized
                case .undocumented: throw Failure.server
                }
            case .regenerate:
                switch try await client.regenerateBoopBrief(query: .init(date: day)) {
                case .ok(let ok): return Brief(try ok.body.json)
                case .badRequest: throw Failure.server
                case .unauthorized: throw Failure.unauthorized
                case .conflict: throw Failure.limit
                case .undocumented: throw Failure.server
                }
            }
        } catch let f as Failure { throw f } catch { throw isNetworkFailure(error) ? Failure.offline : Failure.server }
    }

    private func isDateError(_ messages: [Components.Schemas.SystemMessage]) -> Bool {
        messages.contains { $0._type == .FIELD && $0.fieldName == "date" }
    }

    private func fail(_ error: Error) {
        switch error as? Failure {
        case .unauthorized?: onUnauthorized()
        case .offline?: problem = .offline
        case .limit?: problem = .limit
        case .noSession?: problem = .noSession
        default: problem = isNetworkFailure(error) ? .offline : .server
        }
    }
}
