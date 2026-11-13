import Foundation

/// How a product's allergen states read against the owner's sensitivity profile. The three levels follow the server's
/// block rule: `allergy` blocks on contains AND traces AND unknown, `intolerance` / `avoid` on contains only. An absent
/// state (no information) is NEVER "free of": it reads "nincs adat".
public enum SensitivityRules {
    public struct Badge: Equatable, Sendable {
        public enum Severity: Equatable, Sendable {
            /// A hard stop (allergy that contains or may contain).
            case block
            /// Contains something the owner is intolerant to or avoids.
            case warn
            /// Traces for a softer level: worth a glance.
            case notice
            /// The product has no information about this allergen.
            case noData
        }
        /// The allergen key the badge is about; nil for the primitive `badge(for:level:)`.
        public var key: String?
        public var severity: Severity
        public var text: String
    }

    /// The badge for one allergen state at one level. nil = nothing to say.
    public static func badge(for state: AllergenState?, level: SensitivityLevel) -> Badge? {
        let label: String
        switch level {
        case .allergy: label = "Allergia"
        case .intolerance: label = "Intolerancia"
        case .avoid: label = "Kerülöd"
        }
        switch state ?? .unknown {
        case .unknown:
            return Badge(key: nil, severity: .noData, text: "nincs adat")
        case .contains:
            return Badge(key: nil, severity: level == .allergy ? .block : .warn, text: "\(label): tartalmazza")
        case .traces:
            switch level {
            case .allergy: return Badge(key: nil, severity: .block, text: "\(label): nyomokban")
            case .intolerance: return Badge(key: nil, severity: .notice, text: "\(label): nyomokban")
            case .avoid: return nil
            }
        }
    }

    /// One badge per structured profile item, in profile order. Free-text items never get one (they only match by
    /// name); a missing key reads "nincs adat".
    public static func badges(allergens: [String: AllergenState], profile: SensitivityProfile) -> [Badge] {
        profile.items.filter(\.isStructured).compactMap { item in
            let key = item.key.lowercased()
            guard var b = badge(for: allergens[key], level: item.level) else { return nil }
            b.key = key
            return b
        }
    }
}
