import Foundation

// The Évad page's pure builders (Boop B6, `mezo-r36n9.16`): every word the page says about the season, chosen from
// the server's answer — never free text, never an invented number. A value the server sent as null is left out of
// the sentence (or the block is), and the copy is the owner-approved spike's.

// MARK: - Formatting

/// "84,1" — one decimal with a Hungarian comma; a whole number without it ("82").
public func evadKg(_ kg: Double) -> String {
    let r = (kg * 10).rounded() / 10
    if r == r.rounded() { return String(Int(r)) }
    return String(format: "%.1f", r).replacingOccurrences(of: ".", with: ",")
}

/// "−0,4" / "+0,3" — a signed weekly change with the typographic minus.
public func evadSignedKg(_ kg: Double) -> String {
    let body = evadKg(abs(kg))
    if (abs(kg) * 10).rounded() == 0 { return body }
    return (kg < 0 ? "\u{2212}" : "+") + body
}

/// "2440" — a day's kcal as the spike prints them; five digits and more get a no-break space (the repo's grouping; Outfit has no narrow one) ("17 080").
public func evadKcal(_ kcal: Int) -> String {
    let digits = String(abs(kcal))
    guard digits.count >= 5 else { return String(kcal) }
    var groups: [String] = []
    var rest = Substring(digits)
    while rest.count > 3 { groups.insert(String(rest.suffix(3)), at: 0); rest = rest.dropLast(3) }
    groups.insert(String(rest), at: 0)
    return (kcal < 0 ? "-" : "") + groups.joined(separator: "\u{00A0}")
}

/// "8 ó 6 p" / "8 ó".
public func evadHM(_ minutes: Int) -> String {
    minutes % 60 == 0 ? "\(minutes / 60) ó" : "\(minutes / 60) ó \(minutes % 60) p"
}

/// The rest-day figure: „nincs" when every day of the week is a training or sport day (the server sends null).
public func restDayText(_ kcal: Int?) -> String {
    guard let kcal else { return "nincs" }
    return "\(evadKcal(kcal)) kcal"
}

/// "81–83 kg".
public func evadBandText(_ band: EvadBand) -> String { "\(evadKg(band.lowKg))–\(evadKg(band.highKg)) kg" }

/// "2027-01-01" → "jan. 1."
public func evadShortDate(_ iso: String) -> String {
    let parts = iso.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3, (1...12).contains(parts[1]) else { return iso }
    let months = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]
    return "\(months[parts[1] - 1]) \(parts[2])."
}

/// The engine's pace verdict in his words.
public func evadPaceWord(_ verdict: String?) -> String? {
    switch verdict {
    case "feasible": "reális"
    case "warnings": "feszes"
    case "aggressive": "túl gyors"
    default: nil
    }
}

/// "Fogyás" / "Súlytartás" / "Izomépítés" — the three goals of the new-season switch, with their trajectories.
public let evadGoals: [(name: String, trajectory: String)] = [("Fogyás", "cut"), ("Súlytartás", "maintain"), ("Izomépítés", "bulk")]

// MARK: - Days and sport

/// Weekday 0 = hétfő … 6 = vasárnap, in the "-n" form: "kedden".
public func evadDayOn(_ day: Int) -> String {
    let names = ["hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap"]
    return names.indices.contains(day) ? names[day] : ""
}

/// "kedden és csütörtökön" / "hétfőn, szerdán és pénteken".
public func evadDayList(_ days: [Int]) -> String {
    let words = days.sorted().map(evadDayOn).filter { !$0.isEmpty }
    guard let last = words.last else { return "" }
    return words.count == 1 ? last : words.dropLast().joined(separator: ", ") + " és " + last
}

/// The sport's name in his words.
public func evadSportName(_ sport: String) -> String {
    switch sport {
    case "volleyball": "röplabda"
    case "cross": "cross edzés"
    case "trx": "TRX"
    default: sport
    }
}

/// "röplabda kedden és csütörtökön" — one phrase per sport, in the order they first appear.
public func evadSportSummary(_ slots: [EvadSportSlot]) -> String {
    var order: [String] = []
    for s in slots where !order.contains(s.sport) { order.append(s.sport) }
    return order.map { sport in
        "\(evadSportName(sport)) \(evadDayList(slots.filter { $0.sport == sport }.map(\.dayOfWeek)))"
    }.joined(separator: ", ")
}

