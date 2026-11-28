import Foundation

// The Sport area's words and pictures as pure functions of the server's week (`mezo-r36n9.203`, spec §5.2). The
// server sends keys and numbers; every sentence the owner reads is built here, once, and tested.

/// Where today's sport stands. `none` = no sport today (a gym-only or a rest day).
public enum SportMoment: String, Sendable { case before, recorded, done, skipped, none }

public struct SportHead: Equatable, Sendable {
    public let headline: String
    public let sentence: String
}

/// One big number of the hero („6 ó 20 p · múlva kezdődik").
public struct SportFigure: Equatable, Sendable {
    public let value: String
    public let label: String
    public let lit: Bool
    public init(_ value: String, _ label: String, lit: Bool = false) { self.value = value; self.label = label; self.lit = lit }
}

/// A chip of the hero („megterhelés 7").
public struct SportChip: Equatable, Sendable {
    public let text: String
    public let on: Bool
    public init(_ text: String, on: Bool = false) { self.text = text; self.on = on }
}

/// The hero card's content for the moment.
public struct SportHero: Equatable, Sendable {
    public let moment: SportMoment
    public let eyebrow: String
    public let title: String
    public let line: String?
    public let figures: [SportFigure]
    public let chips: [SportChip]
    /// The quiet line under the figures (BEFORE: start the watch).
    public let note: String?
    /// The skip can be taken back (only a skip he made himself).
    public let canUndo: Bool
}

public func sportMoment(_ o: SportOverview) -> SportMoment {
    guard let t = o.tonight else { return .none }
    switch t.moment {
    case "RECORDED": return .recorded
    case "DONE": return .done
    case "SKIPPED": return .skipped
    default: return .before
    }
}

/// True while the week has no sport at all and no rhythm: the empty state („Még nincs sportod").
public func sportIsEmpty(_ o: SportOverview) -> Bool {
    o.weekCount == nil && o.tonight == nil && o.days.allSatisfy { $0.sport.isEmpty }
}

// MARK: - Numbers and words

/// „6 ó 20 p", „2 ó", „45 p".
public func sportClock(_ minutes: Int) -> String {
    let m = max(0, minutes)
    let h = m / 60, r = m % 60
    if h > 0 && r > 0 { return "\(h) ó \(r) p" }
    if h > 0 { return "\(h) ó" }
    return "\(r) p"
}

/// The length of a session as the spike's lines say it: „2 óra", „45 perc", „1 ó 30 p".
public func sportLength(_ minutes: Int) -> String {
    if minutes % 60 == 0 && minutes >= 60 { return "\(minutes / 60) óra" }
    if minutes < 60 { return "\(minutes) perc" }
    return "\(minutes / 60) ó \(minutes % 60) p"
}

/// The effort's word (spike `rpeWord`).
public func sportEffortWord(_ rpe: Int) -> String {
    rpe <= 3 ? "könnyű" : rpe <= 6 ? "közepes" : rpe <= 8 ? "kemény" : "a határon"
}

/// „18:00" → the part of the day the hero names.
func sportDaypart(_ time: String?) -> String? {
    guard let h = sportHour(time) else { return nil }
    switch h {
    case ..<10: return "reggel"
    case ..<12: return "délelőtt"
    case ..<17: return "délután"
    default: return "este"
    }
}

/// „18:30" → 18.5.
func sportHour(_ time: String?) -> Double? {
    guard let time, time.count >= 4 else { return nil }
    let parts = time.split(separator: ":")
    guard parts.count >= 2, let h = Double(parts[0]), let m = Double(parts[1]) else { return nil }
    return h + m / 60
}

private let ordinalAdjective = ["", "Egyes", "Kettes", "Hármas", "Négyes", "Ötös", "Hatos", "Hetes", "Nyolcas", "Kilences", "Tízes"]
private let hourWords = ["", "egy", "két", "három", "négy", "öt", "hat"]
private let weekdayOn = ["hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap"]
private let weekdayName = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]
private let weekdayShort = ["Hé", "Ke", "Sze", "Csü", "Pé", "Szo", "Va"]

