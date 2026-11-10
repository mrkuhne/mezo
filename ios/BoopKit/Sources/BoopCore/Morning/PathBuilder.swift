import Foundation

/// One station on a day path. Mirrors BoopDesign's `PathStation` field for field (BoopCore cannot import it;
/// the app maps one to the other). `glyph` is a kit glyph name.
public struct PathStep: Sendable, Equatable, Identifiable {
    public let id: String, time: String, glyph: String, title: String, sub: String
    public let done: Bool, isNow: Bool, opens: Bool
    public init(id: String, time: String, glyph: String, title: String, sub: String, done: Bool, isNow: Bool, opens: Bool = false) {
        self.id = id; self.time = time; self.glyph = glyph; self.title = title; self.sub = sub
        self.done = done; self.isNow = isNow; self.opens = opens
    }
}

/// Builds the per-orb short paths and the A napom full-day path from the brief (spec §5.1a, §5.1b, §10).
/// Pure: `now` and the calendar are injected. Times are "HH:mm" local.
public enum PathBuilder {
    private struct Item { let key: Int; let step: PathStep }

    /// `key == nil` = the full day (A napom, spec §5.2): every station at its own clock time in strict time order
    /// (nothing waits at MOST, no "most" labels), the calendar as one "Megbeszélések · n esemény" station.
    public static func steps(for key: MetricKey?, brief: Brief, now: Date, evening: Bool,
                             calendar: Calendar = .current) -> [PathStep] {
        let c = calendar.dateComponents([.hour, .minute], from: now)
        let nowMin = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        let ctx = Ctx(day: brief.day, energy: brief.energy, nowMin: nowMin, evening: evening, fullDay: key == nil)
        let wanted = key.map { [$0] } ?? MetricKey.allCases
        var items: [Item] = []
        for k in wanted {
            switch k {
            case .forma: items += forma(ctx)
            case .alvas: items += alvas(ctx)
            case .mozgas: items += mozgas(ctx)
            case .fuel: items += fuel(ctx)
            case .pulzus: items += pulzus(ctx)
            }
        }
        let sorted = items.enumerated().sorted { ($0.element.key, $0.offset) < ($1.element.key, $1.offset) }.map(\.element)
        let nowStep = PathStep(id: "now", time: fmt(nowMin), glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true)
        var out = sorted.map(\.step)
        out.insert(nowStep, at: sorted.firstIndex { $0.key >= nowMin } ?? sorted.count)
        return uniqueIds(out)
    }

    // MARK: orbs

    private static func forma(_ x: Ctx) -> [Item] {
        var out: [Item] = []
        let morning = x.day.checkins.first { $0.slot == .morning }
        let anchor = morning.flatMap { mins($0.time) } ?? 8 * 60
        // undone morning stack waits right after MOST (per-orb only; the full day keeps clock order)
        func held(_ t: Int, done: Bool) -> Int { done || x.fullDay ? t : max(t, x.nowMin) }
        // A past, undone station has no honest clock time any more: it reads "most" (it is due now).
        func label(_ t: Int, done: Bool) -> String { !done && !x.fullDay && t < x.nowMin ? "most" : fmt(t) }
        if !x.evening {
            if let m = morning {
                out.append(Item(key: held(anchor, done: m.done), step: PathStep(
                    id: "checkin-morning", time: label(anchor, done: m.done), glyph: "sun-ink", title: "Reggeli check-in",
                    sub: m.summary ?? "", done: m.done, isNow: false, opens: !m.done)))
            }
            let creed = x.day.intention.creed
            out.append(Item(key: held(anchor, done: creed != nil), step: PathStep(
                id: "intention", time: label(anchor, done: creed != nil), glyph: "pen-sun", title: "Mai szándék",
                sub: creed ?? "", done: creed != nil, isNow: false, opens: true)))
            if !x.day.observations.isEmpty {
                out.append(Item(key: held(anchor, done: false), step: PathStep(
                    id: "observations", time: label(anchor, done: false), glyph: "spark-cream", title: "Boop észrevette",
                    sub: "\(x.day.observations.count) új", done: false, isNow: false, opens: true)))
            }
        }
        for ch in x.day.checkins where ch.slot != .morning {
            guard let t = mins(ch.time) else { continue }
            let title: String
            switch ch.slot {
            case .midday: title = "Déli check-in"
            case .afternoon: title = "Délutáni check-in"
            default: title = "Esti check-in · napzárás"
            }
            // past and undone: due now, so it waits at MOST after the morning stack (ties keep slot order)
            out.append(Item(key: held(t, done: ch.done), step: PathStep(
                id: "checkin-\(ch.slot.rawValue)", time: label(t, done: ch.done), glyph: ch.slot == .evening ? "moon-cream" : "clock-ink",
                title: title, sub: ch.summary ?? "", done: ch.done, isNow: false, opens: !ch.done && t <= x.nowMin)))
        }
        return out
    }

