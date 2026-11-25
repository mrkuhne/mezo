#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY simulator spike (`spike/boop-hianyjelzes`, owner decision #59 „jelzés + hozzáadás"): the coverage hint on
// the block builder's Izmok cards. Invented data, nothing ships. `-previewHiany YES -previewHianyState
// list|why|added|other|none|small`.

/// One coverage rule's words: the verdict, the „miért?" sentences, the one proposed exercise.
struct HianyHint: Equatable {
    let verdictHead: String
    let verdictTail: String
    let why: String
    let exercise: String
    let role: String
    let reason: String
    let day: String
    let dayIndex: Int
    let sets: Int
    let reps: String
    /// For „Mást választok": the add sheet opens filtered to this sub-muscle.
    let subMuscle: String
}

/// Every rule of the spike, in priority order inside a muscle (the chest one is the lowest of all).
enum HianyRules {
    static let ham = HianyHint(
        verdictHead: "Hiányzik a lábhajlítás", verdictTail: "a combhajlítót most csak csípőből hajlítással edzed.",
        why: "A combhajlító két ízületen dolgozik: a csípőből hajlítás a csípő felől, a lábhajlítás a térd felől terheli. A kettő együtt adja a teljes munkát.",
        exercise: "Seated Leg Curl", role: "combhajlító · izolált", reason: "Térdből hajlít: a combhajlítót a másik vége felől terheli.",
        day: "csütörtök", dayIndex: 3, sets: 3, reps: "10–15", subMuscle: "ham")
    static let quad = HianyHint(
        verdictHead: "Hiányzik a lábnyújtás", verdictTail: "a combot most csak guggolással és kitöréssel edzed.",
        why: "A guggolás és a kitörés sok izmot mozgat egyszerre. A lábnyújtás csak a combot dolgoztatja, a térd felől — a kettő együtt adja a teljes munkát.",
        exercise: "Leg Extension", role: "comb · izolált", reason: "Csak a térd mozog: a comb kapja az egész munkát.",
        day: "kedd", dayIndex: 1, sets: 3, reps: "10–15", subMuscle: "quad")
    static let backRow = HianyHint(
        verdictHead: "Hiányzik a vízszintes húzás", verdictTail: "a hátadat most csak felülről lehúzással edzed.",
        why: "A lehúzás főleg a hát széles izmát dolgoztatja, az evezés a hát közepét, a lapockák között. A kettő együtt adja a teljes hátat.",
        exercise: "Seated Cable Row", role: "hát · középső · összetett", reason: "Maga felé húz: a hát közepét éri el.",
        day: "hétfő", dayIndex: 0, sets: 3, reps: "8–12", subMuscle: "back-mid")
    static let backPull = HianyHint(
        verdictHead: "Hiányzik a függőleges húzás", verdictTail: "a hátadat most csak evezéssel edzed.",
        why: "Az evezés a hát közepét dolgoztatja, a lehúzás a széles hátizmot, ami a hátat szélesebbé teszi. A kettő együtt adja a teljes hátat.",
        exercise: "Lat Pulldown", role: "hát · felső · összetett", reason: "Felülről húz: a széles hátizmot terheli.",
        day: "hétfő", dayIndex: 0, sets: 3, reps: "8–12", subMuscle: "back-wide")
    static let biceps = HianyHint(
        verdictHead: "Nincs külön karhajlítás", verdictTail: "a bicepsz most csak a húzásokból kap munkát.",
        why: "Húzáskor a bicepsz csak besegít, ritkán fárad el igazán. Egy külön karhajlítás végig rá teszi a terhet.",
        exercise: "Incline Dumbbell Curl", role: "bicepsz · hosszú fej · izolált", reason: "Hátradőlve hajlít: a bicepszet nyújtott helyzetből terheli.",
        day: "hétfő", dayIndex: 0, sets: 2, reps: "10–15", subMuscle: "biceps-long")
    static let triceps = HianyHint(
        verdictHead: "Nincs külön karnyújtás", verdictTail: "a tricepsz most csak a nyomásokból kap munkát.",
        why: "Nyomáskor a tricepsz csak besegít. A hosszú feje a vállon is átér, ezt egy fej fölötti nyújtás éri el igazán.",
        exercise: "Overhead Cable Triceps Extension", role: "tricepsz · hosszú fej · izolált", reason: "Fej fölött nyújt: a tricepsz hosszú fejét terheli.",
        day: "péntek", dayIndex: 4, sets: 2, reps: "10–15", subMuscle: "triceps-long")
    static let shoulder = HianyHint(
        verdictHead: "Hiányzik az oldalemelés", verdictTail: "a vállad most csak nyomásokból kap munkát.",
        why: "A nyomás főleg a váll elülső részét dolgoztatja. Az oldalsó részt, ami a vállat szélesebbé teszi, az oldalemelés éri el.",
        exercise: "Cable Lateral Raise", role: "váll · oldalsó · izolált", reason: "Oldalra emel: a váll oldalsó részét terheli.",
        day: "péntek", dayIndex: 4, sets: 3, reps: "12–20", subMuscle: "shoulder-side")
    static let chest = HianyHint(
        verdictHead: "Nincs tárogatás", verdictTail: "a mellet most csak nyomásokkal edzed.",
        why: "A nyomásban a váll és a tricepsz is dolgozik. A tárogatás csak a mellet terheli, nyújtott helyzetben.",
        exercise: "Cable Fly", role: "mell · középső · izolált", reason: "Csak a váll mozog: a mell kapja a munkát.",
        day: "csütörtök", dayIndex: 3, sets: 2, reps: "12–15", subMuscle: "chest-mid")
}