/// „két órán át", „másfél órán át", „45 percen át".
func sportForHow(_ minutes: Int) -> String {
    if minutes == 90 { return "másfél órán át" }
    if minutes % 60 == 0, minutes / 60 < hourWords.count, minutes >= 60 { return "\(hourWords[minutes / 60]) órán át" }
    return "\(minutes) percen át"
}

private func firstUpper(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }

/// The kind every sport item of the week shares, else nil (then the count says „sport").
func sportWeekKind(_ o: SportOverview) -> SportKind? {
    let kinds = Set(o.days.flatMap(\.sport).map(\.kind))
    return kinds.count == 1 ? kinds.first : nil
}

// MARK: - The head

/// The area page's headline and sentence for the Ma tab (spike `head`).
public func sportHead(_ o: SportOverview) -> SportHead {
    guard let t = o.tonight else { return noSportHead(o) }
    let kind = t.sportKind
    switch sportMoment(o) {
    case .before:
        let part = sportDaypart(t.time)
        let headline = "Ma\(part.map { " \($0)" } ?? "") \(kind.inSentence)"
        var sentence = ""
        if let gym = o.todayDay?.gym.first {
            let gymPart = sportDaypart(gym.time).map { firstUpper($0) } ?? "Ma"
            sentence = "\(gymPart) kondi \(gym.done ? "volt" : "lesz"), "
            sentence += "\(part ?? "ma") \(t.time.map { "\($0)-kor " } ?? "")\(kind.name.lowercased())."
            sentence += " " + gapClause(o)
        } else {
            sentence = "Ma nincs kondi, csak \(kind.name.lowercased())\(t.time.map { " \($0)-kor" } ?? "")."
        }
        return SportHead(headline: headline, sentence: sentence)
    case .recorded:
        let what = kind.hasSetsAndShoulder ? "Csak a megterhelést, a szetteket és a vállad jelöld." : "Csak a megterhelést jelöld."
        return SportHead(headline: "Az órád rögzítette \(sportArticle(sportAccusative(kind)))", sentence: what)
    case .done:
        let rpe = t.session?.rpe.map { Int($0.rounded()) }
        let headline: String
        if let rpe {
            let word = sportEffortWord(rpe)
            headline = word == "a határon" ? "Nagyon kemény \(kind.inSentence) volt" : "\(firstUpper(word)) \(kind.inSentence) volt"
        } else {
            headline = "Megvolt \(sportArticle(kind.inSentence))"
        }
        var sentence = ""
        if let rpe, (1...10).contains(rpe) {
            sentence = "\(ordinalAdjective[rpe]) megterhelés"
            if let min = t.session?.durationMin { sentence += " \(sportForHow(min))" }
        } else if let min = t.session?.durationMin {
            sentence = "\(firstUpper(sportForHow(min)))"
        } else {
            sentence = "Bekerült a napodba"
        }
        if let load = t.session?.load, isBiggestDay(o, load: load) {
            sentence += ": ez a heti terhelésed legnagyobb napja."
        } else {
            sentence += "."
        }
        return SportHead(headline: headline, sentence: sentence)
    case .skipped:
        var sentence = ""
        if let skip = t.skip {
            if let reason = SportSkipReason(wire: skip.reason) { sentence = reason.sentence }
            else if skip.reason == "KAPACITAS" { sentence = "Boop átrendezte a napodat." }
            if skip.serious { sentence += (sentence.isEmpty ? "" : " ") + "Ez nem számít kihagyásnak." }
            else if skip.freePass { sentence += (sentence.isEmpty ? "" : " ") + "A heti egy szabad kihagyásod ez lett." }
        }
        if sentence.isEmpty { sentence = "A kondit ehhez igazítom." }
        return SportHead(headline: "Ma kimarad \(sportArticle(kind.inSentence))", sentence: sentence)
    case .none:
        return noSportHead(o)
    }
}

