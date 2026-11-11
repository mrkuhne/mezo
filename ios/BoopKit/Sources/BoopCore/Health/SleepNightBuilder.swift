import Foundation
import BoopAPI

/// One night ready to send, with the asleep intervals of the winning session (for the sleeping heart
/// rate, which needs a Health statistics query and so is filled in by `HealthSync`).
public struct NightDraft: Sendable {
    public var night: Components.Schemas.SleepNightIn
    public let asleep: [DateInterval]
}

/// Apple Health sleep samples → one night per wake day (Boop S2 mezo-r36n9.2, B1 mezo-r36n9.11).
///
/// - Samples of each source are split into sessions where asleep samples are > 90 min apart.
/// - A session that ends between 14:00 and 18:00 local is a nap and is dropped.
/// - Several sessions on the same wake day (several apps writing the same night): the best source wins —
///   Apple Watch (Apple's own bundle on a Watch) → ring apps (Oura, Ultrahuman, RingConn) → Sleep Cycle →
///   any other app; between equals the one with the most staged minutes (deep + REM + core), then the longest.
/// - `externalId` is per night (`hk-night-<wake day>`) so a re-sync or a source change never
///   duplicates a night on the server; `sourceApp` names the winning source.
public func buildNightDrafts(_ samples: [SleepSample], calendar: Calendar) -> [NightDraft] {
    let bySource = Dictionary(grouping: samples, by: \.source)
    var best: [String: SleepSession] = [:]
    for (_, list) in bySource {
        for session in sessions(of: list) {
            let hour = calendar.component(.hour, from: session.wake)
            if (14..<18).contains(hour) { continue }
            let day = dayString(session.wake, calendar)
            if let current = best[day], !session.beats(current) { continue }
            best[day] = session
        }
    }
    return best.keys.sorted().map { day in
        let s = best[day]!
        return NightDraft(night: s.night(day: day, calendar: calendar), asleep: s.asleepIntervals)
    }
}

/// The nights without the sleeping heart rate (see `buildNightDrafts`).
public func buildNights(_ samples: [SleepSample], calendar: Calendar) -> [Components.Schemas.SleepNightIn] {
    buildNightDrafts(samples, calendar: calendar).map(\.night)
}

/// Source priority of one sample (lower wins): 0 Apple Watch, 1 ring app, 2 Sleep Cycle, 3 anything else.
func sourceRank(_ s: SleepSample) -> Int {
    let bundle = s.bundle.lowercased(), name = s.source.lowercased(), device = (s.device ?? "").lowercased()
    if bundle.hasPrefix("com.apple.health") && device.contains("watch") { return 0 }
    if ["oura", "ultrahuman", "ringconn"].contains(where: { bundle.contains($0) || name.contains($0) }) { return 1 }
    if bundle.contains("sleepcycle") || name.contains("sleep cycle") || name.contains("sleepcycle") { return 2 }
    return 3
}

private let asleepStages: Set<SleepSample.Stage> = [.core, .deep, .rem, .asleepUnspecified]

private struct SleepSession {
    let samples: [SleepSample]          // every sample of the source inside [bed, wake]
    let bed: Date
    let wake: Date

    func minutes(_ stages: Set<SleepSample.Stage>) -> Int {
        Int((samples.filter { stages.contains($0.stage) }
            .reduce(0.0) { $0 + clipped($1).duration } / 60).rounded())
    }
    var staged: Int { minutes([.deep, .rem, .core]) }
    var asleep: Int { minutes(asleepStages) }
    /// The best (lowest) source rank among the session's samples.
    var rank: Int { samples.map(sourceRank).min() ?? 3 }
    func beats(_ other: SleepSession) -> Bool {
        if rank != other.rank { return rank < other.rank }
        return staged != other.staged ? staged > other.staged : asleep > other.asleep
    }

