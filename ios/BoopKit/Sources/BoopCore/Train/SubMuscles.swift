import Foundation

// The catalogue's 21 fine muscle tokens with their Hungarian names (mezo-r36n9.127, owner-approved simulator spike
// `spike/boop-izomreszek`): „Hát · középső" under every exercise, and the add sheet's grouped multi-select. Display
// only — volume is still grouped by the coarse key (`coarseMuscle`) and the bands are the server's.

public enum SubMuscles {
    /// One token: „középső" after its group's name, or a name of its own in a stand-alone group („Comb").
    public struct Part: Identifiable, Hashable, Sendable {
        public let id: String
        public let short: String
    }

    /// A dropdown group. `standalone`: its parts are names of their own (the legs, the core) — each part is then its
    /// own volume group, so the „kevés" mark sits on the part, not on the group.
    public struct Group: Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        public let parts: [Part]
        public let standalone: Bool
    }

    public static let groups: [Group] = [
        Group(id: "back", name: "Hát", parts: [
            Part(id: "back-wide", short: "felső"), Part(id: "back-mid", short: "középső"),
            Part(id: "back-lower", short: "alsó"), Part(id: "traps", short: "csuklyás"),
        ], standalone: false),
        Group(id: "chest", name: "Mell", parts: [
            Part(id: "chest-upper", short: "felső"), Part(id: "chest-mid", short: "középső"),
            Part(id: "chest-lower", short: "alsó"),
        ], standalone: false),
        Group(id: "shoulder", name: "Váll", parts: [
            Part(id: "shoulder-front", short: "elülső"), Part(id: "shoulder-side", short: "oldalsó"),
            Part(id: "shoulder-rear", short: "hátsó"),
        ], standalone: false),
        Group(id: "biceps", name: "Bicepsz", parts: [
            Part(id: "biceps-long", short: "hosszú fej"), Part(id: "biceps-short", short: "rövid fej"),
            Part(id: "biceps-brachialis", short: "brachialis"),
        ], standalone: false),
        Group(id: "triceps", name: "Tricepsz", parts: [
            Part(id: "triceps-long", short: "hosszú fej"), Part(id: "triceps-lateral", short: "oldalsó fej"),
            Part(id: "triceps-medial", short: "belső fej"),
        ], standalone: false),
        Group(id: "legs", name: "Láb", parts: [
            Part(id: "quad", short: "Comb"), Part(id: "ham", short: "Combhajlító"),
            Part(id: "glute", short: "Far"), Part(id: "calf", short: "Vádli"),
        ], standalone: true),
        Group(id: "core", name: "Törzs", parts: [Part(id: "core", short: "Törzs")], standalone: true),
    ]

    /// Every token in body order (the dropdown's order).
    public static let order: [String] = groups.flatMap { $0.parts.map(\.id) }

    private static let index: [String: (Group, Part)] = Dictionary(
        uniqueKeysWithValues: groups.flatMap { g in g.parts.map { ($0.id, (g, $0)) } })

    /// „Hát · középső", „Bicepsz · brachialis", „Comb", „Törzs". A legacy coarse key („back", „lats") names its group;
    /// anything else is „Egyéb".
    public static func name(_ token: String) -> String {
        let k = token.lowercased()
        if let (g, p) = index[k] { return g.standalone ? p.short : "\(g.name) · \(p.short)" }
        let coarse = coarseMuscle(k)
        if let g = groups.first(where: { !$0.standalone && $0.id == coarse }) { return g.name }
        if let (_, p) = index[coarse] { return p.short }
        return "Egyéb"
    }

    /// The closed dropdown's words, in body order: a whole group by its name, part of one as „Hát · felső, középső";
    /// in a stand-alone group each picked part by its own name.
    public static func summary(_ picked: Set<String>) -> [String] {
        groups.flatMap { g -> [String] in
            let on = g.parts.filter { picked.contains($0.id) }
            if on.isEmpty { return [] }
            if on.count == g.parts.count && g.parts.count > 1 || g.parts.count == 1 { return [g.name] }
            if g.standalone { return on.map(\.short) }
            return ["\(g.name) · \(on.map(\.short).joined(separator: ", "))"]
        }
    }

    /// The picked tokens in body order.
    public static func ordered(_ picked: Set<String>) -> [String] { order.filter { picked.contains($0) } }

    /// The closed dropdown's line when it does not fit: „Hát · középső +2" (the first token and how many more).
    public static func shortSummary(_ picked: Set<String>) -> String? {
        let o = ordered(picked)
        guard let first = o.first else { return nil }
        return o.count == 1 ? name(first) : "\(name(first)) +\(o.count - 1)"
    }

    /// Is the group's own „kevés" mark on (a non-stand-alone group whose coarse key is under its band)?
    public static func groupLow(_ g: Group, under: Set<String>) -> Bool { !g.standalone && under.contains(g.id) }

    /// Is a stand-alone part's „kevés" mark on (its token is its own volume group)?
    public static func partLow(_ g: Group, _ p: Part, under: Set<String>) -> Bool { g.standalone && under.contains(p.id) }
}