/// „röpit", „futást", „TRX-et", „kosarat", „túrát".
func sportAccusative(_ kind: SportKind) -> String {
    switch kind {
    case .volleyball: "röpit"
    case .running: "futást"
    case .cross: "crosst"
    case .trx: "TRX-et"
    case .bike: "kerékpározást"
    case .swim: "úszást"
    case .football: "focit"
    case .basketball: "kosarat"
    case .tennis: "teniszt"
    case .hike: "túrát"
    case .other: "sportot"
    }
}

private func gapClause(_ o: SportOverview) -> String {
    let today = o.hints.filter { $0.date == o.today }
    if today.contains(where: { $0.key == "GAP_TIGHT" }) { return "Szoros a kettő között." }
    if today.contains(where: { $0.key == "GAP_SHORT" }) { return "Kevés idő van köztük, ne hajtsd túl a kondit." }
    return "Elég idő van köztük."
}

private func isBiggestDay(_ o: SportOverview, load: Int) -> Bool {
    let others = o.days.filter { $0.date != o.today }.flatMap(\.sport).compactMap(\.load)
    return !others.isEmpty && others.allSatisfy { load >= $0 }
}

/// The next planned sport after today in this week.
public func sportNext(_ o: SportOverview) -> (date: String, item: SportLaneItem)? {
    for day in o.days where day.date > o.today {
        if let item = day.sport.first(where: { $0.state == "PLANNED" }) { return (day.date, item) }
    }
    return nil
}

private func noSportHead(_ o: SportOverview) -> SportHead {
    let gymToday = o.todayDay?.gym.isEmpty == false
    var sentence = gymToday ? "Ma kondi van, sport nincs. " : ""
    if let next = sportNext(o), let wd = sportLegacyWeekday(next.date) {
        sentence += "Legközelebb \(weekdayOn[wd])\(next.item.time.map { " \($0)-kor" } ?? "") \(next.item.kind.inSentence)."
    } else {
        sentence += "Ezen a héten nincs több sport."
    }
    return SportHead(headline: "Ma nincs sport", sentence: sentence)
}

// MARK: - The hero

