import Foundation

/// The season's weight course: losing, gaining, or holding a band (`EvadHead.trajectory`).
public enum SulyCourse: String, Sendable {
    case cut, bulk, maintain

    /// The server's word; anything unknown (and no season at all) reads as holding.
    public init(trajectory: String?) {
        self = trajectory.flatMap(SulyCourse.init(rawValue:)) ?? .maintain
    }
}

/// How well the weight follows the season's plan, 0–100 — the Súly orb's number (owner 2026-11-24, "a szám rajta azt
/// mutassa, hogy mennyire jól követjük a súlycélt", `mezo-r36n9.158`).
///
/// A cut or a bulk compares the trend's weekly rate with the planned one: 100 at the planned pace, falling as the
/// trend lags behind it (half the planned pace = 50, standing still = 0, the wrong direction = 0); going faster than
/// planned costs half as much (a fifth faster = 90), because the season's guards, not this number, say when fast is
/// too fast. Maintain measures the trend's distance from the band's centre: inside the band 100 → 80, outside it
/// falling to 0 at a second band-width out. nil whenever a number would be invented: no season, no trend, no plan.
public func sulyPaceScore(actualKgPerWeek: Double?, plannedKgPerWeek: Double?, course: SulyCourse,
                          trendKg: Double?, bandLowKg: Double?, bandHighKg: Double?) -> Int? {
    switch course {
    case .maintain:
        guard let trendKg, let bandLowKg, let bandHighKg, bandHighKg > bandLowKg else { return nil }
        let centre = (bandLowKg + bandHighKg) / 2, half = (bandHighKg - bandLowKg) / 2
        let d = abs(trendKg - centre) / half
        let score = d <= 1 ? 100 - d * 20 : max(0, 80 - (d - 1) * 80)
        return Int(score.rounded())
    case .cut, .bulk:
        guard let actualKgPerWeek, let plannedKgPerWeek, abs(plannedKgPerWeek) > 0.001 else { return nil }
        let ratio = actualKgPerWeek / plannedKgPerWeek
        if ratio <= 0 { return 0 }
        let deviation = ratio > 1 ? (ratio - 1) / 2 : 1 - ratio
        return Int((max(0, 1 - deviation) * 100).rounded())
    }
}

/// The word under the number: the score's own band.
public func sulyPaceWord(score: Int?, course: SulyCourse) -> String {
    guard let score else { return "még nincs adat" }
    if course == .maintain { return score >= 80 ? "a sávban vagy" : (score >= 40 ? "a sáv szélén" : "kint a sávból") }
    return score >= 80 ? "pályán vagy" : (score >= 50 ? "lassabb a tervnél" : "elmaradsz a tervtől")
}

/// Kilograms the way the room prints them: one decimal, a comma.
public func sulyKg(_ kg: Double) -> String {
    String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
}

/// „február 14." from `2027-02-14`; nil for anything else.
public func sulyDateText(_ ymd: String?) -> String? {
    guard let ymd, ymd.count == 10 else { return nil }
    let parts = ymd.split(separator: "-")
    guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]), (1...12).contains(m) else { return nil }
    let months = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember",
                  "október", "november", "december"]
    return "\(months[m - 1]) \(d)."
}

/// The head of the Súly room: a headline and a sentence.
public struct SulyHead: Equatable, Sendable {
    public let headline: String
    public let sentence: String
    public init(headline: String, sentence: String) { self.headline = headline; self.sentence = sentence }
}

/// The head's words: the server's own status (`EvadHead.status`) first; no season says so, and sends him to the Évad.
public func sulyHead(status: String?, course: SulyCourse, trendKg: Double?, targetKg: Double?, targetDate: String?,
                     actualKgPerWeek: Double?, plannedKgPerWeek: Double?, hasSeason: Bool) -> SulyHead {
    guard hasSeason else {
        return SulyHead(headline: "Nincs évad",
                        sentence: "A súlycél az Évadban él: indíts egy évadot, és itt látod, mennyire tartod az ütemét. A méréseid addig is itt vannak.")
    }
    // The direction is the trend's own, never the course's: a cut whose trend rises must say "felfelé".
    let plannedWay = course == .bulk ? "felfelé" : "lefelé"
    var pace = ""
    if let actualKgPerWeek, let plannedKgPerWeek {
        let way = actualKgPerWeek > 0 ? "felfelé" : "lefelé"
        let wrongWay = (actualKgPerWeek > 0) != (plannedKgPerWeek > 0)
        pace = "A trended heti \(sulyKg(abs(actualKgPerWeek))) kg-ot megy \(way), a terv \(sulyKg(abs(plannedKgPerWeek)))"
            + (wrongWay ? " \(plannedWay). " : ". ")
    }
    var target = ""
    if let targetKg {
        target = sulyDateText(targetDate).map { "Így \($0) körül éred el a \(sulyKg(targetKg)) kg-ot." }
            ?? "A cél \(sulyKg(targetKg)) kg."
    }
    switch status {
    case "on_course": return SulyHead(headline: "Pályán vagy a súlycélhoz", sentence: pace + target)
    case "slower": return SulyHead(headline: "Lassabb a tervnél", sentence: pace + "Nem baj: a trend számít, nem egy nap. " + target)
    case "faster":
        let guardLine = course == .bulk ? "Az évad őrei figyelik, hogy izom legyen belőle, ne zsír. " : "Az évad őrei figyelik, hogy az izom megmaradjon. "
        return SulyHead(headline: "Gyorsabb a tervnél", sentence: pace + guardLine + target)
    case "in_band":
        return SulyHead(headline: "A sávban vagy", sentence: trendKg.map { "A trended \(sulyKg($0)) kg, a tartó sávon belül." } ?? "A trended a tartó sávon belül van.")
    case "out_of_band":
        return SulyHead(headline: "Kint a sávból", sentence: trendKg.map { "A trended \(sulyKg($0)) kg, a tartó sávon kívül. Pár nap a terv szerint visszahozza." } ?? "A trended a tartó sávon kívül van.")
    case "no_data":
        return SulyHead(headline: "Még kevés a mérés", sentence: "Pár reggeli mérés után látom a trendedet, és tudom mondani, tartod-e az ütemet.")
    default:
        return SulyHead(headline: "A súlyod", sentence: (pace + target).isEmpty ? "A trended és a méréseid, egy helyen." : pace + target)
    }
}
