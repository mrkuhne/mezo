import Foundation

/// The biomarker snapshot frozen at a check-in (spec §7.3), computed on the phone from HealthKit. Every field is
/// nullable with its sample time; maps onto the contract's `CheckInSnapshot` (steps are cumulative to capture, so
/// `stepsIsDayTotal` is always false, and `computedBy` is `phone`).
public struct CheckInSnapshotValue: Codable, Equatable, Sendable {
    public var hrBpm: Int?
    public var hrAt: Date?
    public var hrvMs: Double?
    public var hrvAt: Date?
    /// The 14-day median HRV, "szokott".
    public var hrvUsualMs: Double?
    public var steps: Int?
    public var sleepMinutes: Int?
    /// Bundle id of the app that wrote the heart-rate (else HRV) reading.
    public var source: String?

    public init(hrBpm: Int? = nil, hrAt: Date? = nil, hrvMs: Double? = nil, hrvAt: Date? = nil, hrvUsualMs: Double? = nil,
                steps: Int? = nil, sleepMinutes: Int? = nil, source: String? = nil) {
        self.hrBpm = hrBpm; self.hrAt = hrAt; self.hrvMs = hrvMs; self.hrvAt = hrvAt; self.hrvUsualMs = hrvUsualMs
        self.steps = steps; self.sleepMinutes = sleepMinutes; self.source = source
    }

    /// True when Health gave nothing at all (the check-in then goes without a snapshot and the server fills one in).
    public var isEmpty: Bool { self == CheckInSnapshotValue() }
}

/// Reads the snapshot at the moment of saving (spec §7.3): heart rate = the mean of the last 15 minutes, else the
/// latest sample within 60 minutes; HRV = the latest within 8 h plus the 14-day median; steps = today up to now;
/// sleep = the night that ended today. A read that fails or finds nothing leaves its fields nil.
public struct SnapshotBuilder: Sendable {
    private let reader: HealthReader

    public init(reader: HealthReader) { self.reader = reader }

    public func snapshot(at now: Date, calendar: Calendar = .current) async -> CheckInSnapshotValue {
        var snap = CheckInSnapshotValue()
        var bundle: String?

        let heart = (try? await reader.readSamples(.heartRate, from: now.addingTimeInterval(-3600), to: now)) ?? []
        let recent = heart.filter { $0.start >= now.addingTimeInterval(-15 * 60) }
        if !recent.isEmpty {
            snap.hrBpm = Int((recent.map(\.value).reduce(0, +) / Double(recent.count)).rounded())
            snap.hrAt = recent.last?.start
            bundle = recent.last?.sourceBundle
        } else if let latest = heart.last {
            snap.hrBpm = Int(latest.value.rounded())
            snap.hrAt = latest.start
            bundle = latest.sourceBundle
        }

        let hrv = (try? await reader.readSamples(.hrvSdnn, from: now.addingTimeInterval(-14 * 86400), to: now)) ?? []
        if let latest = hrv.last, latest.start >= now.addingTimeInterval(-8 * 3600) {
            snap.hrvMs = latest.value
            snap.hrvAt = latest.start
            if bundle == nil { bundle = latest.sourceBundle }
        }
        snap.hrvUsualMs = Self.median(hrv.map(\.value))
        snap.source = bundle.flatMap { $0.isEmpty ? nil : $0 }

        let today = dayString(now, calendar)
        let start = calendar.startOfDay(for: now)
        if let totals = try? await reader.dayTotals(from: start, to: now, calendar: calendar) {
            snap.steps = totals.first { $0.date == today }?.steps
        }

        // The night that ended today: samples from the previous midday on, then the usual night builder.
        let from = start.addingTimeInterval(-12 * 3600)
        if let sleep = try? await reader.sleepSamples(from: from, to: now),
           let night = buildNights(sleep, calendar: calendar).first(where: { $0.date == today }) {
            snap.sleepMinutes = Int((night.durationH * 60).rounded())
        }
        return snap
    }

    static func median(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }
}