    private static func alvas(_ x: Ctx) -> [Item] {
        var out: [Item] = []
        let recovery = x.day.recovery != nil
        if !x.evening, let s = x.day.sleep, let bed = mins(s.bedtime), let wake = mins(s.wakeup) {
            let bedKey = bed > wake ? bed - 1440 : bed
            out.append(Item(key: bedKey, step: PathStep(id: "sleep-in", time: s.bedtime, glyph: "moon-cream",
                                                        title: "Elalvás", sub: "", done: true, isNow: false)))
            out.append(Item(key: (bedKey + wake) / 2, step: PathStep(
                id: "sleep-night", time: fmt((bedKey + wake) / 2), glyph: "moon-cream", title: "Az éjszaka",
                sub: "\(s.totalMin / 60) ó \(s.totalMin % 60) p", done: true, isNow: false, opens: true)))
            out.append(Item(key: wake, step: PathStep(id: "wake", time: s.wakeup, glyph: "sun-ink",
                                                       title: "Ébredés", sub: "", done: true, isNow: false)))
        }
        let target = x.day.bedtimeTarget.flatMap(mins) ?? (recovery ? 22 * 60 : nil)
        if let rawT = target {
            let t = ordered(rawT)   // after-midnight targets belong to the end of this day
            if x.evening {
                out.append(Item(key: t - 30, step: PathStep(id: "wind-down", time: fmt(t - 30), glyph: "book-sage",
                                                             title: "Esti levezetés", sub: "", done: false, isNow: false, opens: true)))
            }
            out.append(Item(key: t, step: PathStep(
                id: "bedtime", time: fmt(t), glyph: "moon-cream", title: recovery ? "Korai lefekvés" : "Lefekvés",
                sub: recovery ? "Ma pihenj többet" : "", done: false, isNow: false, opens: !x.evening)))
        }
        return out
    }

    private static func mozgas(_ x: Ctx) -> [Item] {
        var out: [Item] = []
        let dip = x.energy.dipHour
        if x.day.recovery != nil {
            let h = dip ?? 17
            out.append(Item(key: h * 60, step: PathStep(id: "easy-walk", time: fmt(h * 60), glyph: "shoe-cream",
                                                         title: "Könnyű séta", sub: "Csak ha jólesik", done: false, isNow: false, opens: true)))
            return out
        }
        if let h = dip {
            out.append(Item(key: h * 60, step: PathStep(id: "dip-walk", time: fmt(h * 60), glyph: "shoe-cream",
                                                         title: "Mélyponti séta", sub: "Ilyenkor szokott leülni az energiád",
                                                         done: false, isNow: false, opens: true)))
        }
        if let s = x.day.session {
            let t = (s.time ?? s.plannedTime).flatMap(mins)
            var parts: [String] = []
            if let m = s.minutes { parts.append("\(m) perc") }
            if !s.exercises.isEmpty { parts.append("\(s.exercises.count) gyakorlat") }
            out.append(Item(key: t ?? 18 * 60, step: PathStep(
                id: "session", time: t.map(fmt) ?? "–", glyph: "dumbbell-ink", title: s.title,
                sub: parts.joined(separator: " · "), done: false, isNow: false, opens: true)))
        }
        return out
    }

    private static func fuel(_ x: Ctx) -> [Item] {
        var out: [Item] = []
        let firstOpen = x.day.meals.firstIndex { !$0.logged }
        for (i, m) in x.day.meals.enumerated() {
            guard let t = mins(m.time) else { continue }
            if x.evening && t < 16 * 60 && m.logged { continue }
            out.append(Item(key: t, step: PathStep(
                id: "meal-\(i)", time: m.time, glyph: "bowl-cream", title: m.title,
                sub: "\(m.kcal) kcal · \(m.proteinG) g fehérje", done: m.logged, isNow: false,
                opens: m.logged || i == firstOpen)))
        }
        if x.day.recovery != nil {
            let t = x.nowMin + 30
            out.append(Item(key: t, step: PathStep(id: "water", time: fmt(t), glyph: "drop-sky",
                                                    title: "Igyál egy pohár vizet", sub: "", done: false, isNow: false)))
        }
        return out
    }

