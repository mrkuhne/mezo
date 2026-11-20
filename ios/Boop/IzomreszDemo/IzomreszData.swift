#if DEBUG
import SwiftUI

// THROWAWAY simulator spike (2026-11-21): sub-muscle names everywhere, a compact multi-select muscle dropdown and a
// small picture at every exercise. Invented data — nothing here talks to the server, nothing ships.

/// One of the catalogue's 21 muscle tokens, with its group and its Hungarian names.
struct IzSub: Identifiable, Hashable {
    let id: String          // catalogue token, e.g. "back-mid"
    let group: String       // group id
    let short: String       // „középső" — after the group name
    let long: String        // in the dropdown: „felső (széles hátizom)"
}

struct IzGroup: Identifiable, Hashable {
    let id: String
    let name: String        // „Hát"
    let subs: [IzSub]
    /// Under its band this week: the dropdown marks its parts „kevés".
    var low = false
}

enum IzData {
    static let groups: [IzGroup] = [
        IzGroup(id: "back", name: "Hát", subs: [
            IzSub(id: "back-wide", group: "back", short: "felső", long: "felső (széles hátizom)"),
            IzSub(id: "back-mid", group: "back", short: "középső", long: "középső"),
            IzSub(id: "back-lower", group: "back", short: "alsó", long: "alsó"),
            IzSub(id: "traps", group: "back", short: "csuklyás", long: "csuklyás"),
        ], low: true),
        IzGroup(id: "chest", name: "Mell", subs: [
            IzSub(id: "chest-upper", group: "chest", short: "felső", long: "felső"),
            IzSub(id: "chest-mid", group: "chest", short: "középső", long: "középső"),
            IzSub(id: "chest-lower", group: "chest", short: "alsó", long: "alsó"),
        ]),
        IzGroup(id: "shoulder", name: "Váll", subs: [
            IzSub(id: "shoulder-front", group: "shoulder", short: "elülső", long: "elülső"),
            IzSub(id: "shoulder-side", group: "shoulder", short: "oldalsó", long: "oldalsó"),
            IzSub(id: "shoulder-rear", group: "shoulder", short: "hátsó", long: "hátsó"),
        ]),
        IzGroup(id: "biceps", name: "Bicepsz", subs: [
            IzSub(id: "biceps-long", group: "biceps", short: "hosszú fej", long: "hosszú fej"),
            IzSub(id: "biceps-short", group: "biceps", short: "rövid fej", long: "rövid fej"),
            IzSub(id: "biceps-brachialis", group: "biceps", short: "brachialis", long: "karizom (brachialis)"),
        ], low: true),
        IzGroup(id: "triceps", name: "Tricepsz", subs: [
            IzSub(id: "triceps-long", group: "triceps", short: "hosszú fej", long: "hosszú fej"),
            IzSub(id: "triceps-lateral", group: "triceps", short: "oldalsó fej", long: "oldalsó fej"),
            IzSub(id: "triceps-medial", group: "triceps", short: "belső fej", long: "belső fej"),
        ]),
        IzGroup(id: "legs", name: "Láb", subs: [
            IzSub(id: "quad", group: "legs", short: "comb", long: "comb (négyfejű)"),
            IzSub(id: "ham", group: "legs", short: "combhajlító", long: "combhajlító"),
            IzSub(id: "glute", group: "legs", short: "far", long: "far"),
            IzSub(id: "calf", group: "legs", short: "vádli", long: "vádli"),
        ]),
        IzGroup(id: "core", name: "Törzs", subs: [
            IzSub(id: "core", group: "core", short: "", long: "Törzs"),
        ]),
    ]

    static let subs: [String: IzSub] = Dictionary(uniqueKeysWithValues: groups.flatMap(\.subs).map { ($0.id, $0) })
    static func group(_ id: String) -> IzGroup? { groups.first { $0.id == id } }

    /// „Hát · középső"; a group with one part is just its name („Törzs").
    static func name(_ token: String) -> String {
        guard let s = subs[token], let g = group(s.group) else { return "Egyéb" }
        return s.short.isEmpty ? g.name : "\(g.name) · \(s.short)"
    }

    /// The compact dropdown row's words: a whole group by its name, a part of a group as „Hát · felső, középső".
    static func summary(_ picked: Set<String>) -> [String] {
        groups.compactMap { g in
            let on = g.subs.filter { picked.contains($0.id) }
            if on.isEmpty { return nil }
            if on.count == g.subs.count { return g.name }
            return "\(g.name) · \(on.map(\.short).joined(separator: ", "))"
        }
    }

    // MARK: Invented catalogue

    struct Ex: Identifiable, Hashable {
        let id: String
        let name: String
        let muscle: String
        let compound: Bool
        var reason = ""
        var last: String? = nil
    }

