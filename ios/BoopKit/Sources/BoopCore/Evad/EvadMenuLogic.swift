import Foundation

// Pure builders for the Menü and Lista tabs (Boop B6 Évad S3, `mezo-r36n9.16`): dates in his words, the day card's
// kind line, the shelf groups, the share text and the wall's approval card. No number here is computed on the phone —
// every kcal and amount is the server's.

/// "2026-11-23": the Monday of the week `date` falls in (phone calendar, Monday-first).
public func evadMonday(_ date: Date, calendar: Calendar = .current) -> String {
    var cal = Calendar(identifier: .gregorian); cal.timeZone = calendar.timeZone; cal.firstWeekday = 2
    let weekday = cal.component(.weekday, from: date) // 1 = Sunday … 7 = Saturday
    let back = (weekday + 5) % 7                         // Monday → 0, Sunday → 6
    let monday = cal.date(byAdding: .day, value: -back, to: cal.startOfDay(for: date)) ?? date
    let c = cal.dateComponents([.year, .month, .day], from: monday)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// `iso` plus `days` days, "yyyy-MM-dd" (Gregorian, no time zone involved).
public func evadAddDays(_ iso: String, _ days: Int) -> String {
    let p = iso.split(separator: "-").compactMap { Int($0) }
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
    guard p.count == 3, let d = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])),
          let n = cal.date(byAdding: .day, value: days, to: d) else { return iso }
    let c = cal.dateComponents([.year, .month, .day], from: n)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// "nov. 24–30." — or "nov. 29. – dec. 5." across a month end.
public func evadWeekRange(_ weekStart: String) -> String {
    let end = evadAddDays(weekStart, 6)
    let a = evadShortDate(weekStart), b = evadShortDate(end)
    let am = weekStart.split(separator: "-"), bm = end.split(separator: "-")
    if am.count == 3, bm.count == 3, am[1] == bm[1], let day = Int(bm[2]) {
        return "\(a.dropLast())–\(day)."
    }
    return "\(a) – \(b)"
}

/// "Hétfő" for a `yyyy-MM-dd`.
public func evadDayName(_ iso: String) -> String {
    let names = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]
    let p = iso.split(separator: "-").compactMap { Int($0) }
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
    guard p.count == 3, let d = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return iso }
    return names[(cal.component(.weekday, from: d) + 5) % 7]
}

/// The day card's kind line: "edzésnap", "röplabda", "edzés + röplabda", "pihenőnap".
public func evadDayKindText(_ day: EvadMenuDay) -> String {
    let sport = evadSportWord(day.sportName)
    switch day.kind {
    case "edzesnap": return "edzésnap"
    case "sport": return sport
    case "edzes_sport": return "edzés + \(sport)"
    default: return "pihenőnap"
    }
}

/// The sport's Hungarian word ("volleyball" → "röplabda"); unknown names are shown as they are, lower-case.
public func evadSportWord(_ name: String?) -> String {
    guard let n = name?.trimmingCharacters(in: .whitespaces), !n.isEmpty else { return "sport" }
    switch n.lowercased() {
    case "volleyball", "röplabda", "ropi", "röpi": return "röplabda"
    case "football", "soccer", "foci": return "foci"
    case "running", "futás": return "futás"
    case "swimming", "úszás": return "úszás"
    case "tennis", "tenisz": return "tenisz"
    case "basketball", "kosárlabda": return "kosárlabda"
    case "cycling", "bicikli", "kerékpár": return "kerékpár"
    default: return n.lowercased()
    }
}

/// The five shelf groups in list order, with the kit glyph of each.
public let evadShelves: [(key: String, title: String, glyph: String)] = [
    ("zoldseg", "Zöldség, gyümölcs", "leaf-sage"),
    ("hus", "Hús, hal", "fish-peach"),
    ("tej", "Tejtermék", "drop-sky"),
    ("kamra", "Kamra", "plate-deep"),
    ("egyeb", "Egyéb", "star-ink"),
]

