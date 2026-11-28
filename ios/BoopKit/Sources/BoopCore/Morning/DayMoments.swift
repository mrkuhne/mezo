import Foundation

// The day's big moments, as pins for the day curve (the Élet spike's `EDayEvent`, shipped 2026-11-16 with the
// day page, `mezo-r36n9.56`). Pure: it only re-reads what the brief already carries — waking, the meals, the
// busiest stretch of the calendar, today's session and the bedtime target. Nothing here is invented, and nothing
// is computed that the timeline does not compute the same way.

/// One moment of the day on the curve.
public struct DayMoment: Sendable, Equatable, Identifiable {
    public let id: String
    /// Fractional hour of the day (12:40 → 12.666…).
    public let hour: Double
    public let glyph: String
    /// Two or three words under the pin.
    public let label: String
    /// What a tap on the pin says.
    public let detail: String
    public init(id: String, hour: Double, glyph: String, label: String, detail: String = "") {
        self.id = id; self.hour = hour; self.glyph = glyph; self.label = label; self.detail = detail
    }
}

/// The curve spans 06:00–24:00; a moment outside it has nowhere to sit.
public let dayCurveHours = (from: 6.0, to: 24.0)

/// "12:40" → 12.666…; nil when it is not a clock time.
public func dayMomentHour(_ hhmm: String) -> Double? {
    let p = hhmm.split(separator: ":")
    guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), (0...23).contains(h), (0...59).contains(m) else { return nil }
    return Double(h) + Double(m) / 60
}

/// A pin carries one short word under it — a whole meal name ("Zabkása gyümölccsel") would run into its
/// neighbour. The rest of the name is in the detail, one tap away.
func pinLabel(_ title: String, max: Int = 10) -> String {
    let first = title.split(separator: " ").first.map(String.init) ?? title
    let word = first.lowercased()
    return word.count <= max ? word : String(word.prefix(max - 1)) + "…"
}

/// "7ó 12p" from minutes, the way the rest of the app says a length of sleep.
func dayMomentDuration(_ minutes: Int) -> String {
    minutes >= 60 ? "\(minutes / 60)ó \(minutes % 60)p" : "\(minutes)p"
}

/// The longest unbroken busy stretch of the calendar as one moment, at its middle. `busySlots` is the brief's own
/// 72 quarter hours from 06:00. A stretch under an hour is not worth a pin.
func calendarMoment(_ cal: Brief.CalendarDay) -> DayMoment? {
    var best: (start: Int, len: Int)? = nil
    var i = 0
    while i < cal.busySlots.count {
        guard cal.busySlots[i] else { i += 1; continue }
        var j = i
        while j < cal.busySlots.count, cal.busySlots[j] { j += 1 }
        if best == nil || j - i > best!.len { best = (i, j - i) }
        i = j
    }
    guard let b = best, b.len >= 4 else { return nil }
    let from = dayCurveHours.from + Double(b.start) * 0.25
    let to = from + Double(b.len) * 0.25
    func clock(_ h: Double) -> String { String(format: "%02d:%02d", Int(h) % 24, Int((h - Double(Int(h))) * 60)) }
    return DayMoment(id: "calendar", hour: (from + to) / 2, glyph: "clock-ink", label: "naptár",
                     detail: "\(clock(from))–\(clock(to)) · \(cal.count) esemény a mai napodban")
}

/// Every moment of the day that belongs on the curve, in clock order, at most `cap` of them. Ties keep the order
/// below (waking, meals, calendar, session, sport, bedtime), so the same day always draws the same pins.
public func dayMoments(_ brief: Brief, cap: Int = 6) -> [DayMoment] {
    var out: [DayMoment] = []
    let d = brief.day

    if let wake = d.sleep?.wakeup, let h = dayMomentHour(wake) {
        let slept = d.sleep.map { dayMomentDuration($0.totalMin) } ?? ""
        out.append(DayMoment(id: "wake", hour: h, glyph: "sun-ink", label: "ébredés",
                             detail: slept.isEmpty ? "Ekkor keltél." : "\(wake) · \(slept) alvás"))
    }
    for (i, m) in d.meals.enumerated() {
        guard let h = dayMomentHour(m.time) else { continue }
        out.append(DayMoment(id: "meal-\(i)", hour: h, glyph: "bowl-cream", label: pinLabel(m.title),
                             detail: "\(m.time) · \(m.title) · \(m.proteinG) g fehérje"))
    }
    if let c = calendarMoment(d.calendar) { out.append(c) }
    if let s = d.session, let t = (s.time ?? s.plannedTime), let h = dayMomentHour(t) {
        let len = s.minutes.map { " · \($0) perc" } ?? ""
        out.append(DayMoment(id: "session", hour: h, glyph: "dumbbell-ink", label: "edzés",
                             detail: "\(t) · \(s.title)\(len)"))
    }
    // S6 (`mezo-r36n9.206`): each sport is its own pin next to the gym's — never folded into „edzés"
    for (i, sp) in d.sport.enumerated() {
        guard let h = dayMomentHour(sp.time) else { continue }
        let kind = SportKind(wire: sp.sport)
        let len = sp.minutes.map { " · \($0) perc" } ?? ""
        out.append(DayMoment(id: "sport-\(i)", hour: h, glyph: "ball-sun", label: kind.inSentence,
                             detail: "\(sp.time) · \(kind.name)\(len)" + (sp.done ? " · megvolt" : "")))
    }
    if let b = d.bedtimeTarget, let h = dayMomentHour(b) {
        out.append(DayMoment(id: "bedtime", hour: h, glyph: "moon-cream", label: "alvás",
                             detail: "\(b)-kor ágyban — ennyi alvás hozza a holnapi formádat."))
    }

    return Array(out.filter { $0.hour >= dayCurveHours.from && $0.hour <= dayCurveHours.to }
        .enumerated()
        .sorted { ($0.element.hour, $0.offset) < ($1.element.hour, $1.offset) }
        .map(\.element)
        .prefix(cap))
}