/// The gym days after the "Edzések hetente" stepper moved to `count`: extra days go where there is no sport first,
/// spread out from the existing ones; fewer days drop the last ones. The result is sorted.
public func evadAdjustGymDays(_ days: [Int], to count: Int, avoiding sport: [Int]) -> [Int] {
    var out = Array(Set(days)).sorted()
    let n = max(0, min(7, count))
    while out.count > n { out.removeLast() }
    while out.count < n {
        let free = (0..<7).filter { !out.contains($0) }
        // prefer a day with no sport, then the one farthest from any gym day
        func distance(_ d: Int) -> Int {
            out.map { g in min(abs(g - d), 7 - abs(g - d)) }.min() ?? 7
        }
        guard let pick = free.max(by: { a, b in
            let ka = (sport.contains(a) ? 0 : 1, distance(a), -a)
            let kb = (sport.contains(b) ? 0 : 1, distance(b), -b)
            return ka < kb
        }) else { break }
        out.append(pick); out.sort()
    }
    return out
}

/// A season's default name for a goal and a start date: "Őszi fogyás", "Téli izomépítés".
public func evadDefaultTitle(trajectory: String, startDate: String) -> String {
    let month = startDate.split(separator: "-").dropFirst().first.flatMap { Int($0) } ?? 1
    let season = switch month {
    case 3...5: "Tavaszi"
    case 6...8: "Nyári"
    case 9...11: "Őszi"
    default: "Téli"
    }
    let goal = switch trajectory {
    case "cut": "fogyás"
    case "bulk": "izomépítés"
    default: "súlytartás"
    }
    return "\(season) \(goal)"
}

// MARK: - The head

/// "Őszi fogyás · 12 hétből a 7."
public func evadEyebrow(_ head: EvadHead) -> String { "\(head.title) · \(head.weeks) hétből a \(head.week)." }

/// How full the head's orb is: the week of the season.
public func evadLevel(_ head: EvadHead) -> Double {
    guard head.weeks > 0 else { return 0 }
    return min(1, max(0, Double(head.week) / Double(head.weeks)))
}

/// The head's verdict, chosen from the overview's status — never free text. `*…*` marks the hue-coloured words.
public func evadVerdict(_ o: EvadOverview) -> (headline: String, sentence: String) {
    let w = o.weight
    let bulk = o.head.trajectory == "bulk"
    let verb = bulk ? "hízol" : "fogysz"
    let pace = w.kgPerWeek.map { "heti *\(evadKg(abs($0))) kg-ot*" }
    let band = (w.band ?? o.pillars.weight.band).map { "a *\(evadBandText($0))-os* sávban" }
    switch o.head.status {
    case "on_course":
        return ("Jó úton vagy", pace.map { "Az edzés, az evés és az alvás most összhangban van: \($0) \(verb), ahogy terveztük." }
                ?? "Az edzés, az evés és az alvás most összhangban van, ahogy terveztük.")
    case "slower":
        return ("Lassabban megy, mint terveztük",
                "Lassabban \(verb), mint terveztük. Boop először az alvást és az evést nézi meg, és csak utána nyúl a kalóriához.")
    case "faster":
        return ("Gyorsabban megy, mint terveztük",
                "Gyorsabban \(verb), mint terveztük. Figyelek, hogy közben az erőd megmaradjon.")
    case "in_band":
        return ("Tartod a súlyod", band.map { "A súlyod \($0) van, ahogy terveztük. Az edzés, az evés és az alvás összhangban van." }
                ?? "A súlyod ott van, ahol terveztük. Az edzés, az evés és az alvás összhangban van.")
    case "out_of_band":
        return ("Kicsit kijjebb mentél a sávból",
                (band.map { "A súlyod most kívül esik \($0.replacingOccurrences(of: "sávban", with: "sávon")). " } ?? "")
                + "Boop először az evést és az alvást nézi meg, és csak utána nyúl a kalóriához.")
    default:
        return ("Még kevés a mérés", "Ahhoz, hogy megmondjam, hol tartasz, még néhány mérés kell. Mérd meg magad párszor ezen a héten.")
    }
}

// MARK: - Mi mire hat

/// The four pillars of the system map, in its order: Edzés (top) · Étel (left) · Alvás (right) · Súly (bottom).
public let evadPillarKeys = ["edzes", "etel", "alvas", "suly"]

public func evadPillarName(_ key: String) -> String {
    switch key {
    case "edzes": "Edzés"
    case "etel": "Étel"
    case "alvas": "Alvás"
    case "suly": "Súly"
    default: key
    }
}