    private static func pulzus(_ x: Ctx) -> [Item] {
        if x.fullDay { return meetings(x) }
        if x.evening {
            let t = x.nowMin + 15
            return [Item(key: t, step: PathStep(id: "breath", time: fmt(t), glyph: "heart-cream",
                                                title: "Esti légzés", sub: "Egy perc lefekvés előtt", done: false, isNow: false, opens: true))]
        }
        // the densest block that has not started yet; with none left, the densest of the day (shown without breath)
        let firstUpcoming = max(0, (x.nowMin - 360 + 14) / 15)
        let all = busyRuns(x.day.calendar.busySlots).filter { $0.count >= 2 }
        let upcoming = all.filter { $0.lowerBound >= firstUpcoming }
        guard let run = longest(upcoming) ?? longest(all) else { return [] }
        let start = 360 + 15 * run.lowerBound, end = 360 + 15 * (run.upperBound + 1)
        var out: [Item] = []
        if start - 5 >= x.nowMin {
            out.append(Item(key: start - 5, step: PathStep(id: "breath", time: fmt(start - 5), glyph: "heart-cream",
                                                           title: "Egy perc légzés", sub: "Mielőtt belefutsz", done: false, isNow: false, opens: true)))
        }
        out.append(Item(key: start, step: PathStep(id: "busy-block", time: fmt(start), glyph: "clock-ink",
                                                    title: "Sűrű megbeszélés-sáv", sub: "\(fmt(start))–\(fmtEnd(end))",
                                                    done: end <= x.nowMin, isNow: false, opens: true)))
        return out
    }

    /// The full day's calendar as one station at the first meeting's start, spanning to the last meeting's end.
    private static func meetings(_ x: Ctx) -> [Item] {
        let runs = busyRuns(x.day.calendar.busySlots)
        guard let first = runs.first, let last = runs.last else { return [] }
        let start = 360 + 15 * first.lowerBound, end = 360 + 15 * (last.upperBound + 1)
        let n = x.day.calendar.count > 0 ? x.day.calendar.count : runs.count
        return [Item(key: start, step: PathStep(id: "calendar", time: fmt(start), glyph: "clock-ink",
                                                title: "Megbeszélések · \(n) esemény", sub: "\(fmt(start))–\(fmtEnd(end))",
                                                done: end <= x.nowMin, isNow: false))]
    }

    // MARK: helpers

    private struct Ctx { let day: Brief.Day; let energy: Brief.Energy; let nowMin: Int; let evening: Bool; let fullDay: Bool }

    /// Every consecutive busy run, in order, as slot indices.
    private static func busyRuns(_ slots: [Bool]) -> [ClosedRange<Int>] {
        var out: [ClosedRange<Int>] = [], start: Int?
        for i in 0...slots.count {
            if i < slots.count, slots[i] { start = start ?? i; continue }
            if let s = start { out.append(s...(i - 1)); start = nil }
        }
        return out
    }

    /// The longest run (first one on ties).
    private static func longest(_ runs: [ClosedRange<Int>]) -> ClosedRange<Int>? {
        runs.reduce(nil) { best, r in best == nil || r.count > best!.count ? r : best }
    }

    /// Times before 06:00 belong to the night that ends the day (the day grid starts at 06:00).
    private static func ordered(_ t: Int) -> Int { t < 360 ? t + 1440 : t }

    private static func uniqueIds(_ steps: [PathStep]) -> [PathStep] {
        var seen: [String: Int] = [:]
        return steps.map { st in
            let n = (seen[st.id] ?? 0) + 1; seen[st.id] = n
            guard n > 1 else { return st }
            return PathStep(id: "\(st.id)-\(n)", time: st.time, glyph: st.glyph, title: st.title, sub: st.sub,
                            done: st.done, isNow: st.isNow, opens: st.opens)
        }
    }

    /// End of a range: midnight reads "24:00", not "00:00".
    private static func fmtEnd(_ m: Int) -> String { m == 1440 ? "24:00" : fmt(m) }

    private static func mins(_ hhmm: String) -> Int? {
        let p = hhmm.split(separator: ":")
        guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
        return h * 60 + m
    }
    private static func fmt(_ minutes: Int) -> String {
        let m = ((minutes % 1440) + 1440) % 1440
        return String(format: "%02d:%02d", m / 60, m % 60)
    }
}
