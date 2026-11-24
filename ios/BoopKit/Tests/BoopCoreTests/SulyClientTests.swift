import Foundation
import Testing
@testable import BoopCore

/// The weight trend and the weigh-ins over the lenient JSON caller (`mezo-r36n9.158`): invented figures.
@Suite("Súly — the weight client")
struct SulyClientTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.invalid")!, token: { "t" })
    }

    static let trendJSON = #"""
    {"ewmaSeries":[{"date":"2026-11-16","trendKg":84.9},{"date":"2026-11-23","trendKg":84.6}],
     "latestTrendKg":84.6,"weeklyRateKgPerWeek":-0.38,"weeklyRatePctPerWeek":-0.45,"last4wRateKgPerWeek":-0.42,
     "dataSufficiency":"full"}
    """#

    static let logsJSON = #"""
    [{"id":"w1","date":"2026-11-23","value":84.9,"note":null},{"id":"w2","date":"2026-11-24","value":84.6,"note":"reggel"}]
    """#

    @Test func trendDecodesTheContract() async throws {
        let stub = StubTransport()
        stub.on("getWeightTrend", .json(200, Self.trendJSON))
        let t = try await SulyClient(raw: Self.raw(stub)).trend()
        #expect(t.ewmaSeries.count == 2 && t.ewmaSeries.last?.trendKg == 84.6)
        #expect(t.latestTrendKg == 84.6 && t.last4wRateKgPerWeek == -0.42 && t.weeklyRateKgPerWeek == -0.38)
        #expect(t.dataSufficiency == "full")
        #expect(stub.sent.first?.path == "/api/biometrics/weight/trend")
    }

    @Test func trendWithoutRatesIsLenient() async throws {
        let stub = StubTransport()
        stub.on("getWeightTrend", .json(200, #"{"ewmaSeries":[],"dataSufficiency":"none"}"#))
        let t = try await SulyClient(raw: Self.raw(stub)).trend()
        #expect(t.ewmaSeries.isEmpty && t.latestTrendKg == nil && t.last4wRateKgPerWeek == nil)
        #expect(t.dataSufficiency == "none")
    }

    @Test func logsMapValueToKg() async throws {
        let stub = StubTransport()
        stub.on("listWeightLogs", .json(200, Self.logsJSON))
        let logs = try await SulyClient(raw: Self.raw(stub)).logs()
        #expect(logs.map(\.kg) == [84.9, 84.6])
        #expect(logs.last?.note == "reggel" && logs.first?.note == nil)
        #expect(logs.first?.id == "w1" && logs.first?.date == "2026-11-23")
        #expect(stub.sent.first?.path == "/api/biometrics/weight")
    }

    @Test func aServerFaultIsTyped() async {
        let stub = StubTransport()
        stub.on("getWeightTrend", .status(500))
        await #expect(throws: PlanFetchError.server) { try await SulyClient(raw: Self.raw(stub)).trend() }
    }
}