/// One line under a lit pillar: what flows from one pillar to another.
public struct EvadLinkLine: Equatable, Hashable, Sendable {
    public let from: String
    public let to: String
    public let text: String
    public init(from: String, to: String, text: String) { self.from = from; self.to = to; self.text = text }
}

/// What one link says, with the server's number when it computed one.
public func evadLinkText(_ link: EvadMapLink, trajectory: String) -> String? {
    switch link.key {
    case "train_food": link.value.map { "edzésnapon +\(Int($0.rounded())) kcal" } ?? "edzésnapon több étel kell"
    case "train_sleep": "több alvás kell"
    case "food_weight":
        if let v = link.value, (abs(v) * 10).rounded() > 0 { "\(evadSignedKg(v)) kg/hét" }
        else if trajectory == "maintain" { "így tartod a súlyod" }
        else { "ettől függ a súlyod" }
    case "sleep_food": "rossz alvás után többet eszel"
    case "food_train": "szénhidrát az erőhöz"
    case "sleep_train": "kipihenten jobban edzel"
    default: nil
    }
}

/// The links of the lit pillar (every link when nothing is lit), cause → effect, in the server's order. A link
/// whose key this phone does not know is left out.
public func mapLinkLines(_ o: EvadOverview, lit: String?) -> [EvadLinkLine] {
    o.map.links
        .filter { lit == nil || $0.from == lit || $0.to == lit }
        .compactMap { l in
            evadLinkText(l, trajectory: o.head.trajectory)
                .map { EvadLinkLine(from: evadPillarName(l.from), to: evadPillarName(l.to), text: $0) }
        }
}

/// The serif sentence under the map: what the lit pillar depends on, with the season's own numbers.
public func evadPillarDetail(_ o: EvadOverview, lit: String?) -> String {
    let p = o.pillars
    let trajectory = o.head.trajectory
    switch lit {
    case "edzes":
        let gym = p.block.gymDays.count
        let sport = p.block.sport.count
        let why = sport > 0 ? "A heti \(gym) edzés és a \(sport) sportnap miatt" : "A heti \(gym) edzés miatt"
        let eat: String? = p.food.trainDayKcal.map { train in
            if let rest = p.food.restDayKcal {
                "\(why) edzésnapon \(evadKcal(train)), pihenőnapon \(evadKcal(rest)) kcal-t ehetsz."
            } else {
                "\(why) edzésnapon \(evadKcal(train)) kcal-t ehetsz, pihenőnapod nincs."
            }
        }
        return [eat, "Minél többet edzel, annál több étel és alvás kell."].compactMap { $0 }.joined(separator: " ")
    case "etel":
        let first: String = switch trajectory {
        case "cut": (p.weight.kgPerWeek ?? o.weight.kgPerWeek).map {
            "A súlyod az evésen múlik: heti \(evadKg(abs($0))) kg-ot fogysz, mert kevesebbet eszel, mint amennyit égetsz."
        } ?? "A súlyod az evésen múlik: kevesebbet eszel, mint amennyit égetsz."
        case "bulk": (p.weight.kgPerWeek ?? o.weight.kgPerWeek).map {
            "A súlyod az evésen múlik: heti \(evadKg(abs($0))) kg-ot hízol, mert kicsit többet eszel, mint amennyit égetsz."
        } ?? "A súlyod az evésen múlik: kicsit többet eszel, mint amennyit égetsz."
        default: "A súlyod az evésen múlik: annyit eszel, amennyit égetsz, így a súlyod a sávban marad."
        }
        return first + " A szénhidrát főleg az edzésnapokra jut, hogy legyen erőd."
    case "alvas":
        let need = p.sleep.needMin.map { "Ehhez a terheléshez \(evadHM($0)) alvás kell. " } ?? ""
        return need + "Rövid éjszaka után többet eszel, és gyengébben edzel."
    case "suly":
        let when: String = switch trajectory {
        case "cut": "Ha lassabban fogysz"
        case "bulk": "Ha lassabban hízol"
        default: "Ha kicsúszol a sávból"
        }
        return "A súlyod a másik három eredménye. \(when), Boop először az alvást és az evést nézi meg, és csak utána nyúl a kalóriához."
    default:
        return "Ha az egyik változik, változik a többi is. Koppints valamelyikre, és megmutatom, mi függ tőle."
    }
}

// MARK: - Az évad terve

