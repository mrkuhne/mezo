import Foundation

// The Hét tab's words and pictures as pure functions (`mezo-r36n9.204`, spec §5.3): the week's head, the two lanes,
// the six-week load bars, the weekly rhythm's rows, the full-replace payload and the slot editor's „Ez változik".

public let sportDayNames = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]
public let sportDayOn = ["Hétfőn", "Kedden", "Szerdán", "Csütörtökön", "Pénteken", "Szombaton", "Vasárnap"]
public let sportDayTiles = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]
private let laneDayShort = ["Hé", "Ke", "Sze", "Csü", "Pé", "Szo", "Va"]
private let monthShort = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"]
private let cardinal = ["nulla", "egy", "két", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc", "tíz"]

private func upperFirst(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }
private func count(_ n: Int) -> String { n < cardinal.count ? cardinal[n] : "\(n)" }
private func minutesOf(_ time: String?) -> Int? { sportHour(time).map { Int(($0 * 60).rounded()) } }

// MARK: - The full-replace payload

/// The whole rhythm to send after `edited` was saved: the slot with the same id is replaced, a new one (no id) is
/// added, every other slot goes back exactly as the server has it. Day then time ascending.
public func sportScheduleSaving(_ slots: [SportSlot], _ edited: SportSlot) -> [SportSlotInput] {
    var all = slots
    if let id = edited.id, let i = all.firstIndex(where: { $0.id == id }) { all[i] = edited } else { all.append(edited) }
    return sportScheduleSorted(all).map(\.input)
}

/// The whole rhythm without the slot `id`.
public func sportScheduleRemoving(_ slots: [SportSlot], id: String?) -> [SportSlotInput] {
    sportScheduleSorted(slots.filter { $0.id != id }).map(\.input)
}

public func sportScheduleSorted(_ slots: [SportSlot]) -> [SportSlot] {
    slots.sorted { ($0.dayOfWeek, minutesOf($0.time) ?? 0) < ($1.dayOfWeek, minutesOf($1.time) ?? 0) }
}

// MARK: - Rows

/// „Hétfő 18:00 · Röplabda".
public func sportSlotTitle(_ s: SportSlot) -> String {
    "\(sportDayNames[min(6, max(0, s.dayOfWeek))]) \(s.time) · \(s.sportKind.name)"
}

/// „2 óra · edzés · Sportcsarnok".
public func sportSlotLine(_ s: SportSlot) -> String {
    [sportLength(s.durationMin), s.isMatch ? "meccs" : "edzés", s.location ?? ""]
        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.joined(separator: " · ")
}

/// A new slot's starting values (spike: Thursday 19:00, 90 minutes, volleyball training).
public func sportNewSlot() -> SportSlot { SportSlot(dayOfWeek: 3, time: "19:00", durationMin: 90, kind: "training", location: nil) }

/// The start moved by `minutes`, kept between 05:00 and 22:00.
public func sportShiftTime(_ time: String, by minutes: Int) -> String {
    let t = max(5 * 60, min(22 * 60, (minutesOf(time) ?? 18 * 60) + minutes))
    return String(format: "%02d:%02d", t / 60, t % 60)
}

// MARK: - „Ez változik"

public struct SportSlotEffect: Equatable, Sendable {
    /// What happens from now on, and how it sits beside that day's gym.
    public let text: String
    /// Another slot on the same day.
    public let clash: String?
    /// The rest between the gym and this slot in minutes (0 = they overlap); nil when there is no gym time that day.
    public let gapMinutes: Int?
}

/// The slot editor's box: from now on every such day, the gap to that weekday's gym in `week` (the server's rule —
/// the shortest rest between the end of one block and the start of the other), and a clash with another slot.
public func sportSlotEffect(_ slot: SportSlot, others: [SportSlot], week: SportOverview?) -> SportSlotEffect {
    let day = min(6, max(0, slot.dayOfWeek))
    var text = "Mostantól minden \(sportDayNames[day].lowercased()) \(slot.time)-kor \(slot.sportKind.name.lowercased()), \(sportLength(slot.durationMin))."
    var gap: Int?
    if let week, let wd = week.days.first(where: { sportLegacyWeekday($0.date) == day }) {
        let gyms = wd.gym.filter { $0.state != "SKIPPED" }
        if gyms.isEmpty {
            text += " Ezen a napon nincs kondi, így ez a hét szabad napja marad mozgással."
        } else if let start = minutesOf(slot.time) {
            let end = start + slot.durationMin
            var best: (gap: Int, gymStart: Int)?
            for g in gyms {
                guard let gs = minutesOf(g.time), let gd = g.durationMin else { continue }
                let ge = gs + gd
                let m = ge <= start ? start - ge : end <= gs ? gs - end : 0
                if best == nil || m < best!.gap { best = (m, gs) }
            }
            if let best {
                gap = best.gap
                let part = sportDaypart(String(format: "%02d:%02d", best.gymStart / 60, best.gymStart % 60)) ?? "ma"
                if best.gap == 0 {
                    text += " Aznap \(part) kondi is van, és a kettő egymásra esik."
                } else {
                    text += " Aznap \(part) kondi is van: \(sportLength(best.gap)) lesz köztük."
                    if best.gap < 180 { text += " Ez szoros: három óránál kevesebb pihenő." }
                }
            } else {
                let part = gyms.compactMap { sportDaypart($0.time) }.first
                text += " Aznap\(part.map { " \($0)" } ?? "") kondi is van."
            }
        }
    }
    let clash = others.contains { $0.id != slot.id && $0.dayOfWeek == day }
        ? "\(sportDayOn[day]) már van egy alkalmad — mindkettő megmarad." : nil
    return SportSlotEffect(text: text, clash: clash, gapMinutes: gap)
}

// MARK: - The head and the two lanes

/// The area page's headline and sentence on the Hét tab (spike: „Négy röpi, öt kondi" · „A hét két sávban: reggel
/// kondi, este röpi.").
public func sportWeekHead(_ o: SportOverview) -> SportHead {
    let sport = o.days.flatMap(\.sport).filter { $0.state != "SKIPPED" }
    let gym = o.days.flatMap(\.gym).filter { $0.state != "SKIPPED" }
    let kind = sportWeekKind(o)
    let word = kind.map { $0.inSentence } ?? "sport"
    let headline: String
    switch (sport.count, gym.count) {
    case (0, 0): headline = "Üres a heted"
    case (0, let g): headline = upperFirst("\(count(g)) kondi, sport nélkül")
    case (let s, 0): headline = upperFirst("\(count(s)) \(word), kondi nélkül")
    case (let s, let g): headline = upperFirst("\(count(s)) \(word), \(count(g)) kondi")
    }
    let sentence: String
    if sport.isEmpty && gym.isEmpty {
        sentence = "Ezen a héten még nincs se kondi, se sport."
    } else if sport.isEmpty {
        sentence = "Ezen a héten csak kondi van — a sportot lent, a heti rendben adod meg."
    } else if gym.isEmpty {
        sentence = "Ezen a héten csak \(word) van; a kondi napjait az Évadban állítod."
    } else {
        let gp = mostCommon(gym.compactMap { sportDaypart($0.time) })
        let sp = mostCommon(sport.compactMap { sportDaypart($0.time) })
        if let gp, let sp, gp != sp {
            sentence = "A hét két sávban: \(gp) kondi, \(sp) \(word)."
        } else {
            sentence = "A hét két sávban: kondi és \(word)."
        }
    }
    return SportHead(headline: headline, sentence: sentence)
}

private func mostCommon(_ xs: [String]) -> String? {
    Dictionary(grouping: xs, by: { $0 }).max { $0.value.count < $1.value.count }?.key
}

/// The hero's three totals (spike: heti mozgás · kondi · sport).
public func sportWeekFigures(_ o: SportOverview) -> [SportFigure] {
    [SportFigure(sportClock(o.totals.movementMinutes), "heti mozgás"),
     SportFigure(sportClock(o.totals.gymMinutes), "kondi"),
     SportFigure(sportClock(o.totals.sportMinutes), "sport", lit: true)]
}

/// One day of the two-lane chart: the gym on top, the sport under it.
public struct SportLaneDay: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let today: Bool
    /// 0…1 of the lane's height; 0 = nothing that day.
    public let gymShare: Double
    public let gymDone: Bool
    public let sportShare: Double
    public let sportDone: Bool
    public let label: String
}