/// The hero card for the moment, in a given zone for the watch's clock times.
public func sportHero(_ o: SportOverview, zone: TimeZone = .current) -> SportHero {
    let count = o.weekCount
    let kind = o.tonight?.sportKind ?? .other
    let countLabel = "e heti \((sportWeekKind(o) ?? .other).inSentence) kész"
    guard let t = o.tonight else {
        if let next = sportNext(o), let wd = sportLegacyWeekday(next.date) {
            let line = [weekdayName[wd] + (next.item.time.map { " \($0)" } ?? ""), next.item.durationMin.map(sportLength)]
                .compactMap { $0 }.joined(separator: " · ")
            var figures: [SportFigure] = []
            if let count { figures.append(SportFigure("\(count.done)/\(count.planned)", countLabel, lit: true)) }
            return SportHero(moment: .none, eyebrow: "MA NINCS SPORT · LEGKÖZELEBB", title: next.item.kind.name, line: line,
                             figures: figures, chips: [], note: nil, canUndo: false)
        }
        return SportHero(moment: .none, eyebrow: "MA NINCS SPORT", title: "Ezen a héten nincs több",
                         line: count.map { $0.done >= $0.planned ? "A heti sportod megvan." : "A hét hátralévő része pihenő." },
                         figures: count.map { [SportFigure("\($0.done)/\($0.planned)", countLabel, lit: true)] } ?? [],
                         chips: [], note: nil, canUndo: false)
    }
    let moment = sportMoment(o)
    let eyebrow: String
    switch moment {
    case .done: eyebrow = "MA · KÉSZ"
    case .skipped: eyebrow = "MA · KIHAGYVA"
    default:
        let part = sportDaypart(t.time).map { " \($0.uppercased())" } ?? ""
        eyebrow = "MA\(part)\(t.time.map { " · \($0)" } ?? "")"
    }
    let length = (t.durationMin ?? t.session?.durationMin ?? t.health?.minutes).map(sportLength)
    let line = [length, t.kind.map { $0 == "match" ? "meccs" : "edzés" }, t.location?.isEmpty == false ? t.location : nil]
        .compactMap { $0 }.joined(separator: " · ")
    var figures: [SportFigure] = []
    var chips: [SportChip] = []
    var note: String?
    var canUndo = false
    switch moment {
    case .before, .none:
        if let mins = t.startsInMinutes {
            figures.append(mins > 0 ? SportFigure(sportClock(mins), "múlva kezdődik") : SportFigure(sportClock(-mins), "óta tart"))
        }
        if let count { figures.append(SportFigure("\(count.done)/\(count.planned)", countLabel, lit: true)) }
        note = "Indítsd el az órádon a \(kind.name) edzést — utána innen töltöm ki a naplót."
    case .recorded:
        if let h = t.health {
            figures.append(SportFigure(sportClock(h.minutes), sportRange(h, zone: zone) ?? "az órádról"))
            if let kcal = h.kcal { figures.append(SportFigure("\(kcal)", "kcal az órádról", lit: true)) }
            if let hr = h.avgHr { figures.append(SportFigure("\(hr)", "átlagpulzus")) }
        }
    case .done:
        let s = t.session
        if let load = s?.load { figures.append(SportFigure("\(load)", "terhelés", lit: true)) }
        if let kcal = s?.kcal ?? t.health?.kcal { figures.append(SportFigure("\(kcal)", "kcal")) }
        if let sets = s?.setsPlayed { figures.append(SportFigure("\(sets)", "szett")) }
        if let sh = s?.shoulderStrain { figures.append(SportFigure("\(sh)/10", "váll")) }
        if let rpe = s?.rpe { chips.append(SportChip("megterhelés \(Int(rpe.rounded()))")) }
        if let min = s?.durationMin { chips.append(SportChip(sportClock(min))) }
        if t.health != nil { chips.append(SportChip("az órádról")) }
    case .skipped:
        if let skip = t.skip {
            let label = SportSkipReason(wire: skip.reason)?.pastLabel ?? (skip.reason == "KAPACITAS" ? "Átrendezés" : nil)
            if let label { chips.append(SportChip(label, on: true)) }
            if skip.freePass { chips.append(SportChip("a heti szabad kihagyás")) }
            if skip.serious { chips.append(SportChip("nem számít kihagyásnak")) }
            canUndo = true
        }
    }
    return SportHero(moment: moment, eyebrow: eyebrow, title: kind.name, line: line.isEmpty ? nil : line, figures: figures,
                     chips: chips, note: note, canUndo: canUndo)
}

/// „18:04–20:01" from the watch's start and minutes, in the phone's zone.
func sportRange(_ h: SportHealthWorkout, zone: TimeZone) -> String? {
    guard let start = sportInstant(h.start) else { return nil }
    let f = DateFormatter()
    f.locale = Locale(identifier: "hu_HU")
    f.timeZone = zone
    f.dateFormat = "HH:mm"
    return "\(f.string(from: start))–\(f.string(from: start.addingTimeInterval(Double(h.minutes) * 60)))"
}

/// The watch's start as the log's clock time („18:04").
public func sportStartClock(_ h: SportHealthWorkout, zone: TimeZone = .current) -> String? {
    guard let start = sportInstant(h.start) else { return nil }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = zone
    f.dateFormat = "HH:mm"
    return f.string(from: start)
}

func sportInstant(_ text: String) -> Date? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: text) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: text)
}

/// The ring and the head orb: „2/4" and its share; „–" without a rhythm.
public func sportRing(_ count: SportWeekCount?) -> (display: String, level: Double?) {
    guard let count, count.planned > 0 else { return ("–", nil) }
    return ("\(count.done)/\(count.planned)", min(1, Double(count.done) / Double(count.planned)))
}

/// VoiceOver for the hero ring.
public func sportRingLabel(_ count: SportWeekCount?) -> String {
    guard let count, count.planned > 0 else { return "Ezen a héten nincs tervezett sport" }
    return "A heti \(count.planned) alkalomból \(count.done) megvan"
}

// MARK: - A napod (the day strip)

public struct SportStripBlock: Equatable, Sendable {
    public let gym: Bool
    public let name: String
    public let time: String
    /// Hours of the day (6–23 on the strip).
    public let from: Double
    public let to: Double
    public let done: Bool
    public let legend: String
}