/// "Étel · 2440 / 2270 kcal" and its sub-line; nil when the server has no food figures.
public func evadFoodRow(_ f: EvadFoodPillar) -> (title: String, sub: String)? {
    guard let train = f.trainDayKcal else { return nil }
    let nova = (f.novaMax ?? 4) < 4 ? "kevéssé feldolgozott ételek" : nil
    let protein = f.proteinG.map { "\($0) g fehérje" }
    if let rest = f.restDayKcal {
        return ("Étel · \(evadKcal(train)) / \(evadKcal(rest)) kcal",
                ["edzés- és pihenőnapon", protein, nova].compactMap { $0 }.joined(separator: " · "))
    }
    return ("Étel · \(evadKcal(train)) kcal", ["edzésnapon · nincs pihenőnap", protein, nova].compactMap { $0 }.joined(separator: " · "))
}

/// "fekvés 22:09 körül, ha 6:30-kor kelsz".
public func evadSleepSub(_ s: EvadSleepPillar) -> String? {
    guard let bed = s.bedtime else { return nil }
    if s.anchor == "WAKE", let wake = s.anchorTime { return "fekvés \(bed) körül, ha \(evadClock(wake))-kor kelsz" }
    return "fekvés \(bed) körül"
}

/// "06:30" → "6:30".
public func evadClock(_ hhmm: String) -> String { hhmm.hasPrefix("0") ? String(hhmm.dropFirst()) : hhmm }


// MARK: - Módosítás

/// Elfogadom only accepts the draft on screen: the preview (and its fingerprint) must have been made for exactly that
/// draft — not for the one before the last tap (inside the debounce), nor after a failed re-preview.
public func evadCanAccept(previewOf: EvadDraft?, current: EvadDraft?) -> Bool {
    guard let previewOf, let current else { return false }
    return previewOf == current
}

/// While the season's block runs, the gym days stay as they are: the block's weekdays are built on them.
public func evadGymDaysLocked(_ o: EvadOverview) -> Bool { o.pillars.block.mesocycleId != nil }

public let evadGymDaysLockedLine =
    "Amíg fut az edzésblokk, az edzésnapok maradnak: a blokk napjai ezekhez igazodnak. Ha a blokk véget ér, átrendezheted."

/// One Most | Utána line of „Ennyi változna".
public struct EvadCompareRow: Equatable, Sendable {
    public let label: String
    public let left: String
    public let right: String
    public init(label: String, left: String, right: String) { self.label = label; self.left = left; self.right = right }
    public var changed: Bool { left != right }
}

/// The lines of „Ennyi változna": a figure the server sent as null on both sides is left out.
public func evadCompareRows(_ a: EvadNumbers, _ b: EvadNumbers) -> [EvadCompareRow] {
    var out = [
        EvadCompareRow(label: "Edzésnapon", left: "\(evadKcal(a.trainDayKcal)) kcal", right: "\(evadKcal(b.trainDayKcal)) kcal"),
        EvadCompareRow(label: "Pihenőnapon", left: restDayText(a.restDayKcal), right: restDayText(b.restDayKcal)),
    ]
    if a.weekKcal != nil || b.weekKcal != nil {
        out.append(EvadCompareRow(label: "Heti összesen", left: a.weekKcal.map { "\(evadKcal($0)) kcal" } ?? "–",
                                  right: b.weekKcal.map { "\(evadKcal($0)) kcal" } ?? "–"))
    }
    out += [
        EvadCompareRow(label: "Szénhidrát edzésnapon", left: "\(a.carbsTrainG) g", right: "\(b.carbsTrainG) g"),
        EvadCompareRow(label: "Alvásigény", left: evadHM(a.sleepNeedMin), right: evadHM(b.sleepNeedMin)),
        EvadCompareRow(label: "Lefekvés", left: a.bedtime, right: b.bedtime),
    ]
    if a.targetDate != nil || b.targetDate != nil {
        out.append(EvadCompareRow(label: "Célba érsz", left: a.targetDate.map(evadShortDate) ?? "–",
                                  right: b.targetDate.map(evadShortDate) ?? "–"))
    }
    if a.paceVerdict != nil || b.paceVerdict != nil {
        func word(_ v: String?) -> String { evadPaceWord(v).map { $0.prefix(1).uppercased() + $0.dropFirst() } ?? "–" }
        out.append(EvadCompareRow(label: "A tempó", left: word(a.paceVerdict), right: word(b.paceVerdict)))
    }
    if a.targetDate == nil, b.targetDate == nil, let band = b.band {
        out.append(EvadCompareRow(label: "A sáv", left: a.band.map(evadBandText) ?? "–", right: evadBandText(band)))
    }
    return out
}