/// The week as two lanes per day: filled = done, outlined = planned (the view's job); skipped items leave the lane.
/// Heights share one scale (the longest day, at least two hours); an item with no length shows at half height.
public func sportLanes(_ o: SportOverview) -> [SportLaneDay] {
    func minutes(_ items: [SportLaneItem]) -> Int? {
        let live = items.filter { $0.state != "SKIPPED" }
        guard !live.isEmpty else { return nil }
        return live.reduce(0) { $0 + ($1.durationMin ?? 0) }
    }
    let scale = Double(max(120, o.days.flatMap { [minutes($0.gym) ?? 0, minutes($0.sport) ?? 0] }.max() ?? 0))
    func share(_ m: Int?) -> Double {
        guard let m else { return 0 }
        return m == 0 ? 0.5 : min(1, Double(m) / scale)
    }
    return o.days.enumerated().map { i, d in
        let wd = sportLegacyWeekday(d.date) ?? i
        let gymLive = d.gym.filter { $0.state != "SKIPPED" }
        let sportLive = d.sport.filter { $0.state != "SKIPPED" }
        let gymDone = gymLive.contains { $0.done }
        let sportDone = sportLive.contains { $0.done }
        let sportWord = sportLive.first.map { $0.kind.inSentence } ?? "sport"
        let gymText = gymLive.isEmpty ? "nincs kondi" : gymDone ? "kondi megvolt" : "kondi tervben"
        let sportText = sportLive.isEmpty
            ? (d.sport.isEmpty ? "nincs sport" : "\(d.sport[0].kind.inSentence) kihagyva")
            : sportDone ? "\(sportWord) megvolt" : "\(sportWord) tervben"
        let today = d.date == o.today
        return SportLaneDay(id: d.date, name: laneDayShort[min(6, max(0, wd))], today: today,
                            gymShare: share(minutes(d.gym)), gymDone: gymDone,
                            sportShare: share(minutes(d.sport)), sportDone: sportDone,
                            label: "\(today ? "Ma, " : "")\(sportDayNames[min(6, max(0, wd))]): \(gymText), \(sportText)")
    }
}