    /// The asleep stretches inside [bed, wake], overlaps merged (the sleeping-HR query covers these).
    var asleepIntervals: [DateInterval] {
        let parts = samples.filter { asleepStages.contains($0.stage) }.map(clipped)
            .filter { $0.duration > 0 }.sorted { $0.start < $1.start }
        var out: [DateInterval] = []
        for p in parts {
            if let last = out.last, p.start <= last.end {
                out[out.count - 1] = DateInterval(start: last.start, end: max(last.end, p.end))
            } else {
                out.append(p)
            }
        }
        return out
    }

    private func clipped(_ s: SleepSample) -> DateInterval {
        let a = max(s.start, bed), b = min(s.end, wake)
        return DateInterval(start: a, end: max(a, b))
    }

    func night(day: String, calendar: Calendar) -> Components.Schemas.SleepNightIn {
        let inBed = samples.filter { $0.stage == .inBed }
        let inBedMin: Int? = inBed.isEmpty ? nil : Int((min(inBed.map(\.start).min()!, bed)
            .distance(to: max(inBed.map(\.end).max()!, wake)) / 60).rounded())
        return .init(
            externalId: "hk-night-\(day)", date: day,
            bedtime: hhmm(bed, calendar), wakeup: hhmm(wake, calendar),
            durationH: (Double(asleep) / 60 * 100).rounded() / 100,
            inBedMin: inBedMin, awakeMin: minutes([.awake]),
            lightMin: minutes([.core, .asleepUnspecified]), remMin: minutes([.rem]), deepMin: minutes([.deep]),
            hypnogram: hypnogram(), sourceApp: samples.first.map { String($0.source.prefix(80)) })
    }

    /// One letter per bucket from bedtime: the stage covering most of the bucket (D deep, R REM,
    /// L core/unspecified, A awake or nothing recorded). At most 200 letters (contract limit).
    private func hypnogram() -> Components.Schemas.Hypnogram? {
        let total = bed.distance(to: wake) / 60
        guard total >= 5 else { return nil }
        var bucket = 5
        while total / Double(bucket) > 200 { bucket += 5 }
        let count = Int((total / Double(bucket)).rounded(.up))
        var letters = ""
        for i in 0..<count {
            let a = bed.addingTimeInterval(Double(i * bucket) * 60)
            let b = min(wake, a.addingTimeInterval(Double(bucket) * 60))
            var cover: [Character: Double] = [:]
            for s in samples {
                let overlap = min(s.end, b).timeIntervalSince(max(s.start, a))
                guard overlap > 0, let ch = letter(s.stage) else { continue }
                cover[ch, default: 0] += overlap
            }
            letters.append(cover.max { $0.value < $1.value }?.key ?? "A")
        }
        return .init(bucketMin: bucket, stages: letters)
    }

    private func letter(_ s: SleepSample.Stage) -> Character? {
        switch s { case .deep: "D"; case .rem: "R"; case .core, .asleepUnspecified: "L"; case .awake: "A"; case .inBed: nil }
    }
}

private func sessions(of list: [SleepSample]) -> [SleepSession] {
    let asleep = list.filter { asleepStages.contains($0.stage) }.sorted { $0.start < $1.start }
    var groups: [[SleepSample]] = []
    for s in asleep {
        if let last = groups.last?.map(\.end).max(), s.start.timeIntervalSince(last) <= 90 * 60 {
            groups[groups.count - 1].append(s)
        } else {
            groups.append([s])
        }
    }
    return groups.map { g in
        let bed = g.map(\.start).min()!, wake = g.map(\.end).max()!
        let inside = list.filter { $0.end > bed && $0.start < wake }
        return SleepSession(samples: inside, bed: bed, wake: wake)
    }
}

func dayString(_ d: Date, _ calendar: Calendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
}

private func hhmm(_ d: Date, _ calendar: Calendar) -> String {
    let c = calendar.dateComponents([.hour, .minute], from: d)
    return String(format: "%02d:%02d", c.hour!, c.minute!)
}
