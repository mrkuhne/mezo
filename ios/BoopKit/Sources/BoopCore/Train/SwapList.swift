import Foundation

// The swap sheet's pure parts (mezo-r36n9.66, spec §6.2): what the gym lacks, what one tap on
// „ehhez nincs eszközöm" changes, and the full list under *Minden gyakorlat*.

extension GymProfile {
    /// True when the gym cannot do this exercise: it is marked missing, or one of the kit kinds it needs is
    /// switched off. A row with no kit attributes (a custom exercise, bodyweight) is never lacking.
    public func lacks(_ e: CatalogExercise) -> Bool {
        missing.contains(e.id) || (e.gear ?? []).contains { offKinds.contains($0) }
    }

    /// The profile after one „ehhez nincs eszközöm". `.ask` changes nothing: the sheet asks which kind first.
    public func applying(_ edit: MissingEdit) -> GymProfile {
        var out = self
        switch edit {
        case .exercise(let id): out.missing.insert(id)
        case .kind(let k): out.offKinds.insert(k.rawValue)
        case .ask: break
        }
        return out
    }

    /// The profile with that edit taken back (*visszavonom*).
    public func reverting(_ edit: MissingEdit) -> GymProfile {
        var out = self
        switch edit {
        case .exercise(let id): out.missing.remove(id)
        case .kind(let k): out.offKinds.remove(k.rawValue)
        case .ask: break
        }
        return out
    }

    /// The edits that make this exercise available again — what un-tapping a lit chip undoes.
    public func edits(blocking e: CatalogExercise) -> [MissingEdit] {
        var out: [MissingEdit] = missing.contains(e.id) ? [.exercise(e.id)] : []
        for raw in e.gear ?? [] where offKinds.contains(raw) {
            if let k = EquipmentKind(rawValue: raw) { out.append(.kind(k)) }
        }
        return out
    }
}

/// The full list under *Minden gyakorlat*: the catalogue without anything already in today's workout (matched by
/// name — today's rows carry the workout's own ids, never the catalogue's), filtered by the search text, the
/// outgoing exercise's muscle first and the rest after it, each part in catalogue order.
public func swapList(catalog: [CatalogExercise], muscle: String, today: [String], query: String) -> [CatalogExercise] {
    let taken = Set(today.map { $0.lowercased() })
    let q = query.trimmingCharacters(in: .whitespaces)
    let open = catalog.filter { c in
        !taken.contains(c.name.lowercased())
            && (q.isEmpty || c.name.range(of: q, options: [.caseInsensitive, .diacriticInsensitive]) != nil)
    }
    return open.filter { $0.muscle == muscle } + open.filter { $0.muscle != muscle }
}

/// The catalogue row of a workout exercise, found by name the way the technique sheet finds its pictures.
public func catalogRow(named name: String?, in catalog: [CatalogExercise]) -> CatalogExercise? {
    guard let name else { return nil }
    return catalog.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }
}