// MARK: - Terhelés · 6 hét

public struct SportLoadBar: Equatable, Sendable, Identifiable {
    public var id: String { weekStart }
    public let weekStart: String
    public let label: String
    public let current: Bool
    public let sport: Int
    public let gym: Int
    /// 0…1 of the chart's height, on one scale (the biggest week).
    public let sportShare: Double
    public let gymShare: Double
}

/// The stacked bars: sport over gym, the last week labelled „ez".
public func sportLoadBars(_ load: SportLoad) -> [SportLoadBar] {
    let scale = Double(max(1, load.weeks.map { $0.sportLoad + $0.gymLoad }.max() ?? 1))
    return load.weeks.enumerated().map { i, w in
        let last = i == load.weeks.count - 1
        return SportLoadBar(weekStart: w.weekStart, label: last ? "ez" : sportMonthDay(w.weekStart), current: last,
                            sport: w.sportLoad, gym: w.gymLoad,
                            sportShare: Double(w.sportLoad) / scale, gymShare: Double(w.gymLoad) / scale)
    }
}

/// The chart's VoiceOver summary.
public func sportLoadSummary(_ load: SportLoad) -> String {
    guard let now = load.weeks.last else { return "Még nincs terhelési adat." }
    var s = "Heti terhelés \(count(load.weeks.count)) hétre. Ezen a héten eddig \(now.sportLoad + now.gymLoad): sport \(now.sportLoad), kondi \(now.gymLoad)."
    if let top = load.weeks.max(by: { $0.sportLoad + $0.gymLoad < $1.sportLoad + $1.gymLoad }), top != now,
       top.sportLoad + top.gymLoad > 0 {
        s += " A legnagyobb hét: \(sportMonthDay(top.weekStart)), \(top.sportLoad + top.gymLoad)."
    }
    return s
}

/// „3 alkalomnál nincs megterhelés, ezek kimaradnak." when the chart leaves sessions out; nil otherwise.
public func sportLoadUnknownNote(_ load: SportLoad) -> String? {
    let n = load.weeks.reduce(0) { $0 + $1.sportUnknown + $1.gymUnknown }
    return n == 0 ? nil : "\(n) alkalomnál nincs megadva a megterhelés, ezek kimaradnak a sávokból."
}

/// „nov 23".
public func sportMonthDay(_ ymd: String) -> String {
    let parts = ymd.split(separator: "-")
    guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]), (1...12).contains(m) else { return ymd }
    return "\(monthShort[m - 1]) \(d)"
}

// MARK: - One-off events

/// The date tile: „DEC" over „13".
public func sportEventTile(_ ymd: String) -> (month: String, day: String) {
    let parts = ymd.split(separator: "-")
    guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]), (1...12).contains(m) else { return ("", ymd) }
    return (monthShort[m - 1].uppercased(), "\(d)")
}

/// „Röplabda · meccs".
public func sportEventTitle(_ e: SportEvent) -> String { "\(e.sportKind.name) · \(e.isMatch ? "meccs" : "edzés")" }

/// „szombat 09:00 · 6 óra · Budaörs".
public func sportEventLine(_ e: SportEvent) -> String {
    let wd = sportLegacyWeekday(e.date).map { sportDayNames[$0].lowercased() }
    let first = [wd, e.time].compactMap { $0 }.joined(separator: " ")
    return [first, sportLength(e.durationMin), e.location ?? ""]
        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.joined(separator: " · ")
}

/// What an event changes — only what the app really does with it.
public let sportEventEffect = "Bekerül a heted sport sávjába, és szólok, ha szoros mellette a kondi."

/// The event sheet's day: „dec 13., szombat".
public func sportEventDateLabel(_ ymd: String) -> String {
    let wd = sportLegacyWeekday(ymd).map { sportDayNames[$0].lowercased() }
    return "\(sportMonthDay(ymd)).\(wd.map { ", \($0)" } ?? "")"
}

/// `ymd` plus `days` (`yyyy-MM-dd`).
public func sportAddDays(_ ymd: String, _ days: Int) -> String {
    guard let d = sportDate(ymd) else { return ymd }
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: d.addingTimeInterval(Double(days) * 86_400))
}
