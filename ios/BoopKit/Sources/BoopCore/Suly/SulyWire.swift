import Foundation

/// One point of the smoothed weight trend (`WeightTrendPoint`).
public struct SulyTrendPoint: Codable, Equatable, Sendable {
    public let date: String
    public let trendKg: Double
    public init(date: String, trendKg: Double) { self.date = date; self.trendKg = trendKg }
}

/// The server's EWMA weight trend (`GET /api/biometrics/weight/trend`), decoded leniently: a rate the server could not
/// compute is nil, a missing sufficiency reads as `none`.
public struct SulyTrend: Codable, Equatable, Sendable {
    public let ewmaSeries: [SulyTrendPoint]
    public let latestTrendKg: Double?
    public let weeklyRateKgPerWeek: Double?
    public let weeklyRatePctPerWeek: Double?
    public let last4wRateKgPerWeek: Double?
    /// `none` · `provisional` · `full`.
    public let dataSufficiency: String

    public init(ewmaSeries: [SulyTrendPoint], latestTrendKg: Double?, weeklyRateKgPerWeek: Double?,
                weeklyRatePctPerWeek: Double?, last4wRateKgPerWeek: Double?, dataSufficiency: String) {
        self.ewmaSeries = ewmaSeries; self.latestTrendKg = latestTrendKg; self.weeklyRateKgPerWeek = weeklyRateKgPerWeek
        self.weeklyRatePctPerWeek = weeklyRatePctPerWeek; self.last4wRateKgPerWeek = last4wRateKgPerWeek
        self.dataSufficiency = dataSufficiency
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        ewmaSeries = try c.decodeIfPresent([SulyTrendPoint].self, forKey: .ewmaSeries) ?? []
        latestTrendKg = try c.decodeIfPresent(Double.self, forKey: .latestTrendKg)
        weeklyRateKgPerWeek = try c.decodeIfPresent(Double.self, forKey: .weeklyRateKgPerWeek)
        weeklyRatePctPerWeek = try c.decodeIfPresent(Double.self, forKey: .weeklyRatePctPerWeek)
        last4wRateKgPerWeek = try c.decodeIfPresent(Double.self, forKey: .last4wRateKgPerWeek)
        dataSufficiency = try c.decodeIfPresent(String.self, forKey: .dataSufficiency) ?? "none"
    }
}

/// One weigh-in (`WeightLogResponse`): the wire calls the kilograms `value`.
public struct SulyLog: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let date: String
    public let kg: Double
    public let note: String?

    public init(id: String, date: String, kg: Double, note: String? = nil) {
        self.id = id; self.date = date; self.kg = kg; self.note = note
    }

    enum CodingKeys: String, CodingKey { case id, date, kg = "value", note }
}