public struct SportStrip: Equatable, Sendable {
    public let blocks: [SportStripBlock]
    /// Items without a start: in the legend, not on the strip.
    public let legendOnly: [SportStripBlock]
    public let trailing: String
}

/// The day as two kinds of blocks: the gym and the sport, each its own. A sport-only day has no gym block.
public func sportStrip(_ o: SportOverview) -> SportStrip {
    let day = o.todayDay ?? SportWeekDay(date: o.today)
    var timed: [SportStripBlock] = [], untimed: [SportStripBlock] = []
    func add(_ item: SportLaneItem, gym: Bool) {
        let minutes = item.durationMin ?? (gym ? 60 : 90)
        let name = gym ? "Kondi" : item.kind.short
        let legend = gym ? "Kondi · \(item.label ?? "edzés")" : "\(item.kind.short) · \(sportLength(minutes))"
        let done = item.done
        if let h = sportHour(item.time), let time = item.time {
            timed.append(SportStripBlock(gym: gym, name: name, time: time, from: h, to: min(23, h + Double(minutes) / 60), done: done, legend: legend))
        } else {
            untimed.append(SportStripBlock(gym: gym, name: name, time: "", from: 0, to: 0, done: done, legend: legend))
        }
    }
    day.gym.forEach { add($0, gym: true) }
    var sport = day.sport
    // A logged session the week has not caught up with yet (the optimistic log) still shows as done.
    if sport.isEmpty, let t = o.tonight, t.moment != "SKIPPED" {
        sport = [SportLaneItem(layer: "SPORT", sport: t.sport, time: t.time, durationMin: t.durationMin, state: t.moment == "DONE" ? "DONE" : "PLANNED")]
    }
    sport.filter { $0.state != "SKIPPED" }.forEach { add($0, gym: false) }
    let hasGym = !day.gym.isEmpty, hasSport = !sport.filter({ $0.state != "SKIPPED" }).isEmpty
    let trailing = hasGym && hasSport ? "kondi + sport" : hasGym ? "kondi" : hasSport ? "sport" : "pihenő"
    return SportStrip(blocks: timed.sorted { $0.from < $1.from }, legendOnly: untimed, trailing: trailing)
}

/// VoiceOver for one strip block (spike: „Röpi 18:00, később").
public func sportStripLabel(_ b: SportStripBlock) -> String {
    "\(b.name)\(b.time.isEmpty ? "" : " \(b.time)"), \(b.done ? "kész" : "később")"
}

// MARK: - Ezen a héten (the week carousel)

public struct SportCardLine: Equatable, Sendable {
    public let text: String
    public let done: Bool
    public let gym: Bool
}

public struct SportDayCard: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let today: Bool
    public let lines: [SportCardLine]
}

public func sportWeekCards(_ o: SportOverview) -> [SportDayCard] {
    o.days.map { day in
        func suffix(_ i: SportLaneItem) -> String {
            switch i.state { case "SKIPPED": " · kihagyva"; case "MISSED": " · elmaradt"; default: "" }
        }
        let gym = day.gym.map { SportCardLine(text: ($0.label ?? "Kondi") + suffix($0), done: $0.done, gym: true) }
        let sport = day.sport.map { SportCardLine(text: $0.kind.short + suffix($0), done: $0.done, gym: false) }
        let name = sportLegacyWeekday(day.date).map { weekdayShort[$0] } ?? day.date
        return SportDayCard(id: day.date, name: name, today: day.date == o.today, lines: gym + sport)
    }
}

/// VoiceOver for a day card.
public func sportCardLabel(_ c: SportDayCard) -> String {
    let full = weekdayShort.firstIndex(of: c.name).map { weekdayName[$0] } ?? c.name
    let what = c.lines.isEmpty ? "pihenő" : c.lines.map { "\($0.gym ? "kondi" : "sport") \($0.text)\($0.done ? ", kész" : "")" }.joined(separator: "; ")
    return "\(full)\(c.today ? ", ma" : ""): \(what)"
}