/// The list's lines still needed, grouped by shelf in list order (empty groups left out). A „no longer needed" line
/// is not here — it lives in `evadChangedItems`.
public func evadShelfGroups(_ list: EvadShoppingList) -> [(key: String, title: String, glyph: String, items: [EvadShoppingItem])] {
    evadShelves.compactMap { shelf in
        let items = list.items.filter { $0.shelf == shelf.key && !$0.removed }
        return items.isEmpty ? nil : (shelf.key, shelf.title, shelf.glyph, items)
    }
}

/// The „változott" lines after a re-fit or a swap: moved amounts, new lines and lines no longer needed.
public func evadChangedItems(_ list: EvadShoppingList) -> [EvadShoppingItem] {
    list.items.filter { $0.changed }
}

/// „Bevásárlólista · nov. 24–30." then, per shelf, its title and `- név · mennyiség` lines of what is still to buy.
public func evadShareText(_ list: EvadShoppingList) -> String {
    var lines = ["Bevásárlólista · \(evadWeekRange(list.weekStart))"]
    for g in evadShelfGroups(list) {
        let open = g.items.filter { !$0.checked }
        guard !open.isEmpty else { continue }
        lines.append("")
        lines.append("\(g.title):")
        for i in open {
            lines.append(i.amountText.map { "- \(i.name) · \($0)" } ?? "- \(i.name)")
        }
    }
    return lines.joined(separator: "\n")
}

/// "1,25 adag" / "1 adag" — nil without a portion.
public func evadServingsText(_ s: Double?) -> String? {
    guard let s else { return nil }
    let r = (s * 100).rounded() / 100
    let text = r == r.rounded() ? String(Int(r)) : String(format: "%.2f", r).replacingOccurrences(of: ".", with: ",")
        .replacingOccurrences(of: #"0$"#, with: "", options: .regularExpression)
    return "\(text) adag"
}

// MARK: - The wall

extension EvadWallID {
    static let menu = "evad-menu-"
}

/// Next week's menu is waiting for his approval: an `.expires` card from the menu day on until the week starts
/// (it may ring, within the wall's two-a-day cap — decision #35). Nil when there is nothing to approve.
public func evadMenuCandidate(_ o: EvadOverview, now: Date, calendar: Calendar = .current) -> WallCandidate? {
    guard let m = o.menu, m.status == "proposed", let menuDay = m.menuDay else { return nil }
    let p = m.weekStart.split(separator: "-").compactMap { Int($0) }
    var greg = Calendar(identifier: .gregorian); greg.timeZone = calendar.timeZone
    guard p.count == 3, let weekStart = greg.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else {
        return nil
    }
    let today = greg.startOfDay(for: now)
    guard today < weekStart else { return nil }
    let daysBefore = greg.dateComponents([.day], from: today, to: weekStart).day ?? 99
    let dow = 7 - daysBefore // days before next Monday → 6 = vasárnap … 0 = hétfő
    guard dow >= menuDay else { return nil }
    return WallCandidate(
        id: EvadWallID.menu + m.weekStart, role: .expires, kind: .teendo, area: WallSources.evad,
        expiresAt: weekStart,
        text: "*Elkészült* a jövő heti menü",
        sub: "Nézd át, és hagyd jóvá — ebből készül a bevásárlólista.",
        primary: "Átnézem",
        settled: "Heti menü átnézve",
        why: "A kiválasztott receptjeidből állítottam össze \(evadWeekRange(m.weekStart)) hétre, az edzésnapjaidhoz igazítva. Amíg nem hagyod jóvá, semmi sem kerül a napi tervedbe.")
}

/// Whether `iso` (`yyyy-MM-dd`) is before today — a past day's meal is not swapped.
public func evadIsPast(_ iso: String, now: Date = Date(), calendar: Calendar = .current) -> Bool {
    iso < evadAddDays(evadMonday(now, calendar: calendar), dayIndex(now, calendar: calendar))
}

private func dayIndex(_ now: Date, calendar: Calendar) -> Int {
    var greg = Calendar(identifier: .gregorian); greg.timeZone = calendar.timeZone
    return (greg.component(.weekday, from: now) + 5) % 7
}