    static let catalogue: [Ex] = [
        Ex(id: "1", name: "Döntött törzsű evezés rúddal", muscle: "back-mid", compound: true,
           reason: "A hát közepét erősíti, és még bírod a hét terhelését.", last: "62,5 kg × 9"),
        Ex(id: "2", name: "Mellre támasztott evezés", muscle: "back-mid", compound: true,
           reason: "Kíméli a derekad, a lapockák közét dolgoztatja.", last: "2 × 26 kg × 10"),
        Ex(id: "3", name: "Kábeles evezés ülve", muscle: "back-mid", compound: true,
           reason: "Egyenletes terhelés végig, jól mérhető haladás."),
        Ex(id: "4", name: "Széles fogású lehúzás", muscle: "back-wide", compound: true,
           reason: "A széles hátizom, ami a V-formát adja.", last: "64 kg × 11"),
        Ex(id: "5", name: "Húzódzkodás", muscle: "back-wide", compound: true, reason: "Saját súllyal, bárhol megy."),
        Ex(id: "6", name: "Hiperextenzió", muscle: "back-lower", compound: false, reason: "A derék izmait erősíti, óvatosan."),
        Ex(id: "7", name: "Vállvonogatás kézisúlyzóval", muscle: "traps", compound: false, reason: "A csuklyás felső része."),
        Ex(id: "8", name: "Ferde pados nyomás kézisúlyzóval", muscle: "chest-upper", compound: true,
           reason: "A mell felső részét éri el legjobban.", last: "2 × 30 kg × 8"),
        Ex(id: "9", name: "Alacsonyról felfelé tárogatás", muscle: "chest-upper", compound: false,
           reason: "Kevés fáradtság, sok inger a felső mellre."),
        Ex(id: "10", name: "Fekvenyomás", muscle: "chest-mid", compound: true, reason: "Az alapgyakorlat.", last: "80 kg × 6"),
        Ex(id: "11", name: "Tolódzkodás", muscle: "chest-lower", compound: true, reason: "Az alsó mell és a tricepsz."),
        Ex(id: "12", name: "Oldalemelés kábellel", muscle: "shoulder-side", compound: false, reason: "A váll szélessége."),
        Ex(id: "13", name: "Fordított tárogatás gépen", muscle: "shoulder-rear", compound: false, reason: "A hátsó váll."),
        Ex(id: "14", name: "Ferde pados bicepsz", muscle: "biceps-long", compound: false,
           reason: "Megnyújtva dolgoztatja a hosszú fejet.", last: "2 × 12 kg × 10"),
        Ex(id: "15", name: "Scott-pados hajlítás", muscle: "biceps-short", compound: false, reason: "A rövid fej, csalás nélkül."),
        Ex(id: "16", name: "Kalapács bicepsz", muscle: "biceps-brachialis", compound: false, reason: "A karizom és az alkar."),
        Ex(id: "17", name: "Fej fölötti tricepsz kábellel", muscle: "triceps-long", compound: false,
           reason: "A hosszú fej nyújtott helyzetben.", last: "27 kg × 12"),
        Ex(id: "18", name: "Tricepsz letolás kötéllel", muscle: "triceps-lateral", compound: false, reason: "Az oldalsó fej."),
        Ex(id: "19", name: "Guggolás", muscle: "quad", compound: true, reason: "A comb eleje, az alap.", last: "100 kg × 5"),
        Ex(id: "20", name: "Román felhúzás", muscle: "ham", compound: true, reason: "A combhajlító megnyújtva."),
        Ex(id: "21", name: "Csípőemelés rúddal", muscle: "glute", compound: true, reason: "A far, a térd kímélésével."),
        Ex(id: "22", name: "Vádliemelés állva", muscle: "calf", compound: false, reason: "A vádli."),
        Ex(id: "23", name: "Kábeles hasprés", muscle: "core", compound: false, reason: "A has terhelve."),
        Ex(id: "24", name: "Egykezes evezés kézisúlyzóval", muscle: "back-mid", compound: true,
           reason: "Oldalanként, hogy egyik se maradjon le."),
    ]

    /// Up to five, taking one from each picked muscle in turn, so every pick shows up near the top.
    static func suggestions(for picked: Set<String>, taken: Set<String> = []) -> [Ex] {
        let order = groups.flatMap(\.subs).map(\.id).filter { picked.contains($0) }
        var buckets = order.map { m in catalogue.filter { $0.muscle == m && !taken.contains($0.id) } }
        var out: [Ex] = []
        while out.count < 5, buckets.contains(where: { !$0.isEmpty }) {
            for i in buckets.indices where !buckets[i].isEmpty && out.count < 5 { out.append(buckets[i].removeFirst()) }
        }
        return out
    }

    static func list(for picked: Set<String>) -> [Ex] {
        (picked.isEmpty ? catalogue : catalogue.filter { picked.contains($0.muscle) })
            .sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
    }

    /// „hát · középső · összetett".
    static func roleLine(_ e: Ex) -> String {
        "\(name(e.muscle).lowercased()) · \(e.compound ? "összetett" : "izolált")"
    }
}
#endif