// MARK: - Amire figyelek

public struct SportHintLine: Equatable, Sendable {
    public let text: String
    public let ok: Bool
}

/// Boop's interference hints in words: the server's from today on, plus a calm line when today's two fit well.
public func sportHints(_ o: SportOverview) -> [SportHintLine] {
    var out: [SportHintLine] = []
    let tomorrow = sportDate(o.today).map { $0.addingTimeInterval(86_400) }
    for h in o.hints {
        let kind = SportKind(wire: h.sport)
        switch h.key {
        case "GAP_TIGHT" where h.date >= o.today:
            let gap = h.gapHours.map { "\(hoursText($0)) óra" } ?? "kevés idő"
            out.append(SportHintLine(text: "\(dayWord(h.date, o)) a kondi és \(sportArticle(kind.inSentence)) között csak \(gap) van — ez szoros, a második előtt melegíts be alaposan.", ok: false))
        case "GAP_SHORT" where h.date >= o.today:
            let gap = h.gapHours.map { "\(hoursText($0)) óra" } ?? "kevés idő"
            out.append(SportHintLine(text: "\(dayWord(h.date, o)) \(gap) van a kondi és \(sportArticle(kind.inSentence)) között — elég, ha nem hajtod túl.", ok: false))
        case "SPORT_BEFORE_LEG_MORNING" where h.date > o.today:
            let isTomorrow = tomorrow.map { sportDate(h.date) == $0 } ?? false
            let when = isTomorrow ? "Holnap reggel" : "\(firstUpper(sportLegacyWeekday(h.date).map { weekdayOn[$0] } ?? "")) reggel"
            let heavy = h.heavy == true ? " kemény" : ""
            out.append(SportHintLine(text: "\(when) lábnap jön az előző esti\(heavy) \(kind.inSentence) után — ha fáj a lábad, a Könnyítés egy koppintás.", ok: false))
        case "SPORT_LOAD_DECLINE":
            let n = h.pairs ?? 2
            out.append(SportHintLine(text: "Az elmúlt két hétben \(n) alkalommal kevesebb ismétlés ment a kondin egy kemény \(kind.inSentence) utáni napon.", ok: false))
        default: break
        }
    }
    // The calm line (spike): both today, well apart, nothing to watch.
    if let day = o.todayDay, let gym = day.gym.first, let sport = day.sport.first ?? o.tonight.map({ SportLaneItem(layer: "SPORT", sport: $0.sport, time: $0.time, state: "PLANNED") }),
       let g = sportHour(gym.time), let s = sportHour(sport.time),
       !o.hints.contains(where: { $0.date == o.today && ($0.key == "GAP_TIGHT" || $0.key == "GAP_SHORT") }) {
        let gap = abs(s - (g + Double(gym.durationMin ?? 60) / 60))
        if gap >= 6 {
            let first = g < s ? "\(firstUpper(sportDaypart(gym.time) ?? "ma")) kondi, \(sportDaypart(sport.time) ?? "később") \(sport.kind.inSentence)"
                              : "\(firstUpper(sportDaypart(sport.time) ?? "ma")) \(sport.kind.inSentence), \(sportDaypart(gym.time) ?? "később") kondi"
            out.insert(SportHintLine(text: "\(first): \(hoursText(gap)) óra van köztük, ez bőven elég.", ok: true), at: 0)
        }
    }
    return out
}

private func hoursText(_ h: Double) -> String {
    let r = (h * 2).rounded() / 2
    return r == r.rounded() ? "\(Int(r))" : String(format: "%.1f", r).replacingOccurrences(of: ".", with: ",")
}

private func dayWord(_ date: String, _ o: SportOverview) -> String {
    if date == o.today { return "Ma" }
    return firstUpper(sportLegacyWeekday(date).map { weekdayOn[$0] } ?? date)
}

/// „a röpi", „az úszás".
func sportArticle(_ word: String) -> String {
    guard let first = word.lowercased().first else { return word }
    return ("aáeéiíoóöőuúüű".contains(first) ? "az " : "a ") + word
}