struct HianyBand: Equatable { let low: Int; let high: Int; let limit: Int }

struct HianyMuscle: Identifiable, Equatable {
    let key: String
    let tier: MuscleTier
    var sets: Int
    let band: HianyBand
    /// Sets per day index.
    var spread: [Int: Int]
    /// What the week's movements are, in his words — the rule input (shown nowhere; the fixture's reason).
    let movements: String
    /// The rule that fires on this week (nil: covered, or silent).
    let hint: HianyHint?
    var id: String { key }
}

@Observable final class HianyModel {
    static let days = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"]

    var muscles: [HianyMuscle]
    /// The muscles whose proposed exercise he accepted.
    var added: Set<String> = []

    init(hints: Bool) {
        // The `list` week: every muscle inside its band, two hints (Combhajlító, Hát), the chest silent (Tartás).
        // `none`: the same week with the two exercises already on it.
        func m(_ key: String, _ tier: MuscleTier, _ sets: Int, _ band: HianyBand, _ spread: [Int: Int], _ movements: String,
               _ hint: HianyHint?) -> HianyMuscle {
            HianyMuscle(key: key, tier: tier, sets: sets, band: band, spread: spread, movements: movements, hint: hints ? hint : nil)
        }
        muscles = [
            m("chest", .maintain, 6, HianyBand(low: 4, high: 8, limit: 14), [1: 3, 4: 3], "csak nyomás — Tartás: csendes", HianyRules.chest),
            m("back", .emphasize, 14, HianyBand(low: 12, high: 20, limit: 24), [0: 8, 3: 6], "csak lehúzás", HianyRules.backRow),
            m("shoulder", .grow, 10, HianyBand(low: 8, high: 16, limit: 22), [1: 4, 4: 6], "nyomás + oldalemelés", nil),
            m("biceps", .grow, 9, HianyBand(low: 8, high: 14, limit: 20), [0: 5, 3: 4], "húzás + karhajlítás", nil),
            m("triceps", .grow, 8, HianyBand(low: 6, high: 12, limit: 18), [1: 4, 4: 4], "nyomás + karnyújtás", nil),
            m("quad", .grow, 10, HianyBand(low: 8, high: 14, limit: 20), [1: 6, 4: 4], "guggolás + lábnyújtás", nil),
            m("ham", .grow, hints ? 6 : 9, HianyBand(low: 6, high: 12, limit: 18), hints ? [1: 4, 3: 2] : [1: 4, 3: 5],
              "csak csípőből hajlítás", HianyRules.ham),
            m("glute", .maintain, 4, HianyBand(low: 2, high: 6, limit: 12), [1: 4], "—", nil),
        ]
        if !hints {
            if let i = muscles.firstIndex(where: { $0.key == "back" }) { muscles[i].sets = 17; muscles[i].spread = [0: 11, 3: 6] }
        }
    }

    func muscle(_ key: String) -> HianyMuscle? { muscles.first { $0.key == key } }

    /// A hint shows on a Építés / Hangsúly muscle he trains, until he accepts it.
    func activeHint(_ key: String) -> HianyHint? {
        guard let m = muscle(key), m.tier != .maintain, m.sets > 0, !added.contains(key) else { return nil }
        return m.hint
    }

    var hinted: [String] { muscles.map(\.key).filter { activeHint($0) != nil } }

    var hasChanges: Bool { !added.isEmpty }

    func accept(_ key: String) {
        guard let i = muscles.firstIndex(where: { $0.key == key }), let h = muscles[i].hint else { return }
        muscles[i].sets += h.sets
        muscles[i].spread[h.dayIndex, default: 0] += h.sets
        added.insert(key)
    }

    func undo(_ key: String) {
        guard added.contains(key), let i = muscles.firstIndex(where: { $0.key == key }), let h = muscles[i].hint else { return }
        muscles[i].sets -= h.sets
        muscles[i].spread[h.dayIndex, default: 0] -= h.sets
        added.remove(key)
    }
}
#endif
