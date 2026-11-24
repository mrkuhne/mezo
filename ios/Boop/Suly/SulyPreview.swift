#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (`-preview shell -previewHome suly`): the weight endpoints answered locally with invented,
/// real-looking figures (the Évad preview's season: 84,1 kg → 82, planned −0,4 kg a week) — never the owner's. The
/// Mac's firewall blocks the simulator app's network, so this is how the Súly area is looked at.
///
/// `-sulyState full|noseason|empty|offline|error` (default `full`): a cut on course · no active season (the head says
/// so, the trend still draws) · no weigh-ins and no trend yet · no net (the cache is primed five hours old) · the
/// server failing. `-previewOffline YES` is the same as `offline`.
enum SulyPreview {
    static var state: String {
        UserDefaults.standard.bool(forKey: "previewOffline") ? "offline" : (UserDefaults.standard.string(forKey: "sulyState") ?? "full")
    }
    static let raw = RawJSONClient(transport: SulyPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })

    @MainActor static func store(cache: ServerCache?) -> SulyStore {
        SulyStore(evad: state == "noseason" ? EvadClient(raw: SulyPreviewTransport.noSeasonRaw) : EvadPreviewFixtures.client,
                  client: SulyClient(raw: raw), health: PreviewHealthReader(), cache: cache)
    }

    /// `offline`: what the cache would hold from a read five hours ago.
    @MainActor static func primeCache(_ directory: URL) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        let online = SulyStore(evad: EvadPreviewFixtures.client, client: SulyClient(raw: SulyPreviewTransport.onlineRaw),
                               health: PreviewHealthReader(), cache: cache, clock: { earlier })
        await online.load()
    }

    /// Today in the preview's zone, `yyyy-MM-dd`.
    static var today: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Europe/Budapest"); return f.string(from: Date())
    }

    /// Eight weeks of invented weigh-ins ending today (most days, a few skipped), oldest first.
    static func logs() -> [[String: Any]] {
        var out: [[String: Any]] = []
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        for back in stride(from: 55, through: 0, by: -1) where back % 7 != 3 && back % 11 != 5 {
            let d = cal.date(byAdding: .day, value: -back, to: now)!
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Europe/Budapest")
            let kg = 86.9 - Double(55 - back) * 0.05 + (back % 3 == 0 ? 0.3 : (back % 2 == 0 ? -0.2 : 0.1))
            out.append(["id": "w\(back)", "date": f.string(from: d), "value": (kg * 10).rounded() / 10, "note": NSNull()])
        }
        return out
    }

    static func trend() -> [String: Any] {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Europe/Budapest")
        let series: [[String: Any]] = stride(from: 55, through: 0, by: -1).map { back in
            ["date": f.string(from: cal.date(byAdding: .day, value: -back, to: now)!), "trendKg": ((86.9 - Double(55 - back) * 0.051) * 100).rounded() / 100]
        }
        // −0,336 kg a week against the season's planned −0,4: 0,84 → the ring says 84.
        return ["ewmaSeries": series, "latestTrendKg": 84.1, "weeklyRateKgPerWeek": -0.35, "weeklyRatePctPerWeek": -0.42,
                "last4wRateKgPerWeek": -0.336, "dataSufficiency": "full"]
    }
}

struct SulyPreviewTransport: ClientTransport {
    /// The same transport with the net cut (the cache priming reads through this one).
    static let onlineRaw = RawJSONClient(transport: SulyPreviewTransport(forceOnline: true), baseURL: URL(string: "https://preview.invalid")!,
                                         token: { "preview" })
    /// A season API that has no active season.
    static let noSeasonRaw = RawJSONClient(transport: SulyPreviewTransport(noSeason: true), baseURL: URL(string: "https://preview.invalid")!,
                                           token: { "preview" })
    var forceOnline = false
    var noSeason = false

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(300))
        let state = forceOnline ? "full" : SulyPreview.state
        if state == "offline" { throw URLError(.notConnectedToInternet) }
        if state == "error" { return (HTTPResponse(status: .internalServerError), nil) }
        func json(_ object: Any, _ status: Int = 200) throws -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(try JSONSerialization.data(withJSONObject: object)))
        }
        if noSeason { return try json(["messages": [["code": "NOT_FOUND"]]], 404) }
        switch operationID {
        case "getWeightTrend":
            return try json(state == "empty" ? ["ewmaSeries": [], "dataSufficiency": "none"] : SulyPreview.trend())
        case "listWeightLogs":
            return try json(state == "empty" ? [] : SulyPreview.logs())
        case "getBiometricProfile":
            return try json(["sex": "M", "heightCm": 180, "birthDate": "1990-05-01"])
        default:
            return (HTTPResponse(status: .notFound), nil)
        }
    }
}

/// Apple Health in the simulator has nothing: twelve invented Feelfit readings over ninety days.
struct PreviewHealthReader: HealthReader {
    func sleepSamples(from: Date, to: Date) async throws -> [SleepSample] { [] }
    func sleepChanges(anchor: Data?, from: Date) async throws -> HealthChange<SleepSample> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals] { [] }
    func workoutChanges(anchor: Data?, from: Date) async throws -> HealthChange<WorkoutSample> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func sampleChanges(_ metric: HealthMetric, anchor: Data?, from: Date) async throws -> HealthChange<HealthSampleValue> { HealthChange(added: [], deletedIds: [], anchor: Data()) }
    func heartRateBuckets(from: Date, to: Date) async throws -> [HeartRateBucket] { [] }
    func heartRate(during intervals: [DateInterval]) async throws -> HeartRateStats? { nil }
    func readSamples(_ metric: HealthMetric, from: Date, to: Date) async throws -> [HealthSampleValue] {
        guard SulyPreview.state != "empty", metric == .bodyFatPct || metric == .leanBodyMass else { return [] }
        let fat = [23.9, 23.6, 23.4, 23.1, 22.9, 22.6, 22.4, 22.1, 21.9, 21.7, 21.5, 21.4]
        let lean = [63.1, 63.0, 63.1, 62.9, 63.0, 62.9, 62.8, 62.9, 62.8, 62.7, 62.8, 62.8]
        return (0..<12).map { i in
            let t = to.addingTimeInterval(-Double(11 - i) * 8 * 86_400 - 3600)
            let v = metric == .bodyFatPct ? fat[i] / 100 : lean[i]
            return HealthSampleValue(uuid: UUID(), metric: metric, start: t, end: t, value: v, sourceName: "Feelfit",
                                     sourceBundle: "com.feelfit.health", device: "Feelfit")
        }
    }
}
#endif
